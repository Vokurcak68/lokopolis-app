import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Browser client — pro client-side komponenty
// Pokud nejsou env vars nastaveny, vytvoří se "dummy" klient který tiše selže
export const supabase: SupabaseClient = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (createClient("https://placeholder.supabase.co", "placeholder") as SupabaseClient);

// Server client — pro server components
export function createServerClient() {
  if (!supabaseUrl) {
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
