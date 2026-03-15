import nodemailer from "nodemailer";

/**
 * Centrální SMTP konfigurace — env proměnné na Vercelu:
 *   SMTP_HOST     — hostname SMTP serveru (default: smtp.cesky-hosting.cz)
 *   SMTP_PORT     — port (default: 465)
 *   SMTP_SECURE   — "true" pro SSL/TLS, "false" pro STARTTLS (default: true)
 *   SMTP_USER     — přihlašovací jméno
 *   SMTP_PASS     — heslo
 *   SMTP_FROM     — odesílatel (default: "Lokopolis.cz" <info@lokopolis.cz>)
 */
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.cesky-hosting.cz",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getFrom(): string {
  return process.env.SMTP_FROM || '"Lokopolis.cz" <info@lokopolis.cz>';
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(to: string, subject: string, html: string, options?: { replyTo?: string; text?: string; from?: string }) {
  if (!isEmailConfigured()) {
    console.warn("SMTP_USER nebo SMTP_PASS nenastaveno, email se neodesílá");
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: options?.from || getFrom(),
    replyTo: options?.replyTo,
    to,
    subject,
    html,
    ...(options?.text ? { text: options.text } : {}),
  });
}
