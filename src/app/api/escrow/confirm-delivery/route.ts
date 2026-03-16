import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowCompleted } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
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

    if (transaction.buyer_id !== user.id) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    if (transaction.status !== "shipped" && transaction.status !== "delivered") {
      return NextResponse.json({ error: `Nelze potvrdit doručení ve stavu "${transaction.status}"` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({
        status: "completed",
        buyer_confirmed_at: now,
        completed_at: now,
      })
      .eq("id", escrow_id);

    if (updateError) {
      return NextResponse.json({ error: "Nepodařilo se aktualizovat transakci" }, { status: 500 });
    }

    // Mark listing as sold
    await supabase
      .from("listings")
      .update({ status: "sold", updated_at: now })
      .eq("id", transaction.listing_id);

    // Send email to seller
    const { data: seller } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", transaction.seller_id)
      .single();

    if (seller?.email) {
      try {
        const html = escrowCompleted(seller, transaction);
        await sendEmail(seller.email, `✅ Peníze uvolněny (${transaction.payment_reference})`, html);
      } catch (e) {
        console.error("Escrow email error:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow confirm-delivery error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
