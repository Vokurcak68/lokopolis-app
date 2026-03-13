import { supabase } from "@/lib/supabase";

export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  active: boolean;
  parent_id: string | null;
}

export interface ShopCategoryTreeNode extends ShopCategory {
  children: ShopCategoryTreeNode[];
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

/**
 * Build a tree structure from flat categories list.
 * Returns only root categories (parent_id = null) with children nested.
 */
export function buildCategoryTree(categories: ShopCategory[]): ShopCategoryTreeNode[] {
  const map = new Map<string, ShopCategoryTreeNode>();

  // Create tree nodes
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  const roots: ShopCategoryTreeNode[] = [];

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Get a category and all its children slugs (for filtering).
 * If the category has children, returns [category slug, ...children slugs].
 * If no children, returns just [category slug].
 */
export function getCategoryWithChildren(categories: ShopCategory[], slug: string): string[] {
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return [slug];

  const childSlugs = categories
    .filter((c) => c.parent_id === cat.id)
    .map((c) => c.slug);

  return [slug, ...childSlugs];
}

/**
 * Get parent category for a given category.
 * Returns null if the category is a root or not found.
 */
export function getParentCategory(categories: ShopCategory[], slug: string): ShopCategory | null {
  const cat = categories.find((c) => c.slug === slug);
  if (!cat?.parent_id) return null;
  return categories.find((c) => c.id === cat.parent_id) || null;
}

/**
 * Get full label with parent: "Parent > Child" or just "Name" for root.
 */
export function getFullCategoryLabel(categories: ShopCategory[], slug: string): string {
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return slug;

  const parent = getParentCategory(categories, slug);
  if (parent) {
    return `${parent.emoji} ${parent.name} › ${cat.name}`;
  }
  return `${cat.emoji} ${cat.name}`;
}
