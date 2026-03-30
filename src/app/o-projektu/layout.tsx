import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "O projektu Lokopolis",
  description:
    "Zjistěte, co je Lokopolis, proč vznikl a co všechno nabízí komunitě modelové železnice.",
  alternates: { canonical: "/o-projektu" },
  openGraph: {
    title: "O projektu Lokopolis",
    description:
      "Zjistěte, co je Lokopolis, proč vznikl a co všechno nabízí komunitě modelové železnice.",
    url: "https://lokopolis.cz/o-projektu",
    type: "article",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
