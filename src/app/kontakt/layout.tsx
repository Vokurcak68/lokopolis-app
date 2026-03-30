import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Kontaktujte tým Lokopolis. Dotazy, nápady a spolupráce kolem modelové železnice.",
  alternates: { canonical: "/kontakt" },
  openGraph: {
    title: "Kontakt | Lokopolis",
    description:
      "Kontaktujte tým Lokopolis. Dotazy, nápady a spolupráce kolem modelové železnice.",
    url: "https://lokopolis.cz/kontakt",
    type: "website",
  },
};

export default function KontaktLayout({ children }: { children: React.ReactNode }) {
  return children;
}
