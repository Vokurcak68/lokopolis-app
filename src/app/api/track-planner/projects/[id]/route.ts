import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function createAuthedClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function requireUser(req: Request) {
  const token = getToken(req);
  if (!token) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }), client: null, user: null };

  const client = createAuthedClient(token);
  if (!client) return { error: NextResponse.json({ error: "server_not_configured" }, { status: 500 }), client: null, user: null };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }), client: null, user: null };

  return { error: null as NextResponse<unknown> | null, client, user: data.user };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireUser(req);
  if (auth.error || !auth.client || !auth.user) return auth.error!;

  const { data, error } = await auth.client
    .from("track_planner_projects")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ project: data });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireUser(req);
  if (auth.error || !auth.client || !auth.user) return auth.error!;

  const body = (await req.json().catch(() => null)) as null | { name?: string; data?: unknown };
  const updates: { name?: string; data?: unknown } = {};
  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body?.data !== undefined) updates.data = body.data;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const { data, error } = await auth.client
    .from("track_planner_projects")
    .update({ ...updates })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id,name,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireUser(req);
  if (auth.error || !auth.client || !auth.user) return auth.error!;

  const { error } = await auth.client
    .from("track_planner_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
