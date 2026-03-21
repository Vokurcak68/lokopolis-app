import { NextResponse } from "next/server";
import { getEscrowSettings } from "@/lib/escrow-helpers";

export async function GET() {
  try {
    const settings = await getEscrowSettings();
    const account = settings.admin_payout_account || null;
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ account: null });
  }
}
