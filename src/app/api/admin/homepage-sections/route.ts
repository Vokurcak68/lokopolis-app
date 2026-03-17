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

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "homepage_sections")
    .single();

  if (error) {
    // Table or row might not exist yet — return defaults
    return NextResponse.json({
      leaderboard_banner: true,
      latest_articles: true,
      forum_bar: true,
      categories: true,
      cta_strip: true,
      stats_bar: true,
      inline_banner: true,
      bazar: true,
      competition: true,
      shop_products: true,
      downloads: true,
      popular_articles: true,
      events: true,
      active_authors: true,
      forum_widget: true,
      tags: true,
    });
  }

  return NextResponse.json(data.value);
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const body = await req.json();

  // Validate — must be an object with boolean values
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Neplatný formát" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("site_settings")
    .upsert(
      { key: "homepage_sections", value: body, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
