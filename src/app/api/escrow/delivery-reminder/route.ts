import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowDeliveryReminder, escrowDeliveryFinalWarning } from "@/lib/email-templates";

/**
 * Cron: Remind buyers to confirm delivery or open dispute.
 *
 * Two waves:
 * 1. First reminder: ~confirmation_deadline_days after delivery (5-7 day window)
 *    Uses flag: delivery_reminder_sent
 * 2. Final warning: 1 day before auto_complete_days deadline (day 13 of 14)
 *    Uses flag: delivery_final_warning_sent
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

    const now = new Date();
    const results: { id: string; wave: string; success: boolean; error?: string }[] = [];

    // === WAVE 1: First reminder (confirmation_deadline_days window) ===
    {
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - confirmationDays);

      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() - (confirmationDays - 2));

      const { data: transactions } = await supabase
        .from("escrow_transactions")
        .select("*")
        .eq("status", "delivered")
        .not("delivered_at", "is", null)
        .gte("delivered_at", windowStart.toISOString())
        .lt("delivered_at", windowEnd.toISOString())
        .is("delivery_reminder_sent", null)
        .limit(50);

      for (const tx of transactions || []) {
        try {
          const deliveredAt = new Date(tx.delivered_at);
          const autoCompleteDate = new Date(deliveredAt);
          autoCompleteDate.setDate(autoCompleteDate.getDate() + autoCompleteDays);
          const daysLeft = Math.max(1, Math.ceil((autoCompleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

          const [buyerRes, listingRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", tx.buyer_id).single(),
            supabase.from("listings").select("*").eq("id", tx.listing_id).single(),
          ]);

          if (buyerRes.data?.email) {
            const html = escrowDeliveryReminder(buyerRes.data, tx, daysLeft, listingRes.data, settings);
            await sendEmail(
              buyerRes.data.email,
              `⏰ Potvrďte přijetí zboží — zbývá ${daysLeft} dní (${tx.payment_reference})`,
              html,
            );
          }

          await supabase
            .from("escrow_transactions")
            .update({ delivery_reminder_sent: true })
            .eq("id", tx.id);

          results.push({ id: tx.id, wave: "first", success: true });
        } catch (e) {
          results.push({ id: tx.id, wave: "first", success: false, error: String(e) });
        }
      }
    }

    // === WAVE 2: Final warning (1 day before auto-complete) ===
    {
      // delivered_at between (autoCompleteDays - 2) and (autoCompleteDays - 1) days ago
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - (autoCompleteDays - 1));

      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() - (autoCompleteDays - 2));

      const { data: transactions } = await supabase
        .from("escrow_transactions")
        .select("*")
        .eq("status", "delivered")
        .not("delivered_at", "is", null)
        .gte("delivered_at", windowStart.toISOString())
        .lt("delivered_at", windowEnd.toISOString())
        .is("delivery_final_warning_sent", null)
        .limit(50);

      for (const tx of transactions || []) {
        try {
          const deliveredAt = new Date(tx.delivered_at);
          const autoCompleteDate = new Date(deliveredAt);
          autoCompleteDate.setDate(autoCompleteDate.getDate() + autoCompleteDays);

          const deadlineStr = autoCompleteDate.toLocaleDateString("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Prague",
          });

          const [buyerRes, listingRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", tx.buyer_id).single(),
            supabase.from("listings").select("*").eq("id", tx.listing_id).single(),
          ]);

          if (buyerRes.data?.email) {
            const html = escrowDeliveryFinalWarning(buyerRes.data, tx, deadlineStr, listingRes.data, settings);
            await sendEmail(
              buyerRes.data.email,
              `🚨 Poslední den — zítra proběhne automatické uvolnění platby (${tx.payment_reference})`,
              html,
            );
          }

          await supabase
            .from("escrow_transactions")
            .update({ delivery_final_warning_sent: true })
            .eq("id", tx.id);

          results.push({ id: tx.id, wave: "final", success: true });
        } catch (e) {
          results.push({ id: tx.id, wave: "final", success: false, error: String(e) });
        }
      }
    }

    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Delivery reminder cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
