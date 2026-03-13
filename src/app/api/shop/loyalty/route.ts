import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserLoyaltyInfo, POINTS_VALUE_CZK } from "@/lib/loyalty";

export async function GET(req: NextRequest) {
  try {
    // Get user from auth
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    if (!token) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const info = await getUserLoyaltyInfo(user.id);
    if (!info) {
      return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
    }

    return NextResponse.json({
      points: info.points,
      pointsValueCzk: info.pointsValueCzk,
      currentLevel: info.currentLevel,
      nextLevel: info.nextLevel,
      levels: info.levels,
      pointsPerCzk: 1,
      pointsValueRate: POINTS_VALUE_CZK,
    });
  } catch (err) {
    console.error("Loyalty GET error:", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
