import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://lokopolis.cz";
  const now = new Date();

  const routes = [
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

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
