import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Server-only Supabase client (uses service role key if available, otherwise anon key)
export function createServerSupabaseClient() {
  const key = supabaseServiceRoleKey || supabaseAnonKey;
  if (!supabaseUrl || !key) {
    return null;
  }
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
