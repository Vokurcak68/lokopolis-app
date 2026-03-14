import { supabase } from "@/lib/supabase";

interface SettingsCache {
  data: Record<string, unknown>;
  timestamp: number;
}

let cache: SettingsCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSettings(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const { data, error } = await supabase
    .from("shop_settings")
    .select("key, value");

  if (error || !data) {
    console.error("Failed to load shop settings:", error);
    return cache?.data ?? {};
  }

  const settings: Record<string, unknown> = {};
  for (const row of data) {
    settings[row.key] = row.value;
  }

  cache = { data: settings, timestamp: Date.now() };
  return settings;
}

export async function getSetting(key: string): Promise<unknown> {
  const settings = await getSettings();
  return settings[key] ?? null;
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export async function getCartTimeoutMs(): Promise<number> {
  const hours = await getSetting("cart_timeout_hours");
  const h = typeof hours === "number" ? hours : 72;
  return h * 60 * 60 * 1000;
}
