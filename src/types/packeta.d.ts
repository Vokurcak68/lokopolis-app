// Typy pro Packeta Widget v6 (Zásilkovna)

interface PacketaPoint {
  id: number;
  name: string;
  nameStreet: string;
  city: string;
  zip: string;
  country: string;
}

interface PacketaWidget {
  pick: (
    apiKey: string,
    callback: (point: PacketaPoint | null) => void,
    options?: { country?: string; language?: string; appIdentity?: string }
  ) => void;
}

interface Packeta {
  Widget: PacketaWidget;
}

declare global {
  interface Window {
    Packeta?: Packeta;
  }
}

export {};
