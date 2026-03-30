import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Galerie kolejišť a modelů",
  description:
    "Fotky a videa kolejišť, lokomotiv a modelů od komunity modelářů na Lokopolis.",
  alternates: { canonical: "/galerie" },
  openGraph: {
    title: "Galerie kolejišť a modelů | Lokopolis",
    description:
      "Fotky a videa kolejišť, lokomotiv a modelů od komunity modelářů na Lokopolis.",
    url: "https://lokopolis.cz/galerie",
    type: "website",
  },
};

export default function GalerieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
