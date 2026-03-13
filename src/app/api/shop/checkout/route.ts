import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(10000 + Math.random() * 90000);
  return `LKP-${year}-${seq}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, billing, shippingMethodId, paymentMethodId, couponCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Prázdný košík" }, { status: 400 });
    }
    if (!billing?.name?.trim() || !billing?.email?.trim()) {
      return NextResponse.json({ error: "Vyplňte jméno a email" }, { status: 400 });
    }
    if (!shippingMethodId || !paymentMethodId) {
      return NextResponse.json({ error: "Vyberte dopravu a platbu" }, { status: 400 });
    }

    // Get user (optional — guest checkout allowed)
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    let userId: string | null = null;

    if (token) {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser(token);
      userId = user?.id || null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate products
    const productIds = items.map((i: { productId: string }) => i.productId);
    const { data: products, error: prodErr } = await supabase
      .from("shop_products")
      .select("*")
      .in("id", productIds)
      .eq("status", "active");

    if (prodErr || !products || products.length !== items.length) {
      return NextResponse.json({ error: "Některé produkty nejsou dostupné" }, { status: 400 });
    }

    // Validate shipping method
    const { data: shipping } = await supabase
      .from("shipping_methods")
      .select("*")
      .eq("id", shippingMethodId)
      .eq("active", true)
      .single();

    if (!shipping) {
      return NextResponse.json({ error: "Neplatný způsob dopravy" }, { status: 400 });
    }

    // Validate payment method
    const { data: payment } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("id", paymentMethodId)
      .eq("active", true)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Neplatný způsob platby" }, { status: 400 });
    }

    // Calculate totals
    let itemsTotal = 0;
    const orderItems: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const qty = item.quantity || 1;
      const total = product.price * qty;
      itemsTotal += total;
      orderItems.push({ productId: product.id, quantity: qty, unitPrice: product.price, totalPrice: total });
    }

    const shippingPrice = shipping.free_from && itemsTotal >= shipping.free_from ? 0 : shipping.price;
    const paymentSurcharge = payment.surcharge || 0;

    // Coupon validation
    let couponId: string | null = null;
    let couponDiscount = 0;
    let appliedCouponCode: string | null = null;

    if (couponCode?.trim()) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("active", true)
        .single();

      if (coupon) {
        const now = new Date();
        const isValid =
          (!coupon.valid_from || new Date(coupon.valid_from) <= now) &&
          (!coupon.valid_until || new Date(coupon.valid_until) >= now) &&
          (coupon.max_uses === null || coupon.used_count < coupon.max_uses);

        if (isValid) {
          // Check per-user limit
          let userOk = true;
          if (userId && coupon.max_uses_per_user) {
            const { count } = await supabase
              .from("coupon_usage")
              .select("*", { count: "exact", head: true })
              .eq("coupon_id", coupon.id)
              .eq("user_id", userId);
            if (count !== null && count >= coupon.max_uses_per_user) userOk = false;
          }

          if (userOk) {
            // Calculate applicable total (respecting product/category restrictions)
            let applicableTotal = 0;
            for (const item of orderItems) {
              const product = products.find((p) => p.id === item.productId);
              if (!product) continue;
              if (coupon.product_ids?.length > 0 && !coupon.product_ids.includes(product.id)) continue;
              if (coupon.category_slugs?.length > 0 && !coupon.category_slugs.includes(product.category)) continue;
              applicableTotal += item.totalPrice;
            }

            if (!coupon.min_order_amount || applicableTotal >= coupon.min_order_amount) {
              if (coupon.discount_type === "percent") {
                couponDiscount = applicableTotal * (coupon.discount_value / 100);
                if (coupon.max_discount !== null) couponDiscount = Math.min(couponDiscount, coupon.max_discount);
              } else {
                couponDiscount = Math.min(coupon.discount_value, applicableTotal);
              }
              couponDiscount = Math.round(couponDiscount * 100) / 100;
              couponId = coupon.id;
              appliedCouponCode = coupon.code;
            }
          }
        }
      }
    }

    const totalPrice = Math.max(0, itemsTotal - couponDiscount + shippingPrice + paymentSurcharge);
    const allFree = totalPrice === 0;

    // Create order
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderErr } = await supabase
      .from("shop_orders")
      .insert({
        order_number: orderNumber,
        user_id: userId,
        product_id: products[0]?.id || null,  // Legacy field — first product
        price: itemsTotal,
        status: allFree ? "paid" : "pending",
        payment_method: payment.slug,
        shipping_method_id: shipping.id,
        payment_method_id: payment.id,
        shipping_price: shippingPrice,
        payment_surcharge: paymentSurcharge,
        total_price: totalPrice,
        billing_name: billing.name,
        billing_email: billing.email,
        billing_phone: billing.phone || null,
        billing_street: billing.street || null,
        billing_city: billing.city || null,
        billing_zip: billing.zip || null,
        billing_country: billing.country || "CZ",
        coupon_id: couponId,
        coupon_code: appliedCouponCode,
        coupon_discount: couponDiscount,
        billing_ico: billing.isBusiness ? billing.ico : null,
        billing_dic: billing.isBusiness ? billing.dic : null,
        shipping_street: billing.differentShipping ? billing.shippingStreet : billing.street || null,
        shipping_city: billing.differentShipping ? billing.shippingCity : billing.city || null,
        shipping_zip: billing.differentShipping ? billing.shippingZip : billing.zip || null,
        shipping_country: billing.differentShipping ? billing.shippingCountry : billing.country || "CZ",
        paid_at: allFree ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Order create error:", orderErr);
      return NextResponse.json({ error: "Chyba při vytváření objednávky" }, { status: 500 });
    }

    // Create order items
    for (const item of orderItems) {
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      });
    }

    // Record coupon usage + increment counter
    if (couponId && couponDiscount > 0) {
      await supabase.from("coupon_usage").insert({
        coupon_id: couponId,
        order_id: order.id,
        user_id: userId,
        discount_amount: couponDiscount,
      });
      const { data: cur } = await supabase.from("coupons").select("used_count").eq("id", couponId).single();
      if (cur) {
        await supabase.from("coupons").update({ used_count: cur.used_count + 1 }).eq("id", couponId);
      }
    }

    // For free products + logged in user: auto-grant purchases
    if (allFree && userId) {
      for (const item of orderItems) {
        const product = products.find((p) => p.id === item.productId);
        if (product && product.price === 0) {
          await supabase.from("user_purchases").insert({
            user_id: userId,
            product_id: item.productId,
            order_id: order.id,
          });
        }
      }
    }

    // Clear DB cart for logged-in user
    if (userId) {
      const { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (cart) {
        await supabase.from("cart_items").delete().eq("cart_id", cart.id);
      }
    }

    // Generate QR payment data for bank transfer / QR payment
    let qrData: string | null = null;
    if (!allFree && (payment.slug === "bank-transfer" || payment.slug === "qr-payment")) {
      // SPD format for Czech QR payments
      const vs = orderNumber.replace(/\D/g, "");
      qrData = `SPD*1.0*ACC:CZ0000000000000000000000*AM:${totalPrice.toFixed(2)}*CC:CZK*MSG:${orderNumber}*X-VS:${vs}`;
    }

    return NextResponse.json({
      orderNumber,
      orderId: order.id,
      totalPrice,
      couponDiscount,
      couponCode: appliedCouponCode,
      status: allFree ? "paid" : "pending",
      qrData,
      paymentSlug: payment.slug,
      paymentInstructions: payment.instructions,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
