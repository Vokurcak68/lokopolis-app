import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowVerificationAlert } from "@/lib/email-templates";

/**
 * POST /api/escrow/verification-alert
 * Manuální odeslání ShieldTrack alertu adminovi.
 * Body: { escrow_id: string }
 * Přístup: pouze admin
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const body = await req.json();
    const escrowId = body.escrow_id;
    if (!escrowId) {
      return NextResponse.json({ error: "Chybí escrow_id" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Načíst transakci
    const { data: transaction, error } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", escrowId)
      .single();

    if (error || !transaction) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    // Načíst listing
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title")
      .eq("id", transaction.listing_id)
      .single();

    // Načíst settings
    const settings = await getEscrowSettings();

    // Získat admin email
    let adminEmail = settings.admin_email;
    if (!adminEmail) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "admin")
        .limit(1)
        .single();
      adminEmail = adminProfile?.email || "";
    }

    if (!adminEmail) {
      return NextResponse.json({ error: "Admin email nenalezen" }, { status: 500 });
    }

    const score = transaction.st_score ?? 0;
    // Nemáme jednotlivé checks z cache, pošleme zjednodušenou verzi
    const checks = transaction.st_status === "failed"
      ? [{ name: "Celkový status", status: "failed" as const, detail: "Verifikace selhala" }]
      : [];

    const html = escrowVerificationAlert(
      transaction,
      listing || { title: "Neznámý inzerát" },
      score,
      checks,
      settings,
    );

    await sendEmail(
      adminEmail,
      `🚨 ShieldTrack alert — skóre ${score}/100 — ${transaction.payment_reference}`,
      html,
    );

    // Označit alert jako poslaný
    await supabase
      .from("escrow_transactions")
      .update({ st_alert_sent: true })
      .eq("id", escrowId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Verification alert error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
