import { NextRequest } from "next/server";
import crypto from "crypto";

type RateEntry = {
  count: number;
  resetAt: number;
};

const RATE_STORE = new Map<string, RateEntry>();
const SEEN_STORE = new Map<string, SeenEntry>();

type SeenEntry = {
  seenAt: number;
};

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const current = RATE_STORE.get(key);

  if (!current || current.resetAt <= now) {
    RATE_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetInMs: current.resetAt - now };
  }

  current.count += 1;
  RATE_STORE.set(key, current);

  return { ok: true, remaining: limit - current.count, resetInMs: current.resetAt - now };
}

export function isValidEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeText(input: string, maxLen = 2000): string {
  return (input || "").replace(/\u0000/g, "").trim().slice(0, maxLen);
}

export function honeypotValid(value: unknown): boolean {
  return typeof value === "undefined" || value === null || String(value).trim() === "";
}

export function minFillTimeValid(startedAt: unknown, minMs = 3000): boolean {
  const ts = Number(startedAt);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts >= minMs;
}

export function payloadDigest(input: unknown): string {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function replayGuard(key: string, windowMs = 120000): boolean {
  const now = Date.now();

  for (const [k, v] of SEEN_STORE.entries()) {
    if (now - v.seenAt > windowMs) {
      SEEN_STORE.delete(k);
    }
  }

  if (SEEN_STORE.has(key)) {
    return false;
  }

  SEEN_STORE.set(key, { seenAt: now });
  return true;
}
