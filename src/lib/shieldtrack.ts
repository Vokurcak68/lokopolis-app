/**
 * ShieldTrack API client
 * Verifikace zásilek pro Lokopolis escrow
 */

const SHIELDTRACK_BASE_URL =
  process.env.SHIELDTRACK_API_URL || "https://shieldtrack.lokopolis.cz";

const SHIELDTRACK_API_KEY = process.env.SHIELDTRACK_API_KEY || "";

// --- Types ---

export interface ShieldTrackRegisterData {
  tracking_number: string;
  recipient_name: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_address: string;
  external_order_id: string;
  sender_name: string;
}

export interface ShieldTrackCheck {
  name: string;
  status: "passed" | "warning" | "failed" | "pending";
  detail: string | null;
}

export interface ShieldTrackVerification {
  shipment_id: string;
  status: "verified" | "partial" | "failed" | "pending";
  score: number;
  checks: ShieldTrackCheck[];
  address_match: {
    city: boolean;
    zip: boolean;
  } | null;
  verified_at: string | null;
  created_at: string;
}

export interface ShieldTrackShipment {
  id: string;
  tracking_number: string;
  external_order_id: string;
  verification: ShieldTrackVerification | null;
  created_at: string;
}

export interface ShieldTrackRegisterResponse {
  id: string;
  tracking_number: string;
  status: string;
  created_at: string;
}

// --- API functions ---

async function shieldtrackFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${SHIELDTRACK_BASE_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": SHIELDTRACK_API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ShieldTrack API error: ${res.status} ${res.statusText} - ${text}`
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Registruje zásilku v ShieldTrack systému
 */
export async function registerShipment(
  data: ShieldTrackRegisterData
): Promise<ShieldTrackRegisterResponse> {
  return shieldtrackFetch<ShieldTrackRegisterResponse>("/shipments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Získá detail zásilky včetně verifikačních dat
 */
export async function getShipmentVerification(
  shipmentId: string
): Promise<ShieldTrackShipment> {
  return shieldtrackFetch<ShieldTrackShipment>(`/shipments/${shipmentId}`);
}
