import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowPayoutConfirmed } from "@/lib/email-templates";

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

    // Only seller can confirm payout
    if (transaction.seller_id !== user.id) {
      return NextResponse.json({ error: "Pouze prodávající může potvrdit přijetí výplaty" }, { status: 403 });
    }

    if (transaction.status !== "payout_sent") {
      return NextResponse.json({ error: `Nelze potvrdit výplatu ve stavu "${transaction.status}"` }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({ status: "payout_confirmed" })
      .eq("id", escrow_id);

    if (updateError) {
      return NextResponse.json({ error: "Nepodařilo se aktualizovat transakci" }, { status: 500 });
    }

    // Send email to admin(s) about payout confirmation
    const [sellerRes, listingRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
      supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
    ]);

    const seller = sellerRes.data;
    const listing = listingRes.data;

    if (listing && seller) {
      // Notify admin(s)
      const { data: admins } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "admin");

      if (admins) {
        for (const admin of admins) {
          if (admin.email) {
            try {
              const html = escrowPayoutConfirmed(seller, listing, transaction);
              await sendEmail(admin.email, `✅ Výplata potvrzena — ${transaction.payment_reference}`, html);
            } catch (e) {
              console.error("Escrow email (confirm-payout admin):", e);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow confirm-payout error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
