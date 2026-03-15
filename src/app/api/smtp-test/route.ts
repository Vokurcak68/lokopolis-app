import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export async function GET(req: NextRequest) {
  // Jen admin přes secret token — aby nikdo cizí nemohl testovat
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = {
    SMTP_HOST: process.env.SMTP_HOST ? "✅ nastaveno" : "❌ chybí",
    SMTP_PORT: process.env.SMTP_PORT || "(default 465)",
    SMTP_SECURE: process.env.SMTP_SECURE || "(default true)",
    SMTP_USER: process.env.SMTP_USER ? `✅ ${process.env.SMTP_USER.slice(0, 3)}***` : "❌ chybí",
    SMTP_PASS: process.env.SMTP_PASS ? `✅ (${process.env.SMTP_PASS.length} znaků)` : "❌ chybí",
    SMTP_FROM: process.env.SMTP_FROM || "(default)",
    configured: isEmailConfigured(),
  };

  // Zkusit odeslat testovací email
  const testTo = req.nextUrl.searchParams.get("to");
  if (testTo) {
    try {
      await sendEmail(
        testTo,
        "Lokopolis SMTP test",
        "<h2>✅ SMTP funguje!</h2><p>Tento email byl odeslán z Lokopolis testovací route.</p>"
      );
      return NextResponse.json({ ...config, test: `✅ Email odeslán na ${testTo}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ...config, test: `❌ Chyba: ${message}` });
    }
  }

  return NextResponse.json({ ...config, hint: "Přidej &to=tvuj@email.cz pro testovací email" });
}
