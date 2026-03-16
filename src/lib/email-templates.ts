/* eslint-disable @typescript-eslint/no-explicit-any */

import { czechToIBAN } from "./invoice-generator";
import { invoiceUrl } from "./invoice-token";

// ─── Shared wrapper ──────────────────────────────────────────────────────────

function emailWrapper(content: string, settings?: Record<string, any>): string {
  const footer = typeof settings?.email_footer === "string"
    ? settings.email_footer
    : 'Tento e-mail byl odeslán automaticky, neodpovídejte na něj.';

  const signature = typeof settings?.email_signature === "string"
    ? settings.email_signature.replace(/\n/g, "<br>")
    : '';

  const signatureHtml = signature
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2a4e;color:#999;font-size:13px;">${signature}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111122;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111122;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a2e;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #f0a030;">
    <span style="font-size:28px;font-weight:800;letter-spacing:3px;color:#f0a030;">LOKOPOLIS</span>
    <br><span style="font-size:12px;color:#888;letter-spacing:1px;">Svět modelové železnice</span>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:32px;color:#e0e0e0;font-size:15px;line-height:1.6;">
    ${content}
    ${signatureHtml}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 32px;text-align:center;border-top:1px solid #2a2a4e;font-size:12px;color:#666;">
    <a href="https://lokopolis.cz" style="color:#f0a030;text-decoration:none;">lokopolis.cz</a>
    &nbsp;·&nbsp; info@lokopolis.cz
    <br>${esc(footer)}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function esc(s: string | null | undefined): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatPrice(price: number): string {
  return price.toLocaleString("cs-CZ") + " Kč";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Čeká na platbu",
    paid: "Zaplaceno",
    processing: "Zpracovává se",
    shipped: "Odesláno",
    delivered: "Doručeno",
    cancelled: "Zrušeno",
    refunded: "Vráceno",
  };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "#eab308",
    paid: "#22c55e",
    processing: "#3b82f6",
    shipped: "#8b5cf6",
    delivered: "#22c55e",
    cancelled: "#ef4444",
    refunded: "#f97316",
  };
  return map[status] || "#888";
}

// ─── Order item row helper ───────────────────────────────────────────────────

function itemRows(order: any): string {
  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    // Fallback for single-product order
    const title = order.product?.title || order.product_title || "Produkt";
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#e0e0e0;">${esc(title)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#ccc;text-align:center;">1</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#f0a030;text-align:right;">${formatPrice(Number(order.price || 0))}</td>
    </tr>`;
  }
  return order.items
    .map((item: any) => {
      const title = item.product?.title || item.title || "Produkt";
      return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#e0e0e0;">${esc(title)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#ccc;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#f0a030;text-align:right;">${formatPrice(Number(item.totalPrice || item.total_price || (item.unitPrice || item.unit_price || 0) * item.quantity))}</td>
    </tr>`;
    })
    .join("");
}

// ─── Address block ───────────────────────────────────────────────────────────

