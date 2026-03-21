import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowDeliveryReminder } from "@/lib/email-templates";

/**
 * Cron: Remind buyers to confirm delivery or open dispute.
 *
 * Sends reminder when delivered_at is between (confirmation_deadline_days - 2) and
 * confirmation_deadline_days old. With daily cron this catches it once in that window.
 *
 * Example: confirmation_deadline_days=7 → reminder sent 5-7 days after delivery.
 *
 * Uses delivery_reminder_sent flag to avoid duplicates.
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
    const confirmationDays = Number(settings.confirmation_deadline_days || 7);
    const autoCompleteDays = Number(settings.auto_complete_days || 14);

    // Window: delivered_at between (confirmationDays - 2) and confirmationDays days ago
    const now = new Date();

    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - confirmationDays);

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() - (confirmationDays - 2));

    // Find delivered transactions in the reminder window, not yet reminded
    const { data: transactions, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("status", "delivered")
      .not("delivered_at", "is", null)
      .gte("delivered_at", windowStart.toISOString())
      .lt("delivered_at", windowEnd.toISOString())
      .is("delivery_reminder_sent", null)
      .limit(50);

    if (fetchError) {
      console.error("Delivery reminder fetch error:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ processed: 0, message: "No reminders to send" });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const transaction of transactions) {
      try {
        // Calculate days left until auto-complete
        const deliveredAt = new Date(transaction.delivered_at);
        const autoCompleteDate = new Date(deliveredAt);
        autoCompleteDate.setDate(autoCompleteDate.getDate() + autoCompleteDays);
        const daysLeft = Math.max(1, Math.ceil((autoCompleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // Fetch buyer and listing
        const [buyerRes, listingRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
          supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
        ]);

        const buyer = buyerRes.data;
        const listing = listingRes.data;

        if (buyer?.email) {
          const html = escrowDeliveryReminder(buyer, transaction, daysLeft, listing, settings);
          await sendEmail(
            buyer.email,
            `⏰ Potvrďte přijetí zboží — zbývá ${daysLeft} dní (${transaction.payment_reference})`,
            html,
          );
        }

        // Mark as reminded
        await supabase
          .from("escrow_transactions")
          .update({ delivery_reminder_sent: true })
          .eq("id", transaction.id);

        console.log(`Delivery reminder sent for ${transaction.id} (${transaction.payment_reference}), ${daysLeft} days left`);
        results.push({ id: transaction.id, success: true });
      } catch (e) {
        console.error(`Delivery reminder error for ${transaction.id}:`, e);
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
    console.error("Delivery reminder cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
