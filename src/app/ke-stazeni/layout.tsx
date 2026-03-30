import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ke stažení",
  description:
    "Kolejové plány, STL modely, návody a další soubory ke stažení pro modeláře.",
  alternates: { canonical: "/ke-stazeni" },
  openGraph: {
    title: "Ke stažení | Lokopolis",
    description:
      "Kolejové plány, STL modely, návody a další soubory ke stažení pro modeláře.",
    url: "https://lokopolis.cz/ke-stazeni",
    type: "website",
  },
};

export default function DownloadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
