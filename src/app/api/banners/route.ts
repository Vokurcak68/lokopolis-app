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
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

// GET — list banners (admin: all, public: active only for a position)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const position = searchParams.get("position");
  const all = searchParams.get("all") === "true";

  if (all) {
    // Admin: check auth
    const user = await getUser(req);
    if (!user || !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }
    const query = supabaseAdmin.from("homepage_banners").select("*").order("position").order("priority", { ascending: false });
    if (position) query.eq("position", position);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  // Public: active banners for given position
  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from("homepage_banners")
    .select("id, position, title, subtitle, image_url, link_url, badge_text, priority")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("priority", { ascending: false });

  if (position) query = query.eq("position", position);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST — create banner (admin only)
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const body = await req.json();
  const { position, title, subtitle, image_url, link_url, badge_text, starts_at, ends_at, priority, is_active } = body;

  if (!title || !link_url) {
    return NextResponse.json({ error: "Název a odkaz jsou povinné" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("homepage_banners").insert({
    position: position || "hero_leaderboard",
    title,
    subtitle: subtitle || null,
    image_url: image_url || null,
    link_url,
    badge_text: badge_text ?? "Sponzorováno",
    starts_at: starts_at || null,
    ends_at: ends_at || null,
    priority: priority ?? 0,
    is_active: is_active ?? true,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT — update banner (admin only)
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Chybí id" }, { status: 400 });

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from("homepage_banners").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — delete banner (admin only)
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Chybí id" }, { status: 400 });

  const { error } = await supabaseAdmin.from("homepage_banners").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
