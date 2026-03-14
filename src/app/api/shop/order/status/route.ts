import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { orderStatusChanged, orderShipped } from "@/lib/email-templates";

function getEnvConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing required env vars");
  }

  return { supabaseUrl, supabaseServiceKey };
}

export async function PUT(req: NextRequest) {
  try {
    const config = getEnvConfig();

    // Verify admin via auth token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const userClient = createClient(config.supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    // Check admin role
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "moderator")) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, newStatus, trackingNumber, trackingUrl } = body;

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: "Chybí orderId nebo newStatus" }, { status: 400 });
    }

    const validStatuses = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: "Neplatný stav" }, { status: 400 });
    }

    // Build update object
    const update: Record<string, unknown> = { status: newStatus };

    if (newStatus === "paid") {
      update.paid_at = new Date().toISOString();
    } else if (newStatus === "shipped") {
      update.shipped_at = new Date().toISOString();
      if (trackingNumber) update.tracking_number = trackingNumber;
      if (trackingUrl) update.tracking_url = trackingUrl;
    } else if (newStatus === "delivered") {
      update.delivered_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from("shop_orders")
      .update(update)
      .eq("id", orderId);

    if (updateErr) {
      console.error("Order status update error:", updateErr);
      return NextResponse.json({ error: "Nepodařilo se aktualizovat stav" }, { status: 500 });
    }

    // Fetch full order for email
    const { data: order } = await supabase
      .from("shop_orders")
      .select("*, items:order_items(*, product:shop_products(title, slug, cover_image_url))")
      .eq("id", orderId)
      .single();

    // Send email notification to customer (non-blocking)
    if (order?.billing_email) {
      const emailPromise = (async () => {
        try {
          if (newStatus === "shipped") {
            await sendEmail(
              order.billing_email,
              `Objednávka ${order.order_number} byla odeslána 📦`,
              orderShipped(order)
            );
          } else {
            await sendEmail(
              order.billing_email,
              `Objednávka ${order.order_number} — ${newStatus === "paid" ? "zaplaceno" : newStatus === "delivered" ? "doručeno" : "změna stavu"}`,
              orderStatusChanged(order, newStatus)
            );
          }
        } catch (emailErr) {
          console.error("Order status email error:", emailErr);
        }
      })();
      // Fire and forget
      void emailPromise;
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("Order status error:", err);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
