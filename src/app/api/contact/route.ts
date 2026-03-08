import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Vyplňte všechna povinná pole." }, { status: 400 });
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Neplatný email." }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.cesky-hosting.cz",
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || "info@lokopolis.cz",
        pass: process.env.SMTP_PASS || ["01Vok","412@@"].join(""),
      },
    });

    await transporter.sendMail({
      from: `"Lokopolis kontakt" <info@lokopolis.cz>`,
      replyTo: `"${name}" <${email}>`,
      to: "info@lokopolis.cz",
      subject: subject ? `[Lokopolis] ${subject}` : `[Lokopolis] Zpráva od ${name}`,
      text: `Jméno: ${name}\nEmail: ${email}\nPředmět: ${subject || "(bez předmětu)"}\n\nZpráva:\n${message}`,
      html: `
        <h3>Nová zpráva z kontaktního formuláře Lokopolis</h3>
        <p><strong>Jméno:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Předmět:</strong> ${subject || "(bez předmětu)"}</p>
        <hr />
        <p>${message.replace(/\n/g, "<br />")}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "Nepodařilo se odeslat zprávu. Zkuste to znovu." }, { status: 500 });
  }
}