function addressBlock(label: string, order: any, prefix: string = "billing"): string {
  const name = order[`${prefix}_name`];
  const street = order[`${prefix}_street`];
  const city = order[`${prefix}_city`];
  const zip = order[`${prefix}_zip`];
  const email = order[`${prefix}_email`];
  const phone = order[`${prefix}_phone`];
  const company = order[`${prefix}_company`];
  const ico = order[`${prefix}_ico`];
  const dic = order[`${prefix}_dic`];
  if (!name && !street) return "";
  return `
    <div style="margin-top:16px;">
      <strong style="color:#f0a030;">${label}</strong><br>
      ${company ? `<span style="font-weight:700;">${esc(company)}</span><br>` : ""}
      ${esc(name)}<br>
      ${street ? esc(street) + "<br>" : ""}
      ${city ? esc(city) : ""} ${zip ? esc(zip) : ""}
      ${ico ? `<br>IČO: ${esc(ico)}` : ""}
      ${dic ? `<br>DIČ: ${esc(dic)}` : ""}
      ${email ? `<br>${esc(email)}` : ""}
      ${phone ? `<br>Tel: ${esc(phone)}` : ""}
    </div>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function orderConfirmation(order: any, settings?: Record<string, any>): string {
  const introText = (typeof settings?.email_order_confirmation_intro === "string")
    ? settings.email_order_confirmation_intro
    : "Děkujeme za vaši objednávku! 🎉";

  const vs = order.order_number?.replace(/\D/g, "") || "";
  const totalAmount = Number(order.total_price || order.price);
  const companySettings = (settings?.company && typeof settings.company === "object") ? settings.company as any : {};
  const bankAccount = companySettings.bank_account || "";
  const iban = bankAccount ? czechToIBAN(bankAccount) : "";
  const qrUrl = vs && iban ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`SPD*1.0*ACC:${iban}*AM:${totalAmount.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:Objednavka ${order.order_number}`)}` : "";

  // Doručovací adresa — pickup point má přednost
  const deliveryBlock = order.pickup_point_name
    ? `<div style="margin-top:16px;">
        <strong style="color:#f0a030;">📍 Výdejní místo${order.pickup_point_carrier ? ` (${esc(order.pickup_point_carrier)})` : ""}</strong><br>
        ${esc(order.pickup_point_name)}<br>
        ${order.pickup_point_address ? esc(order.pickup_point_address) : ""}
      </div>`
    : order.shipping_name
      ? addressBlock("Doručovací adresa", order, "shipping")
      : "";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">${esc(introText)}</h2>
    <p>Vaše objednávka <strong style="color:#f0a030;">${esc(order.order_number)}</strong> byla úspěšně přijata.</p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr style="background:#16162b;">
        <th style="padding:10px 8px;text-align:left;color:#888;font-size:13px;">Produkt</th>
        <th style="padding:10px 8px;text-align:center;color:#888;font-size:13px;">Ks</th>
        <th style="padding:10px 8px;text-align:right;color:#888;font-size:13px;">Cena</th>
      </tr>
      ${itemRows(order)}
    </table>

    ${order.coupon_discount > 0 ? `<div style="display:flex;justify-content:space-between;color:#22c55e;font-size:14px;margin:4px 0;">
      <span>Sleva (${esc(order.coupon_code)})</span><span>-${formatPrice(order.coupon_discount)}</span>
    </div>` : ""}
    ${order.loyalty_discount > 0 ? `<div style="color:#a855f7;font-size:14px;margin:4px 0;">
      Věrnostní sleva: -${formatPrice(order.loyalty_discount)}
    </div>` : ""}
    ${order.shipping_method_name ? `<div style="color:#ccc;font-size:14px;margin:4px 0;">Doprava: ${esc(order.shipping_method_name)}${order.shipping_price > 0 ? ` — ${formatPrice(order.shipping_price)}` : " — zdarma"}</div>` : (order.shipping_price > 0 ? `<div style="color:#ccc;font-size:14px;margin:4px 0;">Doprava: ${formatPrice(order.shipping_price)}</div>` : "")}
    ${order.payment_method_name ? `<div style="color:#ccc;font-size:14px;margin:4px 0;">Platba: ${esc(order.payment_method_name)}${order.payment_surcharge > 0 ? ` — příplatek ${formatPrice(order.payment_surcharge)}` : ""}</div>` : (order.payment_surcharge > 0 ? `<div style="color:#ccc;font-size:14px;margin:4px 0;">Příplatek za platbu: ${formatPrice(order.payment_surcharge)}</div>` : "")}

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f0a030;">
      <strong style="font-size:18px;color:#f0a030;">Celkem: ${formatPrice(totalAmount)}</strong>
    </div>

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
      <strong style="color:#f0a030;">💳 Platební údaje</strong><br>
      <span style="color:#ccc;">Variabilní symbol: <strong>${esc(vs)}</strong></span><br>
      <span style="color:#ccc;">Částka: <strong>${formatPrice(totalAmount)}</strong></span>
      ${qrUrl ? `<br><br><img src="${qrUrl}" alt="QR platba" width="180" height="180" style="border-radius:8px;" />
      <br><span style="color:#888;font-size:12px;">Naskenujte QR kód v bankovní aplikaci</span>` : ""}
    </div>

    ${deliveryBlock}
    ${addressBlock("Fakturační adresa", order, "billing")}

    <p style="margin-top:24px;color:#888;">O dalším průběhu objednávky vás budeme informovat e-mailem.</p>
  `, settings);
}

export function orderStatusChanged(order: any, newStatus: string, settings?: Record<string, any>): string {
  const paidStatuses = ["paid", "processing", "shipped", "delivered"];
  const showInvoice = paidStatuses.includes(newStatus) && order.id && (order.billing_email || order.guest_email);
  const invoiceLink = showInvoice ? invoiceUrl(order.id, order.billing_email || order.guest_email) : "";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">Změna stavu objednávky</h2>
    <p>Vaše objednávka <strong style="color:#f0a030;">${esc(order.order_number)}</strong> má nový stav:</p>
    
    <div style="margin:20px 0;padding:20px;background:#16162b;border-radius:8px;text-align:center;">
      <span style="display:inline-block;padding:8px 20px;border-radius:20px;background:${statusColor(newStatus)}20;color:${statusColor(newStatus)};font-weight:700;font-size:16px;">
        ${statusLabel(newStatus)}
      </span>
    </div>

    ${order.tracking_number ? `
    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
      <strong style="color:#f0a030;">📦 Sledování zásilky</strong><br>
      <span style="color:#ccc;">Číslo zásilky: ${esc(order.tracking_number)}</span>
      ${order.tracking_url ? `<br><a href="${esc(order.tracking_url)}" style="color:#f0a030;text-decoration:none;">Sledovat zásilku →</a>` : ""}
    </div>` : ""}

    ${invoiceLink ? `
    <div style="margin:16px 0;text-align:center;">
      <a href="${esc(invoiceLink)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">📄 Stáhnout fakturu</a>
    </div>` : ""}

    <p style="color:#888;">Pokud máte jakékoli dotazy, neváhejte nás kontaktovat na info@lokopolis.cz.</p>
  `, settings);
}

