import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function getEnvConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    throw new Error("Missing required env vars");
  }
  return { supabaseUrl, supabaseServiceKey, supabaseAnonKey };
}

export function getServiceClient() {
  const config = getEnvConfig();
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authenticateUser(req: NextRequest) {
  const config = getEnvConfig();
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || "";
  if (!token) return null;

  const userClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser(token);
  return user;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile?.role === "admin";
}

export async function getEscrowSettings(): Promise<Record<string, string>> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("escrow_settings").select("key, value");
  const settings: Record<string, string> = {};
  if (data) {
    for (const row of data) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export function generatePaymentReference(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ESC-${year}-${random}`;
}
