import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowShipped } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { escrow_id, tracking_number, carrier, shipping_photo } = body;
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

    if (transaction.seller_id !== user.id) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    if (transaction.status !== "paid") {
      return NextResponse.json({ error: `Nelze odeslat ve stavu "${transaction.status}"` }, { status: 400 });
    }

    const settings = await getEscrowSettings();
    const autoCompleteDays = Number(settings.auto_complete_days || 14);
    const autoCompleteAt = new Date();
    autoCompleteAt.setDate(autoCompleteAt.getDate() + autoCompleteDays);

    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({
        status: "shipped",
        tracking_number: tracking_number || null,
        carrier: carrier || null,
        shipping_photo: shipping_photo || null,
        shipped_at: new Date().toISOString(),
        auto_complete_at: autoCompleteAt.toISOString(),
      })
      .eq("id", escrow_id);

    if (updateError) {
      return NextResponse.json({ error: "Nepodařilo se aktualizovat transakci" }, { status: 500 });
    }

    // Send email to buyer
    const [buyerRes, listingRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
      supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
    ]);

    const buyer = buyerRes.data;
    const listing = listingRes.data;

    if (buyer?.email && listing) {
      try {
        const updatedTransaction = { ...transaction, tracking_number: tracking_number || null, carrier: carrier || null };
        const html = escrowShipped(buyer, listing, updatedTransaction);
        await sendEmail(buyer.email, `📦 Zboží odesláno (${transaction.payment_reference})`, html);
      } catch (e) {
        console.error("Escrow email error:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow ship error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
