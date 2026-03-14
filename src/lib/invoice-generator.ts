/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from "jspdf";
import type { ShopOrderWithDetails } from "@/types/database";

/**
 * Remove Czech diacritics for PDF rendering (jsPDF default fonts don't support them)
 */
function removeDiacritics(text: string): string {
  const map: Record<string, string> = {
    "á": "a", "č": "c", "ď": "d", "é": "e", "ě": "e", "í": "i",
    "ň": "n", "ó": "o", "ř": "r", "š": "s", "ť": "t", "ú": "u",
    "ů": "u", "ý": "y", "ž": "z",
    "Á": "A", "Č": "C", "Ď": "D", "É": "E", "Ě": "E", "Í": "I",
    "Ň": "N", "Ó": "O", "Ř": "R", "Š": "S", "Ť": "T", "Ú": "U",
    "Ů": "U", "Ý": "Y", "Ž": "Z",
  };
  return text.replace(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, (ch) => map[ch] || ch);
}

function formatPrice(price: number): string {
  return price.toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " Kc";
}

function formatDate(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${d}. ${m}. ${y}`;
}

export function generateInvoicePdf(order: ShopOrderWithDetails, settings?: Record<string, any>): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Supplier info from settings or defaults
  const company = settings?.company as Record<string, any> | undefined;
  const supplierName = company?.name || "Lokopolis.cz";
  const supplierEmail = company?.email || "info@lokopolis.cz";
  const supplierIco = company?.ico || "";
  const supplierDic = company?.dic || "";
  const supplierStreet = company?.street || "";
  const supplierCity = company?.city || "";
  const supplierZip = company?.zip || "";
  const supplierPhone = company?.phone || "";
  const supplierBankAccount = company?.bank_account || "XXXX/XXXX";

  const invoiceNote = (typeof settings?.invoice_note === "string") ? settings.invoice_note : "";
  const supplierNote = (typeof settings?.invoice_supplier_note === "string")
    ? settings.invoice_supplier_note
    : "Nejsme platci DPH.";

  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const accentColor: [number, number, number] = [240, 160, 48]; // #f0a030
  const textColor: [number, number, number] = [51, 51, 51]; // #333
  const mutedColor: [number, number, number] = [120, 120, 120];

  let y = margin;

  // === HEADER ===
  doc.setFillColor(...accentColor);
  doc.rect(0, 0, pageWidth, 12, "F");

  y = 24;
  doc.setTextColor(...accentColor);
  doc.setFontSize(28);
  doc.setFont("Helvetica", "bold");
  doc.text(removeDiacritics("FAKTURA"), margin, y);

  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");
  const orderNum = order.order_number || "";
  doc.text(removeDiacritics(`Cislo: ${orderNum}`), pageWidth - margin, y - 8, { align: "right" });

  const createdDate = new Date(order.created_at);
  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + 14);

  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(removeDiacritics(`Datum vystaveni: ${formatDate(createdDate)}`), pageWidth - margin, y - 2, { align: "right" });
  doc.text(removeDiacritics(`Datum splatnosti: ${formatDate(dueDate)}`), pageWidth - margin, y + 3, { align: "right" });

  y += 14;

  // Divider line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // === SUPPLIER & CUSTOMER ===
  const colWidth = contentWidth / 2 - 5;
  const leftX = margin;
  const rightX = margin + colWidth + 10;

  // Supplier
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.setFont("Helvetica", "normal");
  doc.text(removeDiacritics("Dodavatel"), leftX, y);

  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.setFont("Helvetica", "bold");
  doc.text(removeDiacritics(supplierName), leftX, y + 6);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  let sy = y + 12;
  if (supplierStreet) {
    doc.text(removeDiacritics(supplierStreet), leftX, sy);
    sy += 4.5;
  }
  const supplierCityZip = [supplierZip, supplierCity].filter(Boolean).join(" ");
  if (supplierCityZip) {
    doc.text(removeDiacritics(supplierCityZip), leftX, sy);
    sy += 4.5;
  }
  if (supplierIco) {
    doc.text(removeDiacritics(`IC: ${supplierIco}`), leftX, sy);
    sy += 4.5;
  }
  if (supplierDic) {
    doc.text(removeDiacritics(`DIC: ${supplierDic}`), leftX, sy);
    sy += 4.5;
  }
  doc.text(removeDiacritics(supplierEmail), leftX, sy);
  sy += 4.5;
  if (supplierPhone) {
    doc.text(removeDiacritics(`Tel: ${supplierPhone}`), leftX, sy);
    sy += 4.5;
  }

  // Customer
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.setFont("Helvetica", "normal");
  doc.text(removeDiacritics("Odberatel"), rightX, y);

  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.setFont("Helvetica", "bold");
  doc.text(removeDiacritics(order.billing_name || ""), rightX, y + 6);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  let cy = y + 12;
  if (order.billing_street) {
    doc.text(removeDiacritics(order.billing_street), rightX, cy);
    cy += 4.5;
  }
  const cityZip = [order.billing_zip, order.billing_city].filter(Boolean).join(" ");
  if (cityZip) {
    doc.text(removeDiacritics(cityZip), rightX, cy);
    cy += 4.5;
  }
  if (order.billing_country && order.billing_country !== "CZ") {
    doc.text(removeDiacritics(order.billing_country), rightX, cy);
    cy += 4.5;
  }
  if (order.billing_ico) {
    doc.text(removeDiacritics(`IC: ${order.billing_ico}`), rightX, cy);
    cy += 4.5;
  }
  if (order.billing_dic) {
    doc.text(removeDiacritics(`DIC: ${order.billing_dic}`), rightX, cy);
    cy += 4.5;
  }

  y = Math.max(sy + 6, cy + 6);

  // === ITEMS TABLE ===
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 8, "F");

  doc.setFontSize(8);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(...textColor);

  const col1 = margin + 2;
  const col2 = margin + 95;
  const col3 = margin + 115;
  const col5 = margin + contentWidth - 2;

  doc.text(removeDiacritics("Nazev"), col1, y + 5.5);
  doc.text(removeDiacritics("Mnozstvi"), col2, y + 5.5);
  doc.text(removeDiacritics("Cena/ks"), col3, y + 5.5);
  doc.text("Celkem", col5, y + 5.5, { align: "right" });

  y += 10;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);

  const items = order.items || [];
  for (const item of items) {
    const productName = item.product?.title || removeDiacritics("Produkt");
    const truncatedName = productName.length > 50 ? productName.substring(0, 47) + "..." : productName;

    doc.setTextColor(...textColor);
    doc.text(removeDiacritics(truncatedName), col1, y + 4);
    doc.text(String(item.quantity) + "x", col2, y + 4);
    doc.text(formatPrice(item.unit_price), col3, y + 4);
    doc.text(formatPrice(item.total_price), col5, y + 4, { align: "right" });

    y += 7;

    // Subtle line
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;
  }

  y += 6;

  // === SUMMARY ===
  const summaryX = margin + contentWidth - 80;
  const summaryValX = margin + contentWidth;

  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);

  // Subtotal
  doc.text(removeDiacritics("Mezisoucet:"), summaryX, y);
  doc.setTextColor(...textColor);
  doc.text(formatPrice(subtotal), summaryValX, y, { align: "right" });
  y += 5;

  // Shipping
  if (order.shipping_price > 0) {
    doc.setTextColor(...mutedColor);
    doc.text("Doprava:", summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(formatPrice(order.shipping_price), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Payment surcharge
  if (order.payment_surcharge > 0) {
    doc.setTextColor(...mutedColor);
    doc.text(removeDiacritics("Priplatek za platbu:"), summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(formatPrice(order.payment_surcharge), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Coupon discount
  if (order.coupon_discount > 0) {
    doc.setTextColor(...mutedColor);
    doc.text(removeDiacritics("Sleva (kupon):"), summaryX, y);
    doc.setTextColor(34, 197, 94);
    doc.text("-" + formatPrice(order.coupon_discount), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Loyalty discount
  if (order.loyalty_discount > 0) {
    doc.setTextColor(...mutedColor);
    doc.text(removeDiacritics("Vernostni sleva:"), summaryX, y);
    doc.setTextColor(34, 197, 94);
    doc.text("-" + formatPrice(order.loyalty_discount), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Total
  y += 2;
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y, summaryValX, y);
  y += 6;

  doc.setFontSize(13);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(...accentColor);
  const totalPrice = order.total_price ?? subtotal;
  doc.text("CELKEM:", summaryX, y);
  doc.text(formatPrice(totalPrice), summaryValX, y, { align: "right" });

  y += 16;

  // === PAYMENT INFO ===
  doc.setFillColor(250, 248, 243);
  doc.rect(margin, y - 4, contentWidth, 22, "F");
  doc.setDrawColor(230, 220, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 4, contentWidth, 22, "S");

  doc.setFontSize(10);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text(removeDiacritics("Platebni udaje"), margin + 4, y + 2);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  const vs = orderNum.replace(/\D/g, "");
  doc.text(removeDiacritics(`Cislo uctu: ${supplierBankAccount}    |    Variabilni symbol: ${vs}`), margin + 4, y + 9);
  doc.text(removeDiacritics(`Castka k uhrade: ${formatPrice(totalPrice)}`), margin + 4, y + 14);

  y += 28;

  // === INVOICE NOTE ===
  if (invoiceNote) {
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(removeDiacritics(invoiceNote), margin, y);
    y += 6;
  }

  // === FOOTER ===
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.setFont("Helvetica", "italic");
  doc.text(removeDiacritics(supplierNote || "Faktura slouzi jako danovy doklad."), margin, y);
  doc.text(removeDiacritics(`Vystaveno: ${formatDate(createdDate)}`), pageWidth - margin, y, { align: "right" });

  // Bottom accent bar
  doc.setFillColor(...accentColor);
  doc.rect(0, 285, pageWidth, 12, "F");

  return doc;
}