export function orderShipped(order: any, settings?: Record<string, any>): string {
  const introText = (typeof settings?.email_order_shipped_intro === "string")
    ? settings.email_order_shipped_intro
    : "Vaše objednávka byla odeslána! 📦";

  const email = order.billing_email || order.guest_email || "";
  const invoiceLink = order.id && email ? invoiceUrl(order.id, email) : "";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">${esc(introText)}</h2>
    <p>Objednávka <strong style="color:#f0a030;">${esc(order.order_number)}</strong> je na cestě k vám.</p>
    
    ${order.tracking_number ? `
    <div style="margin:20px 0;padding:20px;background:#16162b;border-radius:8px;border-left:3px solid #8b5cf6;">
      <strong style="color:#f0a030;">📦 Sledování zásilky</strong><br><br>
      <span style="color:#ccc;">Číslo zásilky:</span>
      <span style="color:#f0a030;font-weight:700;font-size:16px;"> ${esc(order.tracking_number)}</span>
      ${order.tracking_url ? `<br><br><a href="${esc(order.tracking_url)}" style="display:inline-block;padding:10px 24px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Sledovat zásilku →</a>` : ""}
    </div>` : `
    <div style="margin:20px 0;padding:20px;background:#16162b;border-radius:8px;">
      <span style="color:#ccc;">Zásilka byla předána přepravci.</span>
    </div>`}

    ${order.pickup_point_name
      ? `<div style="margin:16px 0;color:#ccc;">
          <strong style="color:#f0a030;">📍 Výdejní místo${order.pickup_point_carrier ? ` (${esc(order.pickup_point_carrier)})` : ""}:</strong><br>
          ${esc(order.pickup_point_name)}<br>
          ${order.pickup_point_address ? esc(order.pickup_point_address) : ""}
        </div>`
      : `<div style="margin:16px 0;color:#ccc;">
          <strong style="color:#f0a030;">Doručovací adresa:</strong><br>
          ${esc(order.shipping_name || order.billing_name)}<br>
          ${order.shipping_street || order.billing_street ? esc(order.shipping_street || order.billing_street) + "<br>" : ""}
          ${esc(order.shipping_city || order.billing_city || "")} ${esc(order.shipping_zip || order.billing_zip || "")}
        </div>`
    }

    ${invoiceLink ? `
    <div style="margin:16px 0;text-align:center;">
      <a href="${esc(invoiceLink)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">📄 Stáhnout fakturu</a>
    </div>` : ""}

    <p style="margin-top:24px;color:#888;">Předpokládaná doba doručení je obvykle 1–3 pracovní dny.</p>
    <p style="color:#888;">Pokud máte jakékoli dotazy, kontaktujte nás na info@lokopolis.cz.</p>
  `, settings);
}

