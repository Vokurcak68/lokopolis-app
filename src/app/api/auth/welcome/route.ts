import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const { email, username } = await req.json();

    if (!email || !username) {
      return NextResponse.json({ error: "Chybí email nebo username" }, { status: 400 });
    }

    await sendEmail(
      email,
      "Vítejte na Lokopolis! 🚂",
      welcomeEmail(username)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Welcome email error:", error);
    return NextResponse.json({ error: "Nepodařilo se odeslat uvítací email" }, { status: 500 });
  }
}
