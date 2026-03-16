import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — track banner click
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Chybí id" }, { status: 400 });

    await supabaseAdmin.rpc("increment_banner_clicks", { banner_id: id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chyba" }, { status: 500 });
  }
}
