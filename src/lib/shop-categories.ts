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

// Visual config for known category slugs — easy to extend
export const CATEGORY_META: Record<string, { name: string; emoji: string; color: string; sort: number }> = {
  "kolejovy-plan": { name: "Kolejové plány", emoji: "📐", color: "#3b82f6", sort: 1 },
  "stl-model":     { name: "3D modely / STL", emoji: "🧊", color: "#8b5cf6", sort: 2 },
  "navod":         { name: "Návody", emoji: "📖", color: "#22c55e", sort: 3 },
  "ebook":         { name: "E-booky", emoji: "📚", color: "#eab308", sort: 4 },
  "balicek":       { name: "Balíčky", emoji: "📦", color: "#ec4899", sort: 5 },
};

// Fallback for unknown slugs
const DEFAULT_COLORS = ["#6366f1", "#f59e0b", "#14b8a6", "#f43f5e", "#84cc16", "#a78bfa"];

let cachedCategories: ShopCategory[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

export async function getShopCategories(): Promise<ShopCategory[]> {
  const now = Date.now();
  if (cachedCategories && now - cacheTime < CACHE_TTL) {
    return cachedCategories;
  }

  try {
    // Get distinct categories from actual products
    const { data } = await supabase
      .from("shop_products")
      .select("category")
      .eq("status", "active")
      .not("category", "is", null);

    if (data && data.length > 0) {
      // Collect unique slugs
      const slugs = [...new Set(data.map((d) => d.category as string).filter(Boolean))];

      const categories: ShopCategory[] = slugs.map((slug, i) => {
        const meta = CATEGORY_META[slug];
        return {
          id: slug,
          slug,
          name: meta?.name || slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
          emoji: meta?.emoji || "📁",
          color: meta?.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          sort_order: meta?.sort ?? 100 + i,
          active: true,
        };
      });

      categories.sort((a, b) => a.sort_order - b.sort_order);
      cachedCategories = categories;
      cacheTime = now;
      return categories;
    }
  } catch {
    // DB not available
  }

  return [];
}

export function buildCategoryLabels(categories: ShopCategory[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const c of categories) {
    labels[c.slug] = `${c.emoji} ${c.name}`;
  }
  return labels;
}

export function buildCategoryColors(categories: ShopCategory[]): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const c of categories) {
    colors[c.slug] = c.color;
  }
  return colors;
}

export function getCategoryLabel(categories: ShopCategory[], slug: string): string {
  const cat = categories.find((c) => c.slug === slug);
  return cat ? `${cat.emoji} ${cat.name}` : slug;
}

export function getCategoryColor(categories: ShopCategory[], slug: string): string {
  const cat = categories.find((c) => c.slug === slug);
  return cat?.color || "#6b7280";
}
