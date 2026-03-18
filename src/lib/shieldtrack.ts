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
 * Mapuje ShieldTrack API formát na Lokopolis formát
 */
export async function getShipmentVerification(
  shipmentId: string
): Promise<ShieldTrackShipment> {
  const raw = await shieldtrackFetch<{
    shipment: { id: string; tracking_number: string; external_order_id: string; created_at: string };
    events: unknown[];
    verification: {
      results: unknown[];
      report: {
        score: number;
        status: "verified" | "partial" | "failed" | "pending";
        checks: Array<{
          type: string;
          result: "pass" | "fail" | "warning" | "pending";
          points: number;
          maxPoints: number;
          details: string;
          label: string;
        }>;
        summary: string;
      };
    };
  }>(`/shipments/${shipmentId}`);

  const report = raw.verification?.report;

  if (!report) {
    return {
      id: raw.shipment.id,
      tracking_number: raw.shipment.tracking_number,
      external_order_id: raw.shipment.external_order_id,
      verification: null,
      created_at: raw.shipment.created_at,
    };
  }

  // Mapovat result → status (pass→passed, fail→failed)
  const statusMap: Record<string, "passed" | "failed" | "warning" | "pending"> = {
    pass: "passed",
    fail: "failed",
    warning: "warning",
    pending: "pending",
  };

  const checks: ShieldTrackCheck[] = report.checks.map((c) => ({
    name: c.type,
    status: statusMap[c.result] || "pending",
    detail: c.details,
  }));

  // Zjistit address match z city_match a zip_match kontrol
  const cityCheck = report.checks.find((c) => c.type === "city_match");
  const zipCheck = report.checks.find((c) => c.type === "zip_match");
  const addressMatch =
    cityCheck || zipCheck
      ? {
          city: cityCheck?.result === "pass",
          zip: zipCheck?.result === "pass",
        }
      : null;

  return {
    id: raw.shipment.id,
    tracking_number: raw.shipment.tracking_number,
    external_order_id: raw.shipment.external_order_id,
    verification: {
      shipment_id: raw.shipment.id,
      status: report.status,
      score: report.score,
      checks,
      address_match: addressMatch,
      verified_at: new Date().toISOString(),
      created_at: raw.shipment.created_at,
    },
    created_at: raw.shipment.created_at,
  };
}
