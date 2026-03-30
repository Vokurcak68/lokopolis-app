import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podpořte nás",
  description:
    "Podpořte Lokopolis: komunitní projekt pro modelovou železnici bez reklam.",
  alternates: { canonical: "/podporte-nas" },
  openGraph: {
    title: "Podpořte nás | Lokopolis",
    description:
      "Podpořte Lokopolis: komunitní projekt pro modelovou železnici bez reklam.",
    url: "https://lokopolis.cz/podporte-nas",
    type: "website",
  },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
