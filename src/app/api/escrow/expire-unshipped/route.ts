import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowUnshippedBuyer, escrowUnshippedSeller, escrowUnshippedAdmin } from "@/lib/email-templates";

/**
 * Cron: Cancel escrow transactions where seller didn't ship in time.
 *
 * Deadline = paid_at + shipping_deadline_days + 24h grace period.
 *
 * For each expired transaction:
 * 1. Status → "cancelled"
 * 2. Listing → "active" (back for sale)
 * 3. Email buyer (refund coming), seller (cancelled), admin (refund needed)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();
    const settings = await getEscrowSettings();
    const shippingDays = Number(settings.shipping_deadline_days || 5);
    const graceHours = 24;

    // Cutoff: paid_at must be older than shippingDays + 24h grace
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - shippingDays);
    cutoff.setHours(cutoff.getHours() - graceHours);

    const { data: transactions, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .lt("paid_at", cutoff.toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Expire-unshipped fetch error:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ processed: 0, message: "No unshipped transactions to cancel" });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];
    const now = new Date().toISOString();
    const adminEmail = settings.admin_email || "info@lokopolis.cz";

    for (const transaction of transactions) {
      try {
        // Cancel the transaction
        const { error: updateError } = await supabase
          .from("escrow_transactions")
          .update({
            status: "cancelled",
            updated_at: now,
          })
          .eq("id", transaction.id)
          .eq("status", "paid"); // Optimistic lock

        if (updateError) {
          results.push({ id: transaction.id, success: false, error: updateError.message });
          continue;
        }

        // Restore listing to active
        await supabase
          .from("listings")
          .update({ status: "active", updated_at: now })
          .eq("id", transaction.listing_id);

        // Fetch buyer, seller, listing
        const [buyerRes, sellerRes, listingRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
          supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
          supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
        ]);

        const buyer = buyerRes.data;
        const seller = sellerRes.data;
        const listing = listingRes.data;

        // Email buyer — refund coming
        if (buyer?.email && listing) {
          try {
            const html = escrowUnshippedBuyer(buyer, listing, transaction, settings);
            await sendEmail(
              buyer.email,
              `❌ Transakce zrušena — zboží nebylo odesláno (${transaction.payment_reference})`,
              html,
            );
          } catch (e) {
            console.error(`Unshipped email to buyer failed (${transaction.id}):`, e);
          }
        }

        // Email seller — cancelled
        if (seller?.email && listing) {
          try {
            const html = escrowUnshippedSeller(seller, listing, transaction, settings);
            await sendEmail(
              seller.email,
              `❌ Transakce zrušena — neodeslali jste včas (${transaction.payment_reference})`,
              html,
            );
          } catch (e) {
            console.error(`Unshipped email to seller failed (${transaction.id}):`, e);
          }
        }

        // Email admin — refund needed
        if (listing && buyer && seller) {
          try {
            const html = escrowUnshippedAdmin(buyer, seller, listing, transaction, settings);
            await sendEmail(
              adminEmail,
              `🔄 REFUND: ${transaction.payment_reference} — prodávající neodeslal (${formatPrice(Number(transaction.amount))})`,
              html,
            );
          } catch (e) {
            console.error(`Unshipped email to admin failed (${transaction.id}):`, e);
          }
        }

        console.log(`Expired unshipped escrow ${transaction.id} (${transaction.payment_reference})`);
        results.push({ id: transaction.id, success: true });
      } catch (e) {
        console.error(`Expire-unshipped error for ${transaction.id}:`, e);
        results.push({ id: transaction.id, success: false, error: String(e) });
      }
    }

    return NextResponse.json({
      processed: transactions.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Expire-unshipped cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}
