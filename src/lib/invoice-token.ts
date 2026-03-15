import crypto from "crypto";

const SECRET = process.env.INVOICE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret";

/** Generate HMAC token for invoice download (guest-safe) */
export function generateInvoiceToken(orderId: string, email: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${orderId}:${email.toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 32);
}

/** Verify HMAC token */
export function verifyInvoiceToken(orderId: string, email: string, token: string): boolean {
  const expected = generateInvoiceToken(orderId, email);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token.slice(0, 32)));
}

/** Build full invoice download URL */
export function invoiceUrl(orderId: string, email: string, baseUrl = "https://lokopolis.cz"): string {
  const token = generateInvoiceToken(orderId, email);
  return `${baseUrl}/api/shop/invoice?orderId=${orderId}&email=${encodeURIComponent(email)}&token=${token}`;
}
