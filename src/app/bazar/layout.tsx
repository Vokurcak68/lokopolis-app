import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bazar modelové železnice",
  description:
    "Prodávejte a nakupujte modelovou železnici bezpečně v komunitním bazaru Lokopolis.",
  alternates: { canonical: "/bazar" },
  openGraph: {
    title: "Bazar modelové železnice | Lokopolis",
    description:
      "Prodávejte a nakupujte modelovou železnici bezpečně v komunitním bazaru Lokopolis.",
    url: "https://lokopolis.cz/bazar",
    type: "website",
  },
};

export default function BazarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
