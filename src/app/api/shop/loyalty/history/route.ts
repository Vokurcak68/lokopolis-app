import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    if (!token) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: entries } = await supabase
      .from("loyalty_points")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ entries: entries || [] });
  } catch (err) {
    console.error("Loyalty history error:", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
