import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnvConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase env vars");
  }
  return { supabaseUrl, supabaseServiceKey };
}

export async function POST(req: NextRequest) {
  try {
    const config = getEnvConfig();
    const { productId, quantity, orderId } = await req.json();

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    const { data, error } = await supabase.rpc("reserve_stock", {
      p_product_id: productId,
      p_quantity: quantity,
      p_order_id: orderId || null,
    });

    if (error) {
      console.error("Reserve stock RPC error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || "Reservation failed", available: data?.available }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Reserve stock error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
