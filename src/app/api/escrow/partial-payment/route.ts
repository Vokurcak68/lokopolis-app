import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowPartialPayment } from "@/lib/email-templates";

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
    const { escrow_id, partial_amount } = body;
    if (!escrow_id || partial_amount == null) {
      return NextResponse.json({ error: "Chybí escrow_id nebo partial_amount" }, { status: 400 });
    }

    const amount = Number(partial_amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Neplatná částka" }, { status: 400 });
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

    if (transaction.status !== "created") {
      return NextResponse.json({ error: `Nelze označit neúplnou platbu ve stavu "${transaction.status}"` }, { status: 400 });
    }

    if (amount >= Number(transaction.amount)) {
      return NextResponse.json({ error: "Částka musí být menší než celková cena. Pro plnou platbu použijte 'Potvrdit platbu'." }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({ status: "partial_paid", partial_amount: amount })
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
        const html = escrowPartialPayment(buyer, listing, transaction, amount);
        await sendEmail(buyer.email, `⚠️ Neúplná platba — doplaťte ${Number(transaction.amount) - amount} Kč (${transaction.payment_reference})`, html);
      } catch (e) {
        console.error("Escrow email (partial-payment):", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow partial-payment error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
