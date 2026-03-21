import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowShippingReminder } from "@/lib/email-templates";

/**
 * Cron: Remind sellers to ship when 24–48h remain before shipping deadline.
 *
 * shipping_deadline = paid_at + shipping_deadline_days
 * Window: between 24h and 48h before deadline (so daily cron catches it once).
 *
 * Tracks reminded transactions via a "shipping_reminder_sent" flag
 * to avoid duplicate emails.
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

    // We want transactions where deadline is 24–48h from now
    // deadline = paid_at + shippingDays
    // So: paid_at + shippingDays - 48h <= now < paid_at + shippingDays - 24h
    // Rewritten: paid_at <= now - shippingDays + 48h AND paid_at > now - shippingDays + 24h
    const now = new Date();

    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - shippingDays);
    windowStart.setHours(windowStart.getHours() + 24);

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() - shippingDays);
    windowEnd.setHours(windowEnd.getHours() + 48);

    // Find paid transactions in the reminder window that haven't been reminded yet
    const { data: transactions, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .gte("paid_at", windowStart.toISOString())
      .lt("paid_at", windowEnd.toISOString())
      .is("shipping_reminder_sent", null)
      .limit(50);

    if (fetchError) {
      console.error("Shipping reminder fetch error:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ processed: 0, message: "No reminders to send" });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const transaction of transactions) {
      try {
        // Calculate exact deadline
        const paidAt = new Date(transaction.paid_at);
        const deadline = new Date(paidAt);
        deadline.setDate(deadline.getDate() + shippingDays);

        // Format deadline for Czech locale
        const deadlineStr = deadline.toLocaleDateString("cs-CZ", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Prague",
        });

        // Fetch seller and listing
        const [sellerRes, listingRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
          supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
        ]);

        const seller = sellerRes.data;
        const listing = listingRes.data;

        if (seller?.email && listing) {
          const html = escrowShippingReminder(seller, listing, transaction, deadlineStr, settings);
          await sendEmail(
            seller.email,
            `⚠️ Odešlete zboží — lhůta vyprší ${deadlineStr} (${transaction.payment_reference})`,
            html,
          );
        }

        // Mark as reminded
        await supabase
          .from("escrow_transactions")
          .update({ shipping_reminder_sent: true })
          .eq("id", transaction.id);

        console.log(`Shipping reminder sent for ${transaction.id} (${transaction.payment_reference}), deadline: ${deadlineStr}`);
        results.push({ id: transaction.id, success: true });
      } catch (e) {
        console.error(`Shipping reminder error for ${transaction.id}:`, e);
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
    console.error("Shipping reminder cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
