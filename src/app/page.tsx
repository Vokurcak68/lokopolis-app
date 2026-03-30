import type { Metadata } from "next";
import { getHomePageData, getHomepageSections } from "@/app/home-data";
import HomeContent from "@/components/HomeContent";

export const metadata: Metadata = {
  title: "Lokopolis — Svět modelové železnice",
  description:
    "Komunita modelové železnice: články, fórum, bazar, galerie, shop a návody pro modeláře.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lokopolis — Svět modelové železnice",
    description:
      "Komunita modelové železnice: články, fórum, bazar, galerie, shop a návody pro modeláře.",
    url: "https://lokopolis.cz",
    type: "website",
  },
};

export const revalidate = 60;

export default async function Home() {
  const [data, sections] = await Promise.all([
    getHomePageData(),
    getHomepageSections(),
  ]);
  return <HomeContent data={{ ...data, sections }} />;
}
