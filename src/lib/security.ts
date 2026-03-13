import { NextRequest } from "next/server";

type RateEntry = {
  count: number;
  resetAt: number;
};

const RATE_STORE = new Map<string, RateEntry>();

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
