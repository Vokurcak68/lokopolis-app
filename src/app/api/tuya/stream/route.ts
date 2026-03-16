import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCameraStreamUrl } from "@/lib/tuya";

const DEVICE_ID = process.env.TUYA_DEVICE_ID || "";

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  // Auth — read token from Authorization header
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || "";

  if (!token) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  // Admin check
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  if (!DEVICE_ID) {
    return NextResponse.json({ error: "TUYA_DEVICE_ID not configured" }, { status: 500 });
  }

  try {
    const stream = await getCameraStreamUrl(DEVICE_ID);
    if (!stream.url) {
      return NextResponse.json({ error: stream.debug || "Nepodařilo se získat stream URL" }, { status: 502 });
    }
    return NextResponse.json({ url: stream.url, type: stream.type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Tuya stream error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
