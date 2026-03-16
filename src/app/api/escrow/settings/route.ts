import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin, getEscrowSettings } from "@/lib/escrow-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const settings = await getEscrowSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Escrow settings GET error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const body = await req.json();
    const { settings } = body;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Chybí settings objekt" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const validKeys = [
      "commission_rate", "min_commission", "payment_deadline_hours",
      "shipping_deadline_days", "confirmation_deadline_days", "auto_complete_days",
      "bank_account", "bank_iban", "escrow_enabled",
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (!validKeys.includes(key)) continue;
      await supabase
        .from("escrow_settings")
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    }

    const updatedSettings = await getEscrowSettings();
    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error("Escrow settings PUT error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
