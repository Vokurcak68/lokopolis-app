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
    const { productId, quantity, notes } = await req.json();

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    const { data, error } = await supabase.rpc("restock_product", {
      p_product_id: productId,
      p_quantity: quantity,
      p_notes: notes || null,
    });

    if (error) {
      console.error("Restock RPC error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || "Restock failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Restock error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
