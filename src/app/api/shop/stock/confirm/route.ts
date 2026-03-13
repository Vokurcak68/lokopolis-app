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

    if (!productId || !quantity || quantity <= 0 || !orderId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    const { data, error } = await supabase.rpc("confirm_sale", {
      p_product_id: productId,
      p_quantity: quantity,
      p_order_id: orderId,
    });

    if (error) {
      console.error("Confirm sale RPC error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || "Confirmation failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Confirm sale error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
