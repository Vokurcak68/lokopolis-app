import crypto from "crypto";

const TUYA_API_BASE = "https://openapi.tuyaeu.com";
const ACCESS_ID = process.env.TUYA_ACCESS_ID || "";
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET || "";

interface TuyaTokenCache {
  accessToken: string;
  expireAt: number;
}

let tokenCache: TuyaTokenCache | null = null;

/**
 * Generate Tuya API signature
 * https://developer.tuya.com/en/docs/iot/new-singnature?id=Kbw0q34cs2e5g
 */
function sign(
  method: string,
  path: string,
  accessToken: string,
  timestamp: string,
  body: string = ""
): string {
  const contentHash = crypto.createHash("sha256").update(body).digest("hex");
  const stringToSign = [method, contentHash, "", path].join("\n");
  const signStr = ACCESS_ID + accessToken + timestamp + stringToSign;
  return crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

/**
 * Get Tuya access token (cached until expiry)
 */
async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expireAt) {
    return tokenCache.accessToken;
  }

  const timestamp = Date.now().toString();
  const path = "/v1.0/token?grant_type=1";
  const signature = sign("GET", path, "", timestamp);

  const res = await fetch(`${TUYA_API_BASE}${path}`, {
    method: "GET",
    headers: {
      client_id: ACCESS_ID,
      sign: signature,
      t: timestamp,
      sign_method: "HMAC-SHA256",
    },
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya token error: ${data.msg || JSON.stringify(data)}`);
  }

  tokenCache = {
    accessToken: data.result.access_token,
    expireAt: Date.now() + (data.result.expire_time - 60) * 1000, // refresh 60s before expiry
  };

  return tokenCache.accessToken;
}

/**
 * Make authenticated Tuya API request
 */
export async function tuyaRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const timestamp = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = sign(method, path, token, timestamp, bodyStr);

  const res = await fetch(`${TUYA_API_BASE}${path}`, {
    method,
    headers: {
      client_id: ACCESS_ID,
      access_token: token,
      sign: signature,
      t: timestamp,
      sign_method: "HMAC-SHA256",
      "Content-Type": "application/json",
    },
    body: bodyStr || undefined,
  });

  return res.json();
}

/**
 * Get camera stream URL (HLS/RTSP)
 */
export async function getCameraStreamUrl(deviceId: string): Promise<{
  url: string;
  type: string;
} | null> {
  // Try WebRTC-compatible stream first (P2P/HLS)
  const result = await tuyaRequest(
    "POST",
    `/v1.0/devices/${deviceId}/stream/actions/allocate`,
    { type: "hls" }
  );

  if (result.success && result.result) {
    const r = result.result as Record<string, unknown>;
    return {
      url: (r.url as string) || "",
      type: "hls",
    };
  }

  // Fallback: try RTSP
  const rtspResult = await tuyaRequest(
    "POST",
    `/v1.0/devices/${deviceId}/stream/actions/allocate`,
    { type: "rtsp" }
  );

  if (rtspResult.success && rtspResult.result) {
    const r = rtspResult.result as Record<string, unknown>;
    return {
      url: (r.url as string) || "",
      type: "rtsp",
    };
  }

  return null;
}
