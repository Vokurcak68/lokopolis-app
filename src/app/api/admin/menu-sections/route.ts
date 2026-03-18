import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user;
}

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}

const DEFAULTS: Record<string, boolean> = {
  home: true,
  articles: true,
  forum: true,
  gallery: true,
  events: true,
  competition: true,
  shop: true,
  bazar: true,
  downloads: true,
};

export async function GET(req: NextRequest) {
  // Public endpoint — menu visibility is needed by all users
  const authHeader = req.headers.get("authorization");
  const isAdminReq = !!authHeader;

  // For admin panel: verify admin
  if (isAdminReq) {
    const user = await getUser(req);
    if (!user || !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "menu_sections")
    .single();

  if (error) {
    return NextResponse.json(DEFAULTS);
  }

  // Merge with defaults so new keys always appear
  return NextResponse.json({ ...DEFAULTS, ...(data.value as Record<string, boolean>) });
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const body = await req.json();

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Neplatný formát" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("site_settings")
    .upsert(
      { key: "menu_sections", value: body, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
