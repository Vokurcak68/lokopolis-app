import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/clanky", "/forum", "/bazar", "/galerie", "/shop", "/o-projektu", "/kontakt", "/ke-stazeni", "/kamera"],
        disallow: [
          "/admin/",
          "/prihlaseni",
          "/registrace",
          "/ucet",
          "/kosik",
          "/pokladna",
          "/objednavky",
          "/objednavka/",
          "/moje-clanky",
          "/novy-clanek",
          "/bazar/novy",
          "/bazar/moje",
          "/bazar/zpravy",
          "/bazar/transakce",
        ],
      },
    ],
    sitemap: "https://lokopolis.cz/sitemap.xml",
    host: "https://lokopolis.cz",
  };
}
