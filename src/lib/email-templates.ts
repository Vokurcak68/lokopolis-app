/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Shared wrapper ──────────────────────────────────────────────────────────

function emailWrapper(content: string): string {
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
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 32px;text-align:center;border-top:1px solid #2a2a4e;font-size:12px;color:#666;">
    <a href="https://lokopolis.cz" style="color:#f0a030;text-decoration:none;">lokopolis.cz</a>
    &nbsp;·&nbsp; info@lokopolis.cz
    <br>Tento e-mail byl odeslán automaticky, neodpovídejte na něj.
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
      <td style="padding:8px 0;border-bottom:1px solid #2a2a4e;color:#f0a030;text-align:right;">${formatPrice(Number(item.total_price || item.unit_price * item.quantity))}</td>
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
  if (!name && !street) return "";
  return `
    <div style="margin-top:16px;">
      <strong style="color:#f0a030;">${label}</strong><br>
      ${esc(name)}<br>
      ${street ? esc(street) + "<br>" : ""}
      ${city ? esc(city) : ""} ${zip ? esc(zip) : ""}
    </div>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function orderConfirmation(order: any): string {
  const shippingAddr = order.shipping_name
    ? addressBlock("Doručovací adresa", order, "shipping")
    : addressBlock("Fakturační adresa", order, "billing");

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">Děkujeme za vaši objednávku! 🎉</h2>
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
    ${order.shipping_price > 0 ? `<div style="color:#ccc;font-size:14px;margin:4px 0;">Doprava: ${formatPrice(order.shipping_price)}</div>` : ""}
    ${order.payment_surcharge > 0 ? `<div style="color:#ccc;font-size:14px;margin:4px 0;">Příplatek za platbu: ${formatPrice(order.payment_surcharge)}</div>` : ""}

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f0a030;">
      <strong style="font-size:18px;color:#f0a030;">Celkem: ${formatPrice(Number(order.total_price || order.price))}</strong>
    </div>

    ${order.payment_method === "bank_transfer" || order.payment_method === "bank-transfer"
      ? `<div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
          <strong style="color:#f0a030;">💳 Platební údaje</strong><br>
          <span style="color:#ccc;">Způsob platby: Bankovní převod</span><br>
          <span style="color:#ccc;">Variabilní symbol: ${esc(order.order_number?.replace(/\D/g, ""))}</span>
        </div>`
      : `<div style="margin:16px 0;color:#ccc;">Způsob platby: ${esc(order.payment_method || "")}</div>`
    }

    ${shippingAddr}
    ${addressBlock("Fakturační adresa", order, "billing")}

    <p style="margin-top:24px;color:#888;">O dalším průběhu objednávky vás budeme informovat e-mailem.</p>
  `);
}

export function orderStatusChanged(order: any, newStatus: string): string {
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

    <p style="color:#888;">Pokud máte jakékoli dotazy, neváhejte nás kontaktovat na info@lokopolis.cz.</p>
  `);
}

export function orderShipped(order: any): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">Vaše objednávka byla odeslána! 📦</h2>
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

    <div style="margin:16px 0;color:#ccc;">
      <strong style="color:#f0a030;">Doručovací adresa:</strong><br>
      ${esc(order.shipping_name || order.billing_name)}<br>
      ${order.shipping_street || order.billing_street ? esc(order.shipping_street || order.billing_street) + "<br>" : ""}
      ${esc(order.shipping_city || order.billing_city || "")} ${esc(order.shipping_zip || order.billing_zip || "")}
    </div>

    <p style="margin-top:24px;color:#888;">Předpokládaná doba doručení je obvykle 1–3 pracovní dny.</p>
    <p style="color:#888;">Pokud máte jakékoli dotazy, kontaktujte nás na info@lokopolis.cz.</p>
  `);
}

export function newOrderAdmin(order: any): string {
  const customerEmail = order.billing_email || order.email || "";
  const customerName = order.billing_name || order.name || "Neznámý";

  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">🛒 Nová objednávka ${esc(order.order_number)}</h2>
    
    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;">
      <strong style="color:#f0a030;">Zákazník</strong><br>
      <span style="color:#ccc;">${esc(customerName)}</span><br>
      <span style="color:#ccc;">${esc(customerEmail)}</span>
      ${order.billing_phone ? `<br><span style="color:#ccc;">Tel: ${esc(order.billing_phone)}</span>` : ""}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr style="background:#16162b;">
        <th style="padding:10px 8px;text-align:left;color:#888;font-size:13px;">Produkt</th>
        <th style="padding:10px 8px;text-align:center;color:#888;font-size:13px;">Ks</th>
        <th style="padding:10px 8px;text-align:right;color:#888;font-size:13px;">Cena</th>
      </tr>
      ${itemRows(order)}
    </table>

    <div style="margin:16px 0;padding:16px;background:#16162b;border-radius:8px;border-left:3px solid #f0a030;">
      <strong style="font-size:18px;color:#f0a030;">Celkem: ${formatPrice(Number(order.total_price || order.price))}</strong>
      <br><span style="color:#ccc;font-size:13px;">Platba: ${esc(order.payment_method || "neuvedeno")}</span>
    </div>

    ${addressBlock("Doručovací adresa", order, order.shipping_name ? "shipping" : "billing")}
    ${addressBlock("Fakturační adresa", order, "billing")}

    <div style="margin-top:24px;text-align:center;">
      <a href="https://lokopolis.cz/admin/shop" style="display:inline-block;padding:12px 28px;background:#f0a030;color:#1a1a2e;font-weight:700;border-radius:8px;text-decoration:none;">Otevřít admin panel →</a>
    </div>
  `);
}

export function welcomeEmail(username: string): string {
  return emailWrapper(`
    <h2 style="color:#f0a030;margin:0 0 20px;">Vítejte na Lokopolis! 🚂</h2>
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
  `);
}