export function newOrderAdmin(order: any, settings?: Record<string, any>): string {
  const customerEmail = order.billing_email || order.email || "";
  const customerName = order.billing_name || order.name || "Neznámý";
  const totalAmount = Number(order.total_price || order.price);

  // Delivery block — pickup point has priority
  const adminDeliveryBlock = order.pickup_point_name
    ? `<div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
        <strong style="color:#f0a030;">📍 Výdejní místo${order.pickup_point_carrier ? ` (${esc(order.pickup_point_carrier)})` : ""}</strong><br>
        <span style="color:#ccc;">${esc(order.pickup_point_name)}</span><br>
        ${order.pickup_point_address ? `<span style="color:#ccc;">${esc(order.pickup_point_address)}</span>` : ""}
      </div>`
    : order.shipping_name
      ? addressBlock("Doručovací adresa", order, "shipping")
      : "";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">🛒 Nová objednávka ${esc(order.order_number)}</h2>
    
    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
      <strong style="color:#f0a030;">Zákazník</strong><br>
      ${order.billing_company ? `<span style="color:#ccc;font-weight:700;">${esc(order.billing_company)}</span><br>` : ""}
      <span style="color:#ccc;">${esc(customerName)}</span><br>
      <span style="color:#ccc;">${esc(customerEmail)}</span>
      ${order.billing_phone ? `<br><span style="color:#ccc;">Tel: ${esc(order.billing_phone)}</span>` : ""}
      ${order.billing_ico ? `<br><span style="color:#ccc;">IČO: ${esc(order.billing_ico)}</span>` : ""}
      ${order.billing_dic ? `<br><span style="color:#ccc;">DIČ: ${esc(order.billing_dic)}</span>` : ""}
      ${!order.user_id ? `<br><span style="color:#f59e0b;font-size:12px;">⚠️ Neregistrovaný zákazník</span>` : ""}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr style="background:#16162b;">
        <th style="padding:10px 8px;text-align:left;color:#888;font-size:13px;">Produkt</th>
        <th style="padding:10px 8px;text-align:center;color:#888;font-size:13px;">Ks</th>
        <th style="padding:10px 8px;text-align:right;color:#888;font-size:13px;">Cena</th>
      </tr>
      ${itemRows(order)}
    </table>

    ${order.coupon_discount > 0 ? `<div style="color:#22c55e;font-size:14px;margin:4px 16px;">Sleva (${esc(order.coupon_code)}): -${formatPrice(order.coupon_discount)}</div>` : ""}
    ${order.loyalty_discount > 0 ? `<div style="color:#a855f7;font-size:14px;margin:4px 16px;">Věrnostní sleva: -${formatPrice(order.loyalty_discount)}</div>` : ""}

    <div style="margin:8px 16px;font-size:14px;color:#ccc;">
      ${order.shipping_method_name ? `🚚 Doprava: ${esc(order.shipping_method_name)}${order.shipping_price > 0 ? ` — ${formatPrice(order.shipping_price)}` : " — zdarma"}<br>` : (order.shipping_price > 0 ? `🚚 Doprava: ${formatPrice(order.shipping_price)}<br>` : "")}
      ${order.payment_method_name ? `💳 Platba: ${esc(order.payment_method_name)}${order.payment_surcharge > 0 ? ` — příplatek ${formatPrice(order.payment_surcharge)}` : ""}<br>` : `💳 Platba: ${esc(order.payment_method || "neuvedeno")}<br>`}
    </div>

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f0a030;">
      <strong style="font-size:18px;color:#f0a030;">Celkem: ${formatPrice(totalAmount)}</strong>
    </div>

    ${adminDeliveryBlock}
    ${addressBlock("Fakturační adresa", order, "billing")}

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/admin/shop?tab=orders" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Otevřít objednávky →</a>
    </div>
  `, settings);
}

export function welcomeEmail(username: string, settings?: Record<string, any>): string {
  const introText = (typeof settings?.email_welcome_intro === "string")
    ? settings.email_welcome_intro
    : "Vítejte na Lokopolis! 🚂";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">${esc(introText)}</h2>
    <p>Ahoj <strong style="color:#f0a030;">${esc(username)}</strong>,</p>
    <p>Děkujeme za registraci v komunitě Lokopolis — místě pro všechny nadšence do modelové železnice.</p>
    
    <div style="margin:24px 0;padding:20px;background:#16162b;border-radius:8px;">
      <strong style="color:#f0a030;">Co vás u nás čeká?</strong><br><br>
      <span style="color:#ccc;">🚂 Články a návody od zkušených modelářů</span><br>
      <span style="color:#ccc;">📸 Galerie kolejišť a modelů</span><br>
      <span style="color:#ccc;">💬 Fórum pro diskuze s ostatními</span><br>
      <span style="color:#ccc;">🛒 E-shop s modely a příslušenstvím</span><br>
      <span style="color:#ccc;">📥 Ke stažení: kolejové plány, STL modely a další</span><br>
      <span style="color:#ccc;">⭐ Věrnostní program s odměnami za aktivitu</span>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="https://lokopolis.cz" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Prozkoumat Lokopolis →</a>
    </div>

    <p style="color:#888;">Pokud máte jakékoli dotazy, neváhejte nás kontaktovat na info@lokopolis.cz.</p>
  `, settings);
}

