import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowAutoCompleted } from "@/lib/email-templates";

/**
 * Cron endpoint: Auto-complete escrow transactions 14 days after delivery.
 * Called daily from vercel.json cron.
 * 
 * Skips transactions in "hold" or "disputed" status.
 * Only processes transactions with status="delivered" and delivered_at older than 14 days.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this header for cron jobs)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();
    const settings = await getEscrowSettings();
    const autoCompleteDays = Number(settings.auto_complete_days || 14);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - autoCompleteDays);

    // Find all delivered transactions older than 14 days
    // Exclude hold and disputed (safety check — they shouldn't be "delivered" anyway)
    const { data: transactions, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("status", "delivered")
      .not("delivered_at", "is", null)
      .lt("delivered_at", cutoff.toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Auto-complete fetch error:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ processed: 0, message: "No transactions to auto-complete" });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];
    const now = new Date().toISOString();

    for (const transaction of transactions) {
      try {
        // Update status to auto_completed
        const { error: updateError } = await supabase
          .from("escrow_transactions")
          .update({
            status: "auto_completed",
            completed_at: now,
          })
          .eq("id", transaction.id)
          .eq("status", "delivered"); // Optimistic lock

        if (updateError) {
          results.push({ id: transaction.id, success: false, error: updateError.message });
          continue;
        }

        // Mark listing as sold
        await supabase
          .from("listings")
          .update({ status: "sold", updated_at: now })
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

        // Send emails to both parties
        if (buyer?.email && listing) {
          try {
            const html = escrowAutoCompleted(buyer, listing, transaction, "buyer", settings);
            await sendEmail(
              buyer.email,
              `✅ Transakce automaticky dokončena (${transaction.payment_reference})`,
              html,
            );
          } catch (e) {
            console.error(`Auto-complete email to buyer failed (${transaction.id}):`, e);
          }
        }

        if (seller?.email && listing) {
          try {
            const html = escrowAutoCompleted(seller, listing, transaction, "seller", settings);
            await sendEmail(
              seller.email,
              `✅ Transakce automaticky dokončena (${transaction.payment_reference})`,
              html,
            );
          } catch (e) {
            console.error(`Auto-complete email to seller failed (${transaction.id}):`, e);
          }
        }

        console.log(`Auto-completed escrow ${transaction.id} (${transaction.payment_reference})`);
        results.push({ id: transaction.id, success: true });
      } catch (e) {
        console.error(`Auto-complete error for ${transaction.id}:`, e);
        results.push({ id: transaction.id, success: false, error: String(e) });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      processed: transactions.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error("Auto-complete cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
