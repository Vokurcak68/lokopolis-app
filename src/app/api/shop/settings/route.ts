import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { invalidateSettingsCache } from "@/lib/shop-settings";

export async function GET() {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("key, value");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings: Record<string, unknown> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  // Verify admin
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updates = body as Record<string, unknown>;

  for (const [key, value] of Object.entries(updates)) {
    const { error } = await supabase
      .from("shop_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) {
      return NextResponse.json({ error: `Failed to update ${key}: ${error.message}` }, { status: 500 });
    }
  }

  invalidateSettingsCache();
  return NextResponse.json({ success: true });
}
