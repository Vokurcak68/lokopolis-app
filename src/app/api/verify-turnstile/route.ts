import { NextRequest, NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;

  if (!token) {
    return NextResponse.json({ success: false, error: "Chybí ověření." }, { status: 400 });
  }

  const valid = await verifyTurnstile(token, ip);
  if (!valid) {
    return NextResponse.json({ success: false, error: "Ověření se nezdařilo." }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
