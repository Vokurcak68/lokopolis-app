import { NextResponse } from "next/server";
import { getEscrowSettings } from "@/lib/escrow-helpers";

export async function GET() {
  try {
    const settings = await getEscrowSettings();
    return NextResponse.json({
      commission_rate: settings.commission_rate || "5",
      min_commission: settings.min_commission || "15",
      payment_deadline_hours: settings.payment_deadline_hours || "24",
      shipping_deadline_days: settings.shipping_deadline_days || "5",
      confirmation_deadline_days: settings.confirmation_deadline_days || "7",
      auto_complete_days: settings.auto_complete_days || "14",
    });
  } catch {
    return NextResponse.json({
      commission_rate: "5",
      min_commission: "15",
      payment_deadline_hours: "24",
      shipping_deadline_days: "5",
      confirmation_deadline_days: "7",
      auto_complete_days: "14",
    });
  }
}
