import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantOrderPoints, redeemPoints, applyPointsToOrder } from "@/lib/loyalty";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp, isValidEmail, normalizeText, rateLimit } from "@/lib/security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(10000 + Math.random() * 90000);
  return `LKP-${year}-${seq}`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`shop-checkout:${ip}`, 12, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Příliš mnoho pokusů o objednávku. Zkus to za chvíli." }, { status: 429 });
    }

    const body = await req.json();
    const { items, billing, shippingMethodId, paymentMethodId, couponCode, loyaltyPointsToUse, turnstileToken } = body;

    if (!turnstileToken) {
      return NextResponse.json({ error: "Chybí anti-bot ověření." }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Anti-bot ověření selhalo." }, { status: 403 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Prázdný košík" }, { status: 400 });
    }

    const safeName = normalizeText(billing?.name || "", 120);
    const safeEmail = normalizeText(billing?.email || "", 200).toLowerCase();

    if (!safeName || !safeEmail) {
      return NextResponse.json({ error: "Vyplňte jméno a email" }, { status: 400 });
    }

    if (!isValidEmail(safeEmail)) {
      return NextResponse.json({ error: "Neplatný email" }, { status: 400 });
    }

    if (!shippingMethodId || !paymentMethodId) {
      return NextResponse.json({ error: "Vyberte dopravu a platbu" }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ error: "Košík je příliš velký" }, { status: 400 });
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

      const qtyRaw = Number(item.quantity || 1);
      const qty = Number.isFinite(qtyRaw) ? Math.max(1, Math.min(99, Math.floor(qtyRaw))) : 1;

      // Digital products max 1 ks
      const finalQty = product.file_url ? 1 : qty;

      const total = Number(product.price) * finalQty;
      itemsTotal += total;
      orderItems.push({ productId: product.id, quantity: finalQty, unitPrice: Number(product.price), totalPrice: total });
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

    // Loyalty points redemption
    let loyaltyDiscount = 0;
    let loyaltyPointsUsed = 0;
    if (loyaltyPointsToUse && loyaltyPointsToUse > 0 && userId) {
      const result = await redeemPoints(userId, loyaltyPointsToUse);
      if ("discount" in result) {
        loyaltyDiscount = result.discount;
        loyaltyPointsUsed = loyaltyPointsToUse;
      }
    }

    const totalPrice = Math.max(0, itemsTotal - couponDiscount - loyaltyDiscount + shippingPrice + paymentSurcharge);
    const allFree = totalPrice === 0;

    const safePhone = normalizeText(billing?.phone || "", 40) || null;
    const safeStreet = normalizeText(billing?.street || "", 160) || null;
    const safeCity = normalizeText(billing?.city || "", 120) || null;
    const safeZip = normalizeText(billing?.zip || "", 20) || null;
    const safeCountry = normalizeText(billing?.country || "CZ", 2).toUpperCase() || "CZ";
    const safeIco = normalizeText(billing?.ico || "", 20) || null;
    const safeDic = normalizeText(billing?.dic || "", 30) || null;
    const safeShippingStreet = normalizeText(billing?.shippingStreet || "", 160) || null;
    const safeShippingCity = normalizeText(billing?.shippingCity || "", 120) || null;
    const safeShippingZip = normalizeText(billing?.shippingZip || "", 20) || null;
    const safeShippingCountry = normalizeText(billing?.shippingCountry || "", 2).toUpperCase() || "CZ";

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
        billing_name: safeName,
        billing_email: safeEmail,
        billing_phone: safePhone,
        billing_street: safeStreet,
        billing_city: safeCity,
        billing_zip: safeZip,
        billing_country: safeCountry,
        coupon_id: couponId,
        coupon_code: appliedCouponCode,
        coupon_discount: couponDiscount,
        loyalty_points_used: loyaltyPointsUsed,
        loyalty_discount: loyaltyDiscount,
        billing_ico: billing.isBusiness ? safeIco : null,
        billing_dic: billing.isBusiness ? safeDic : null,
        shipping_street: billing.differentShipping ? safeShippingStreet : safeStreet,
        shipping_city: billing.differentShipping ? safeShippingCity : safeCity,
        shipping_zip: billing.differentShipping ? safeShippingZip : safeZip,
        shipping_country: billing.differentShipping ? safeShippingCountry : safeCountry,
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

    // Loyalty: deduct used points
    if (loyaltyPointsUsed > 0 && userId) {
      await applyPointsToOrder(userId, order.id, loyaltyPointsUsed, loyaltyDiscount);
    }

    // Loyalty: grant points for purchase (only for paid orders)
    let loyaltyPointsEarned = 0;
    if (userId && itemsTotal > 0) {
      loyaltyPointsEarned = await grantOrderPoints(userId, order.id, itemsTotal, orderNumber);
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
      loyaltyPointsEarned,
      loyaltyPointsUsed: loyaltyPointsUsed,
      loyaltyDiscount,
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