// ─── Escrow templates ────────────────────────────────────────────────────────

export function escrowCreated(buyer: any, seller: any, listing: any, transaction: any, bankAccount: string, bankIban: string, settings?: Record<string, any>): string {
  const vs = transaction.payment_reference?.replace(/\D/g, "") || "";
  const iban = bankIban || (bankAccount ? czechToIBAN(bankAccount) : "");
  const qrUrl = vs && iban ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`SPD*1.0*ACC:${iban}*AM:${Number(transaction.amount).toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:Escrow ${transaction.payment_reference}`)}` : "";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">🛡️ Bezpečná platba vytvořena</h2>
    <p>Dobrý den, <strong style="color:#f0a030;">${esc(buyer.display_name || buyer.username)}</strong>,</p>
    <p>vaše bezpečná platba za inzerát <strong>"${esc(listing.title)}"</strong> od prodejce <strong>${esc(seller.display_name || seller.username)}</strong> byla vytvořena.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f0a030;">
      <strong style="font-size:18px;color:#f0a030;">Celkem: ${formatPrice(Number(transaction.amount))}</strong>
      <br><span style="color:#888;font-size:13px;">z toho provize: ${formatPrice(Number(transaction.commission_amount))}</span>
    </div>

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
      <strong style="color:#f0a030;">💳 Platební údaje</strong><br>
      <span style="color:#ccc;">Variabilní symbol: <strong>${esc(vs)}</strong></span><br>
      <span style="color:#ccc;">Částka: <strong>${formatPrice(Number(transaction.amount))}</strong></span><br>
      <span style="color:#ccc;">Číslo účtu: <strong>${esc(bankAccount || iban)}</strong></span>
      ${qrUrl ? `<br><br><img src="${qrUrl}" alt="QR platba" width="180" height="180" style="border-radius:8px;" />
      <br><span style="color:#888;font-size:12px;">Naskenujte QR kód v bankovní aplikaci</span>` : ""}
    </div>

    <p style="color:#ccc;">Po přijetí platby bude prodejce vyzván k odeslání zboží. Peníze mu budou uvolněny až po vašem potvrzení doručení.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Zobrazit transakci →</a>
    </div>
  `, settings);
}

