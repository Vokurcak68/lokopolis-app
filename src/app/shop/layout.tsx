import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop pro modeláře",
  description:
    "Digitální produkty pro modelovou železnici: kolejové plány, 3D modely a návody ke stažení.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop pro modeláře | Lokopolis",
    description:
      "Digitální produkty pro modelovou železnici: kolejové plány, 3D modely a návody ke stažení.",
    url: "https://lokopolis.cz/shop",
    type: "website",
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
