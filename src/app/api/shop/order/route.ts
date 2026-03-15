import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnvConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing required env vars");
  }
  return { supabaseUrl, supabaseServiceKey };
}

/**
 * GET /api/shop/order?orderNumber=LKP-2026-12345
 *
 * For guest orders: returns order details without auth (order number is the secret).
 * For logged-in users: validates ownership or admin role.
 */
export async function GET(req: NextRequest) {
  try {
    const config = getEnvConfig();
    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get("orderNumber");

    if (!orderNumber) {
      return NextResponse.json({ error: "Chybí orderNumber" }, { status: 400 });
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch order with items, shipping, payment
    const { data: order, error } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
    }

    // Auth check: if order has user_id, verify the requesting user
    if (order.user_id) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "") || "";

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
      const { data: { user } } = await userClient.auth.getUser(token);

      if (!user) {
        return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
      }

      // Check ownership or admin
      if (user.id !== order.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role !== "admin") {
          return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
        }
      }
    }

    // Guest orders (user_id is null) are accessible by order_number alone
    // The order number is only shared with the customer via email

    // Load items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    let enrichedItems: any[] = [];
    if (items && items.length > 0) {
      const productIds = items.map((i: any) => i.product_id);
      const { data: products } = await supabase
        .from("shop_products")
        .select("id, title, slug, file_url, vat_rate")
        .in("id", productIds);

      enrichedItems = items.map((item: any) => ({
        ...item,
        product: products?.find((p: any) => p.id === item.product_id) || null,
      }));
    } else if (order.product_id) {
      const { data: product } = await supabase
        .from("shop_products")
        .select("id, title, slug, file_url, vat_rate, price")
        .eq("id", order.product_id)
        .single();

      if (product) {
        enrichedItems = [{
          id: "legacy",
          order_id: order.id,
          product_id: order.product_id,
          quantity: 1,
          unit_price: order.price,
          total_price: order.price,
          vat_rate: product.vat_rate ?? 21,
          created_at: order.created_at,
          product,
        }];
      }
    }

    // Load shipping/payment
    let shipping = null;
    let paymentObj = null;

    if (order.shipping_method_id) {
      const { data } = await supabase.from("shipping_methods").select("*").eq("id", order.shipping_method_id).single();
      shipping = data;
    }
    if (order.payment_method_id) {
      const { data } = await supabase.from("payment_methods").select("*").eq("id", order.payment_method_id).single();
      paymentObj = data;
    }

    return NextResponse.json({
      ...order,
      items: enrichedItems,
      shipping,
      paymentObj,
    });
  } catch (err) {
    console.error("Order fetch error:", err);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
