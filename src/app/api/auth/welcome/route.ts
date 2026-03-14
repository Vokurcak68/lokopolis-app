import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { getSettings } from "@/lib/shop-settings";

export async function POST(req: NextRequest) {
  try {
    const { email, username } = await req.json();

    if (!email || !username) {
      return NextResponse.json({ error: "Chybí email nebo username" }, { status: 400 });
    }

    const shopSettings = await getSettings() as Record<string, any>;

    await sendEmail(
      email,
      "Vítejte na Lokopolis! 🚂",
      welcomeEmail(username, shopSettings)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Welcome email error:", error);
    return NextResponse.json({ error: "Nepodařilo se odeslat uvítací email" }, { status: 500 });
  }
}
