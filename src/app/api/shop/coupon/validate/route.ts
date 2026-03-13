import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, items, userId } = body;

    if (!code?.trim()) {
      return NextResponse.json({ error: "Zadejte kód kupónu" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find coupon
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("active", true)
      .single();

    if (!coupon) {
      return NextResponse.json({ error: "Neplatný kupón" }, { status: 404 });
    }

    const now = new Date();

    // Check validity period
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return NextResponse.json({ error: "Kupón ještě není platný" }, { status: 400 });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return NextResponse.json({ error: "Kupón vypršel" }, { status: 400 });
    }

    // Check max uses
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ error: "Kupón byl již vyčerpán" }, { status: 400 });
    }

    // Check per-user limit
    if (userId && coupon.max_uses_per_user) {
      const { count } = await supabase
        .from("coupon_usage")
        .select("*", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", userId);
      if (count !== null && count >= coupon.max_uses_per_user) {
        return NextResponse.json({ error: "Tento kupón jste již použili" }, { status: 400 });
      }
    }

    // Check first order only
    if (coupon.first_order_only && userId) {
      const { count } = await supabase
        .from("shop_orders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("status", "cancelled");
      if (count !== null && count > 0) {
        return NextResponse.json({ error: "Kupón je jen pro první objednávku" }, { status: 400 });
      }
    }

    // Calculate applicable amount
    let applicableTotal = 0;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        // Check product restriction
        if (coupon.product_ids && coupon.product_ids.length > 0) {
          if (!coupon.product_ids.includes(item.productId)) continue;
        }
        // Check category restriction
        if (coupon.category_slugs && coupon.category_slugs.length > 0) {
          if (!coupon.category_slugs.includes(item.category)) continue;
        }
        applicableTotal += (item.price || 0) * (item.quantity || 1);
      }
    }

    // Check min order amount
    if (coupon.min_order_amount !== null && applicableTotal < coupon.min_order_amount) {
      return NextResponse.json({
        error: `Minimální hodnota objednávky je ${coupon.min_order_amount} Kč`,
      }, { status: 400 });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === "percent") {
      discount = applicableTotal * (coupon.discount_value / 100);
      if (coupon.max_discount !== null) {
        discount = Math.min(discount, coupon.max_discount);
      }
    } else {
      discount = Math.min(coupon.discount_value, applicableTotal);
    }
    discount = Math.round(discount * 100) / 100;

    return NextResponse.json({
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discount,
      description: coupon.discount_type === "percent"
        ? `-${coupon.discount_value}%`
        : `-${coupon.discount_value} Kč`,
    });
  } catch (err) {
    console.error("Coupon validate error:", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
