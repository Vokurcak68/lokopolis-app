import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.cesky-hosting.cz",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || "info@lokopolis.cz",
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_PASS) {
    console.warn("SMTP_PASS not set, skipping email");
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: '"Lokopolis.cz" <info@lokopolis.cz>',
    to,
    subject,
    html,
  });
}
