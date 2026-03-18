import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowOnHold } from "@/lib/email-templates";

/**
 * POST /api/escrow/hold
 * Pozastavení výplaty adminem.
 * Body: { escrow_id: string, reason: string }
 * Přístup: pouze admin
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const body = await req.json();
    const { escrow_id, reason } = body;

    if (!escrow_id) {
      return NextResponse.json({ error: "Chybí escrow_id" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "Chybí důvod pozastavení" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Načíst transakci
    const { data: transaction, error } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", escrow_id)
      .single();

    if (error || !transaction) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    // Hold je povolený jen u aktivních stavů (ne cancelled, refunded, completed apod.)
    const allowedStatuses = ["paid", "shipped", "delivered", "auto_completed"];
    if (!allowedStatuses.includes(transaction.status)) {
      return NextResponse.json(
        { error: `Nelze pozastavit transakci ve stavu "${transaction.status}"` },
        { status: 400 }
      );
    }

    // Nastavit status na hold
    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({
        status: "hold",
        hold_reason: reason.trim(),
        admin_note: [transaction.admin_note, `[HOLD] ${reason.trim()}`].filter(Boolean).join("\n"),
      })
      .eq("id", escrow_id);

    if (updateError) {
      console.error("Hold update error:", updateError);
      return NextResponse.json({ error: "Nepodařilo se pozastavit transakci" }, { status: 500 });
    }

    // Poslat email oběma stranám
    try {
      const settings = await getEscrowSettings();

      // Načíst listing
      const { data: listing } = await supabase
        .from("listings")
        .select("id, title")
        .eq("id", transaction.listing_id)
        .single();

      // Načíst buyer a seller profily
      const { data: buyer } = await supabase
        .from("profiles")
        .select("id, username, display_name, email")
        .eq("id", transaction.buyer_id)
        .single();

      const { data: seller } = await supabase
        .from("profiles")
        .select("id, username, display_name, email")
        .eq("id", transaction.seller_id)
        .single();

      const listingData = listing || { title: "Neznámý inzerát" };

      // Email kupujícímu
      if (buyer?.email) {
        const buyerHtml = escrowOnHold(buyer, listingData, transaction, reason.trim(), settings);
        await sendEmail(
          buyer.email,
          `⚠️ Výplata pozastavena — ${transaction.payment_reference}`,
          buyerHtml,
        );
      }

      // Email prodávajícímu
      if (seller?.email) {
        const sellerHtml = escrowOnHold(seller, listingData, transaction, reason.trim(), settings);
        await sendEmail(
          seller.email,
          `⚠️ Výplata pozastavena — ${transaction.payment_reference}`,
          sellerHtml,
        );
      }
    } catch (emailErr) {
      console.warn("Nepodařilo se odeslat hold emaily:", emailErr);
    }

    return NextResponse.json({ ok: true, status: "hold" });
  } catch (error) {
    console.error("Escrow hold error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
