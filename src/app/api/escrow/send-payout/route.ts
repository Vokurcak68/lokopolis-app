import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowPayoutSent } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const body = await req.json();
    const { escrow_id } = body;
    if (!escrow_id) {
      return NextResponse.json({ error: "Chybí escrow_id" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: transaction, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", escrow_id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    if (!["completed", "auto_completed"].includes(transaction.status)) {
      return NextResponse.json({ error: `Nelze odeslat výplatu ve stavu "${transaction.status}"` }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({ status: "payout_sent" })
      .eq("id", escrow_id);

    if (updateError) {
      return NextResponse.json({ error: "Nepodařilo se aktualizovat transakci" }, { status: 500 });
    }

    // Send email to seller
    const [sellerRes, listingRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
      supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
    ]);

    const seller = sellerRes.data;
    const listing = listingRes.data;

    if (seller?.email && listing) {
      try {
        const html = escrowPayoutSent(seller, listing, transaction);
        await sendEmail(seller.email, `💸 Výplata odeslána — ${transaction.payment_reference}`, html);
      } catch (e) {
        console.error("Escrow email (send-payout):", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow send-payout error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
