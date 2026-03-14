import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCartTimeoutMs } from "@/lib/shop-settings";

export async function GET(req: NextRequest) {
  // Verify authorization
  const cronSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number> = {};

  try {
    // 1. Delete unapproved reviews older than 90 days
    const reviewCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedReviews } = await supabase
      .from("product_reviews")
      .delete()
      .eq("approved", false)
      .lt("created_at", reviewCutoff)
      .select("id");
    results.unapproved_reviews_deleted = deletedReviews?.length ?? 0;

    // 2. Delete read admin notifications older than 30 days
    const readNotifCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedReadNotifs } = await supabase
      .from("admin_notifications")
      .delete()
      .eq("read", true)
      .lt("created_at", readNotifCutoff)
      .select("id");
    results.read_notifications_deleted = deletedReadNotifs?.length ?? 0;

    // 3. Delete unread admin notifications older than 90 days
    const { data: deletedUnreadNotifs } = await supabase
      .from("admin_notifications")
      .delete()
      .eq("read", false)
      .lt("created_at", reviewCutoff)
      .select("id");
    results.unread_notifications_deleted = deletedUnreadNotifs?.length ?? 0;

    // 4. Delete expired carts (older than configured timeout)
    const timeoutMs = await getCartTimeoutMs();
    const cartCutoff = new Date(Date.now() - timeoutMs).toISOString();

    // First get cart IDs to delete their items
    const { data: expiredCarts } = await supabase
      .from("carts")
      .select("id")
      .lt("updated_at", cartCutoff);

    if (expiredCarts && expiredCarts.length > 0) {
      const cartIds = expiredCarts.map((c) => c.id);
      await supabase.from("cart_items").delete().in("cart_id", cartIds);
      await supabase.from("carts").delete().in("id", cartIds);
    }
    results.expired_carts_deleted = expiredCarts?.length ?? 0;

    // 5. Archive cancelled orders older than 180 days
    const archiveCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data: archivedOrders } = await supabase
      .from("shop_orders")
      .update({ archived_at: new Date().toISOString() })
      .eq("status", "cancelled")
      .is("archived_at", null)
      .lt("created_at", archiveCutoff)
      .select("id");
    results.cancelled_orders_archived = archivedOrders?.length ?? 0;

    console.log("[Cleanup] Results:", results);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
