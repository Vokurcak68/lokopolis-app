import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowExpiredBuyer, escrowExpiredSeller } from "@/lib/email-templates";

/**
 * Cron endpoint: Cancel unpaid escrow transactions after payment deadline + 24h grace.
 *
 * Finds transactions with status="created" (no payment received)
 * older than (payment_deadline_hours + 24) hours.
 *
 * For each:
 * 1. Set transaction status to "cancelled"
 * 2. Set listing back to "active"
 * 3. Email both buyer and seller
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
    const paymentDeadlineHours = Number(settings.payment_deadline_hours || 24);
    const gracePeriodHours = 24;
    const totalHours = paymentDeadlineHours + gracePeriodHours;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - totalHours);

    // Find unpaid transactions (status="created") older than deadline + grace
    // Also check "partial_paid" — they didn't pay the full amount in time
    const { data: transactions, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .in("status", ["created", "partial_paid"])
      .lt("created_at", cutoff.toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Expire-unpaid fetch error:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ processed: 0, message: "No expired transactions" });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];
    const now = new Date().toISOString();

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
          .in("status", ["created", "partial_paid"]); // Optimistic lock

        if (updateError) {
          results.push({ id: transaction.id, success: false, error: updateError.message });
          continue;
        }

        // Restore listing to active
        await supabase
          .from("listings")
          .update({ status: "active", updated_at: now })
          .eq("id", transaction.listing_id);

        // Fetch buyer, seller, listing for emails
        const [buyerRes, sellerRes, listingRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
          supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
          supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
        ]);

        const buyer = buyerRes.data;
        const seller = sellerRes.data;
        const listing = listingRes.data;

        // Email buyer
        if (buyer?.email && listing) {
          try {
            const html = escrowExpiredBuyer(buyer, listing, transaction, settings);
            await sendEmail(
              buyer.email,
              `❌ Transakce zrušena — platba nepřijata (${transaction.payment_reference})`,
              html,
            );
          } catch (e) {
            console.error(`Expire email to buyer failed (${transaction.id}):`, e);
          }
        }

        // Email seller
        if (seller?.email && listing) {
          try {
            const html = escrowExpiredSeller(seller, listing, transaction, settings);
            await sendEmail(
              seller.email,
              `ℹ️ Transakce zrušena — kupující nezaplatil (${transaction.payment_reference})`,
              html,
            );
          } catch (e) {
            console.error(`Expire email to seller failed (${transaction.id}):`, e);
          }
        }

        console.log(`Expired escrow ${transaction.id} (${transaction.payment_reference}) — unpaid after ${totalHours}h`);
        results.push({ id: transaction.id, success: true });
      } catch (e) {
        console.error(`Expire error for ${transaction.id}:`, e);
        results.push({ id: transaction.id, success: false, error: String(e) });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      processed: transactions.length,
      succeeded,
      failed,
      totalHoursThreshold: totalHours,
      results,
    });
  } catch (error) {
    console.error("Expire-unpaid cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
