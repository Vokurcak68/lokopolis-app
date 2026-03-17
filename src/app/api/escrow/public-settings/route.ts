import { NextResponse } from "next/server";
import { getEscrowSettings } from "@/lib/escrow-helpers";

export async function GET() {
  try {
    const settings = await getEscrowSettings();
    return NextResponse.json({
      commission_rate: settings.commission_rate || "5",
      min_commission: settings.min_commission || "15",
    });
  } catch {
    return NextResponse.json({ commission_rate: "5", min_commission: "15" });
  }
}