export function escrowPaid(seller: any, listing: any, transaction: any, shippingDeadlineDays: number, settings?: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">💰 Platba přijata — odešlete zboží</h2>
    <p>Dobrý den, <strong style="color:#f0a030;">${esc(seller.display_name || seller.username)}</strong>,</p>
    <p>kupující zaplatil za váš inzerát <strong>"${esc(listing.title)}"</strong> přes Bezpečnou platbu.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #22c55e;">
      <strong style="color:#22c55e;">✅ Platba potvrzena</strong><br>
      <span style="color:#ccc;">Částka: <strong>${formatPrice(Number(transaction.amount))}</strong></span><br>
      <span style="color:#ccc;">Vaše výplata po provizi: <strong>${formatPrice(Number(transaction.seller_payout))}</strong></span>
    </div>

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f59e0b;">
      <strong style="color:#f59e0b;">⏰ Odešlete zboží do ${shippingDeadlineDays} dnů</strong><br>
      <span style="color:#ccc;">Po odeslání zadejte číslo zásilky v detailu transakce.</span>
    </div>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Zadat tracking →</a>
    </div>
  `, settings);
}

export function escrowPaidBuyer(buyer: any, listing: any, transaction: any, shippingDeadlineDays: number, settings?: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">✅ Vaše platba byla připsána</h2>
    <p>Dobrý den, <strong style="color:#f0a030;">${esc(buyer.display_name || buyer.username)}</strong>,</p>
    <p>vaše platba za inzerát <strong>"${esc(listing.title)}"</strong> byla úspěšně připsána na escrow účet.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #22c55e;">
      <strong style="color:#22c55e;">✅ Platba potvrzena</strong><br>
      <span style="color:#ccc;">Částka: <strong>${formatPrice(Number(transaction.amount))}</strong></span><br>
      <span style="color:#ccc;">Reference: <strong>${esc(transaction.payment_reference)}</strong></span>
    </div>

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #3b82f6;">
      <strong style="color:#3b82f6;">📦 Co bude dál?</strong><br>
      <span style="color:#ccc;">Prodávající byl vyzván k odeslání zboží do <strong>${shippingDeadlineDays} dnů</strong>.</span><br>
      <span style="color:#ccc;">Jakmile zboží odešle a zadá tracking číslo, dostanete další upozornění.</span>
    </div>

    <p style="color:#999;font-size:13px;margin-top:16px;">Peníze zůstávají v bezpečné úschově, dokud nepotvrdíte přijetí zboží.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Zobrazit transakci →</a>
    </div>
  `, settings);
}

