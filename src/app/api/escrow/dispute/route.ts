import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowDisputed } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { escrow_id, reason, evidence_images } = body;
    if (!escrow_id || !reason) {
      return NextResponse.json({ error: "Chybí escrow_id nebo reason" }, { status: 400 });
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

    if (transaction.buyer_id !== user.id) {
      return NextResponse.json({ error: "Spor může otevřít pouze kupující" }, { status: 403 });
    }

    if (!["shipped", "delivered"].includes(transaction.status)) {
      return NextResponse.json({ error: `Nelze otevřít spor ve stavu "${transaction.status}"` }, { status: 400 });
    }

    // Create dispute
    const { data: dispute, error: disputeError } = await supabase
      .from("escrow_disputes")
      .insert({
        escrow_id,
        opened_by: user.id,
        reason,
        evidence_images: evidence_images || [],
        status: "open",
      })
      .select()
      .single();

    if (disputeError || !dispute) {
      console.error("Dispute create error:", disputeError);
      return NextResponse.json({ error: "Nepodařilo se vytvořit spor" }, { status: 500 });
    }

    // Update transaction status
    await supabase
      .from("escrow_transactions")
      .update({ status: "disputed", disputed_at: new Date().toISOString() })
      .eq("id", escrow_id);

    // Send emails
    const [buyerRes, sellerRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
      supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
    ]);

    const buyer = buyerRes.data;
    const seller = sellerRes.data;
    const html = escrowDisputed(seller, buyer, dispute, transaction);

    // Send to both parties
    const emailPromises = [];
    if (buyer?.email) emailPromises.push(sendEmail(buyer.email, `⚠️ Spor otevřen (${transaction.payment_reference})`, html));
    if (seller?.email) emailPromises.push(sendEmail(seller.email, `⚠️ Spor otevřen (${transaction.payment_reference})`, html));

    // Also notify admins
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin");

    if (admins) {
      for (const admin of admins) {
        if (admin.email) {
          emailPromises.push(sendEmail(admin.email, `⚠️ Nový escrow spor (${transaction.payment_reference})`, html));
        }
      }
    }

    try {
      await Promise.all(emailPromises);
    } catch (e) {
      console.error("Escrow dispute email error:", e);
    }

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error("Escrow dispute error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
