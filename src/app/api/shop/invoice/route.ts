import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePdf } from "@/lib/invoice-generator";
import { getSettings } from "@/lib/shop-settings";
import type { ShopOrderWithDetails, OrderItem, ShopProduct, ShippingMethod, PaymentMethod } from "@/types/database";

function getEnvConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  }

  return { supabaseUrl, supabaseServiceKey };
}

export async function GET(req: NextRequest) {
  try {
    const config = getEnvConfig();
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Chybí orderId" }, { status: 400 });
    }

    // Authenticate user
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

    // Use service role for data fetching
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // Get order
    const { data: order, error: orderErr } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
    }

    // Authorization check: owner or admin
    if (!isAdmin && order.user_id !== user.id) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }

    // Load items
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    let items: OrderItem[] = [];
    if (itemsData && itemsData.length > 0) {
      const productIds = itemsData.map((i: OrderItem) => i.product_id);
      const { data: products } = await supabase
        .from("shop_products")
        .select("*")
        .in("id", productIds);

      items = itemsData.map((item: OrderItem) => ({
        ...item,
        product: (products?.find((p: ShopProduct) => p.id === item.product_id) as ShopProduct) || null,
      }));
    } else if (order.product_id) {
      const { data: product } = await supabase
        .from("shop_products")
        .select("*")
        .eq("id", order.product_id)
        .single();

      items = [{
        id: "legacy",
        order_id: order.id,
        product_id: order.product_id,
        quantity: 1,
        unit_price: order.price,
        total_price: order.price,
        vat_rate: (product as ShopProduct)?.vat_rate ?? 21,
        created_at: order.created_at,
        product: (product as ShopProduct) || null,
      }];
    }

    // Load shipping/payment
    let shipping: ShippingMethod | null = null;
    let payment: PaymentMethod | null = null;

    if (order.shipping_method_id) {
      const { data } = await supabase.from("shipping_methods").select("*").eq("id", order.shipping_method_id).single();
      shipping = data as ShippingMethod | null;
    }
    if (order.payment_method_id) {
      const { data } = await supabase.from("payment_methods").select("*").eq("id", order.payment_method_id).single();
      payment = data as PaymentMethod | null;
    }

    const fullOrder: ShopOrderWithDetails = {
      ...order,
      items,
      product: null,
      shipping,
      payment,
    };

    // Generate PDF
    const shopSettings = await getSettings() as Record<string, any>;
    const doc = await generateInvoicePdf(fullOrder, shopSettings);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="faktura-${order.order_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return NextResponse.json({ error: "Chyba při generování faktury" }, { status: 500 });
  }
}
