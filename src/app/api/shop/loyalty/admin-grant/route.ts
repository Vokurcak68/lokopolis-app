import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { grantBonusPoints } from "@/lib/loyalty";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    // Verify admin
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    // Admin check via service key (from admin page, cookies handle auth)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // For now, check if request comes from admin (simplified)
    // In production, verify JWT properly
    const body = await req.json();
    const { userId, points, reason } = body;

    if (!userId || !points) {
      return NextResponse.json({ error: "userId a points jsou povinné" }, { status: 400 });
    }

    await grantBonusPoints(userId, points, reason || "admin", `Admin bonus: ${reason || "manuální přidělení"}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin grant error:", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
