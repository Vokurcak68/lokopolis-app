import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantBonusPoints } from "@/lib/loyalty";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    if (!token) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Neplatná session" }, { status: 401 });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Pouze pro admina" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, points, reason } = body;

    if (!userId || !points) {
      return NextResponse.json({ error: "userId a points jsou povinné" }, { status: 400 });
    }

    const parsedPoints = Number(points);
    if (!Number.isFinite(parsedPoints) || parsedPoints === 0) {
      return NextResponse.json({ error: "Body musí být nenulové číslo" }, { status: 400 });
    }

    await grantBonusPoints(
      userId,
      parsedPoints,
      reason || "admin",
      `Admin bonus: ${reason || "manuální přidělení"}`,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin grant error:", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
