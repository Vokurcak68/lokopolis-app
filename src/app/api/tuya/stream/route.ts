import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCameraStreamUrl } from "@/lib/tuya";

const DEVICE_ID = process.env.TUYA_DEVICE_ID || "";

export async function GET() {
  // Auth check — admin only
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

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
