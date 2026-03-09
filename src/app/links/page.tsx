import type { Metadata } from "next";
import LinksContent from "@/components/LinksContent";

export const metadata: Metadata = {
  title: "Odkazy | Lokopolis",
  description: "Všechny důležité odkazy na jednom místě — Lokopolis, svět modelové železnice.",
};

export default function LinksPage() {
  return <LinksContent />;
}
