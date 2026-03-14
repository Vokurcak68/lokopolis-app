import type { Metadata } from "next";
import { ObchodniPodminkyContent } from "./content";

export const metadata: Metadata = {
  title: "Obchodní podmínky",
  description: "Všeobecné obchodní podmínky e-shopu Lokopolis.cz",
};

export default function ObchodniPodminkyPage() {
  return <ObchodniPodminkyContent />;
}
