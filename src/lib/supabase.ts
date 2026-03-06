import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — pro client-side komponenty
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server client — pro server components (používá stejný anon key,
// service_role key přidáme později pro admin operace)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
