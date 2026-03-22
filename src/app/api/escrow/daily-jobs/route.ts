import { NextRequest, NextResponse } from "next/server";

/**
 * Master cron: runs all escrow jobs sequentially.
 * Single cron entry for Vercel Hobby plan (max 2 crons).
 *
 * Order matters:
 * 1. fio-sync        — match incoming payments first
 * 2. expire-unpaid   — cancel unpaid transactions
 * 3. shipping-reminder — warn sellers before shipping deadline
 * 4. expire-unshipped — cancel unshipped transactions
 * 5. delivery-reminder — remind buyers (2 waves)
 * 6. auto-complete   — complete delivered after 14 days
 *
 * Each job is called via internal fetch with the same CRON_SECRET.
 * Failures in one job don't block subsequent jobs.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const jobs = [
    "fio-sync",
    "expire-unpaid",
    "shipping-reminder",
    "expire-unshipped",
    "delivery-reminder",
    "auto-complete",
  ];

  const results: { job: string; status: number; data?: unknown; error?: string; ms: number }[] = [];

  for (const job of jobs) {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/api/escrow/${job}`, {
        headers: {
          Authorization: `Bearer ${cronSecret || ""}`,
        },
        // No cache, fresh each time
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);
      results.push({
        job,
        status: res.status,
        data,
        ms: Date.now() - start,
      });

      console.log(`[daily-jobs] ${job}: ${res.status} (${Date.now() - start}ms)`);
    } catch (e) {
      results.push({
        job,
        status: 0,
        error: String(e),
        ms: Date.now() - start,
      });
      console.error(`[daily-jobs] ${job} FAILED:`, e);
    }
  }

  const failed = results.filter(r => r.status !== 200);

  return NextResponse.json({
    ran: results.length,
    succeeded: results.length - failed.length,
    failed: failed.length,
    results,
  });
}
