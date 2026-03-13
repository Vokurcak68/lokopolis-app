import { supabase } from "@/lib/supabase";

export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  active: boolean;
}

let cachedCategories: ShopCategory[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

export async function getShopCategories(): Promise<ShopCategory[]> {
  const now = Date.now();
  if (cachedCategories && now - cacheTime < CACHE_TTL) {
    return cachedCategories;
  }

  try {
    const { data, error } = await supabase
      .from("shop_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      cachedCategories = data as ShopCategory[];
      cacheTime = now;
      return cachedCategories;
    }
  } catch {
    // DB not available
  }

  return [];
}

/** Force refresh cache (call after adding/editing categories) */
export function invalidateShopCategories() {
  cachedCategories = null;
  cacheTime = 0;
}

export function getCategoryLabel(categories: ShopCategory[], slug: string): string {
  const cat = categories.find((c) => c.slug === slug);
  return cat ? `${cat.emoji} ${cat.name}` : slug;
}

export function getCategoryColor(categories: ShopCategory[], slug: string): string {
  const cat = categories.find((c) => c.slug === slug);
  return cat?.color || "#6b7280";
}
