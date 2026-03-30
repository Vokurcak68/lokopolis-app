import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://lokopolis.cz";
  const now = new Date();
  const supabase = createServerSupabaseClient();

  const staticRoutes = [
    "",
    "/clanky",
    "/forum",
    "/bazar",
    "/galerie",
    "/shop",
    "/ke-stazeni",
    "/kamera",
    "/o-projektu",
    "/kontakt",
    "/podporte-nas",
    "/bazar/jak-to-funguje",
    "/bazar/podminky-escrow",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  if (!supabase) {
    return staticEntries;
  }

  const [articlesRes, listingsRes, productsRes, threadsRes] = await Promise.all([
    supabase
      .from("articles")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .eq("verified", true),
    supabase
      .from("listings")
      .select("id, updated_at, created_at")
      .in("status", ["active", "reserved"]),
    supabase
      .from("shop_products")
      .select("slug, updated_at, created_at")
      .eq("status", "active"),
    supabase
      .from("forum_threads")
      .select("id, updated_at, created_at, section:forum_sections(slug)"),
  ]);

  const articleEntries: MetadataRoute.Sitemap = (articlesRes.data || [])
    .filter((a) => Boolean(a.slug))
    .map((a) => ({
      url: `${base}/clanky/${a.slug}`,
      lastModified: a.updated_at || a.published_at || now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const listingEntries: MetadataRoute.Sitemap = (listingsRes.data || [])
    .filter((l) => Boolean(l.id))
    .map((l) => ({
      url: `${base}/bazar/${l.id}`,
      lastModified: l.updated_at || l.created_at || now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

  const productEntries: MetadataRoute.Sitemap = (productsRes.data || [])
    .filter((p) => Boolean(p.slug))
    .map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updated_at || p.created_at || now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const threadEntries: MetadataRoute.Sitemap = (threadsRes.data || [])
    .filter((t) => Boolean(t.id) && Boolean(t.section && typeof t.section === "object" && "slug" in t.section))
    .map((t) => {
      const section = t.section as { slug?: string } | { slug?: string }[];
      const sectionSlug = Array.isArray(section) ? section[0]?.slug : section?.slug;
      return {
        url: `${base}/forum/${sectionSlug}/${t.id}`,
        lastModified: t.updated_at || t.created_at || now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    })
    .filter((e) => !e.url.includes("/undefined/"));

  return [...staticEntries, ...articleEntries, ...listingEntries, ...productEntries, ...threadEntries];
}
