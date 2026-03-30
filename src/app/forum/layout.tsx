import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fórum modelové železnice",
  description:
    "Diskuzní fórum modelové železnice: poradna, recenze, novinky a vaše kolejiště.",
  alternates: { canonical: "/forum" },
  openGraph: {
    title: "Fórum modelové železnice | Lokopolis",
    description:
      "Diskuzní fórum modelové železnice: poradna, recenze, novinky a vaše kolejiště.",
    url: "https://lokopolis.cz/forum",
    type: "website",
  },
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
