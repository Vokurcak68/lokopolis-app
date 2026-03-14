import type { Metadata } from "next";
import { OchranaUdajuContent } from "./content";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů",
  description: "Zásady ochrany osobních údajů e-shopu Lokopolis.cz",
};

export default function OchranaUdajuPage() {
  return <OchranaUdajuContent />;
}
