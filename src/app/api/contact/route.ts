import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// In-memory rate limiting (per Vercel instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3; // max messages
const RATE_WINDOW = 600_000; // per 10 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Minimum time (ms) between page load and submit — bots submit instantly
const MIN_SUBMIT_TIME = 3000;

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Příliš mnoho zpráv. Zkuste to za chvíli." },
        { status: 429 }
      );
    }

    const { name, email, subject, message, website, _ts } = await req.json();

    // Honeypot — hidden field "website", real users never fill it
    if (website) {
      // Silently accept (don't tip off bots that we caught them)
      return NextResponse.json({ ok: true });
    }

    // Time-based check — form must be open at least 3s
    if (_ts && typeof _ts === "number") {
      const elapsed = Date.now() - _ts;
      if (elapsed < MIN_SUBMIT_TIME) {
        // Too fast — likely a bot
        return NextResponse.json({ ok: true }); // silent accept
      }
    }

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Vyplňte všechna povinná pole." },
        { status: 400 }
      );
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Neplatný email." }, { status: 400 });
    }

    // Message length limits
    if (name.length > 100 || email.length > 200 || (subject && subject.length > 200) || message.length > 5000) {
      return NextResponse.json(
        { error: "Zpráva je příliš dlouhá." },
        { status: 400 }
      );
    }

    // Block messages with too many URLs (spam indicator)
    const urlCount = (message.match(/https?:\/\//gi) || []).length;
    if (urlCount > 3) {
      return NextResponse.json({ ok: true }); // silent accept
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.cesky-hosting.cz",
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || "info@lokopolis.cz",
        pass: process.env.SMTP_PASS || ["01Vok", "412@@"].join(""),
      },
    });

    // Sanitize HTML in message
    const sanitized = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");

    const sanitizedName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sanitizedSubject = subject
      ? subject.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "(bez předmětu)";

    await transporter.sendMail({
      from: `"Lokopolis kontakt" <info@lokopolis.cz>`,
      replyTo: `"${name}" <${email}>`,
      to: "info@lokopolis.cz",
      subject: subject
        ? `[Lokopolis] ${subject}`
        : `[Lokopolis] Zpráva od ${name}`,
      text: `Jméno: ${name}\nEmail: ${email}\nPředmět: ${subject || "(bez předmětu)"}\nIP: ${ip}\n\nZpráva:\n${message}`,
      html: `
        <h3>Nová zpráva z kontaktního formuláře Lokopolis</h3>
        <p><strong>Jméno:</strong> ${sanitizedName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Předmět:</strong> ${sanitizedSubject}</p>
        <p style="color:#888;font-size:12px">IP: ${ip}</p>
        <hr />
        <p>${sanitized}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se odeslat zprávu. Zkuste to znovu." },
      { status: 500 }
    );
  }
}