export function escrowShipped(buyer: any, listing: any, transaction: any, settings?: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">📦 Zboží odesláno</h2>
    <p>Dobrý den, <strong style="color:#f0a030;">${esc(buyer.display_name || buyer.username)}</strong>,</p>
    <p>prodejce odeslal zboží z inzerátu <strong>"${esc(listing.title)}"</strong>.</p>

    ${transaction.tracking_number ? `
    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #8b5cf6;">
      <strong style="color:#f0a030;">📦 Sledování zásilky</strong><br>
      <span style="color:#ccc;">Číslo zásilky: <strong>${esc(transaction.tracking_number)}</strong></span>
      ${transaction.carrier ? `<br><span style="color:#ccc;">Dopravce: ${esc(transaction.carrier)}</span>` : ""}
    </div>` : ""}

    <p style="color:#ccc;">Až zboží obdržíte, potvrďte prosím přijetí v detailu transakce. Pokud nepotvrdíte do stanovené lhůty, peníze budou automaticky uvolněny prodejci.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Potvrdit přijetí →</a>
    </div>
  `, settings);
}

export function escrowDeliveryReminder(buyer: any, transaction: any, daysLeft: number, settings?: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">⏰ Potvrďte přijetí zboží</h2>
    <p>Dobrý den, <strong style="color:#f0a030;">${esc(buyer.display_name || buyer.username)}</strong>,</p>
    <p>zásilka z vaší bezpečné platby <strong>${esc(transaction.payment_reference)}</strong> byla odeslána. Potvrďte prosím přijetí zboží.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f59e0b;">
      <strong style="color:#f59e0b;">⏰ Zbývá ${daysLeft} dní</strong><br>
      <span style="color:#ccc;">Pokud nepotvrdíte přijetí, peníze budou automaticky uvolněny prodejci.</span>
    </div>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Potvrdit přijetí →</a>
    </div>
  `, settings);
}

export function escrowCompleted(seller: any, transaction: any, settings?: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">✅ Peníze uvolněny</h2>
    <p>Dobrý den, <strong style="color:#f0a030;">${esc(seller.display_name || seller.username)}</strong>,</p>
    <p>kupující potvrdil přijetí zboží z bezpečné platby <strong>${esc(transaction.payment_reference)}</strong>.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #22c55e;">
      <strong style="color:#22c55e;">💰 Výplata: ${formatPrice(Number(transaction.seller_payout))}</strong><br>
      <span style="color:#888;font-size:13px;">Celková cena: ${formatPrice(Number(transaction.amount))} · Provize: ${formatPrice(Number(transaction.commission_amount))}</span>
    </div>

    <p style="color:#ccc;">Výplata bude odeslána na váš účet v nejbližším možném termínu.</p>
  `, settings);
}

export function escrowDisputed(seller: any, buyer: any, dispute: any, transaction: any, settings?: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:#ef4444;margin:0 0 20px;">⚠️ Otevřen spor</h2>
    <p>U bezpečné platby <strong>${esc(transaction.payment_reference)}</strong> byl otevřen spor.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #ef4444;">
      <strong style="color:#ef4444;">Důvod sporu:</strong><br>
      <span style="color:#ccc;">${esc(dispute.reason)}</span>
    </div>

    <p style="color:#ccc;">Administrátor Lokopolis spor posoudí a rozhodne o dalším postupu. O výsledku budete informováni e-mailem.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Zobrazit transakci →</a>
    </div>
  `, settings);
}

export function escrowResolved(buyer: any, seller: any, dispute: any, resolution: string, transaction: any, settings?: Record<string, any>): string {
  const resolutionLabels: Record<string, string> = {
    resolved_buyer: "ve prospěch kupujícího — peníze budou vráceny",
    resolved_seller: "ve prospěch prodávajícího — peníze budou uvolněny",
    resolved_split: "kompromis — částka bude rozdělena",
  };
  const label = resolutionLabels[dispute.status] || dispute.status;

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">⚖️ Spor vyřešen</h2>
    <p>Spor u bezpečné platby <strong>${esc(transaction.payment_reference)}</strong> byl rozhodnut.</p>

    <div style="margin:20px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #22c55e;">
      <strong style="color:#22c55e;">Rozhodnutí: ${esc(label)}</strong>
      ${resolution ? `<br><br><span style="color:#ccc;">${esc(resolution)}</span>` : ""}
    </div>

    <p style="color:#ccc;">Pokud máte dotazy, kontaktujte nás na info@lokopolis.cz.</p>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/bazar/transakce/${esc(transaction.id)}" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Zobrazit transakci →</a>
    </div>
  `, settings);
}
