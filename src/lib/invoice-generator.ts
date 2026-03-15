/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { ShopOrderWithDetails } from "@/types/database";
import { robotoRegularBase64 } from "@/lib/fonts/roboto-regular";
import { robotoBoldBase64 } from "@/lib/fonts/roboto-bold";
import { priceWithoutVat, vatAmount, calculateVatSummary, formatPrice as formatVatPrice } from "@/lib/vat";

// ── Helpers ──────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " Kč";
}

function formatDate(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${d}. ${m}. ${y}`;
}

/** Convert Czech bank account (e.g. 123456-1234567890/0100) to IBAN */
function czechToIBAN(account: string): string {
  const clean = account.replace(/\s/g, "");
  if (/^[A-Z]{2}\d{2}/.test(clean)) return clean;
  const match = clean.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!match) return account;
  const prefix = (match[1] || "").padStart(6, "0");
  const number = match[2].padStart(10, "0");
  const bankCode = match[3];
  const bban = bankCode + prefix + number;
  const numStr = bban + "123500";
  let remainder = 0;
  for (const ch of numStr) {
    remainder = (remainder * 10 + parseInt(ch)) % 97;
  }
  const checkDigits = (98 - remainder).toString().padStart(2, "0");
  return "CZ" + checkDigits + bban;
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  "bank-transfer": "Bankovní převod",
  "qr-payment": "QR platba",
  "cash-on-delivery": "Dobírka",
  "card": "Kartou online",
};

// ── Main generator ───────────────────────────────────────────────

export async function generateInvoicePdf(order: ShopOrderWithDetails, settings?: Record<string, any>): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Embed Roboto font (supports Czech diacritics) ──
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBoldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  // ── Supplier info ──
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
  // Plátce DPH = má DIČ
  const isVatPayer = !!supplierDic;

  let supplierNote: string;
  if (isVatPayer) {
    const customNote = (typeof settings?.invoice_supplier_note === "string") ? settings.invoice_supplier_note : "";
    const isDefaultNonVat = customNote.toLowerCase().includes("nejsme") && customNote.toLowerCase().includes("dph");
    supplierNote = isDefaultNonVat ? "Faktura slouží jako daňový doklad." : (customNote || "Faktura slouží jako daňový doklad.");
  } else {
    supplierNote = "Nejsme plátci DPH.";
  }

  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const accentColor: [number, number, number] = [240, 160, 48]; // #f0a030
  const textColor: [number, number, number] = [51, 51, 51];
  const mutedColor: [number, number, number] = [120, 120, 120];

  let y = 0;

  // === HEADER ===
  doc.setFillColor(...accentColor);
  doc.rect(0, 0, pageWidth, 12, "F");

  y = 15;

  // Badge logo (vlevo nahoře)
  const logoX = margin;
  const logoY = y;
  const logoW = 48;
  const logoH = 22;
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(1);
  doc.roundedRect(logoX, logoY, logoW, logoH, 3, 3, "S");

  // "· est. 2026 ·"
  doc.setFontSize(5.5);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(...accentColor);
  doc.text("· est. 2026 ·", logoX + logoW / 2, logoY + 5.5, { align: "center" });

  // "LOKO" (dark) + "POLIS" (accent)
  doc.setFontSize(18);
  doc.setFont("Roboto", "bold");
  const lokoText = "LOKO";
  const polisText = "POLIS";
  const lokoW = doc.getTextWidth(lokoText);
  const polisW = doc.getTextWidth(polisText);
  const fullLogoTextW = lokoW + polisW;
  const logoTextStartX = logoX + (logoW - fullLogoTextW) / 2;
  doc.setTextColor(...textColor);
  doc.text(lokoText, logoTextStartX, logoY + 14.5);
  doc.setTextColor(...accentColor);
  doc.text(polisText, logoTextStartX + lokoW, logoY + 14.5);

  // "modelová železnice"
  doc.setFontSize(5);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(...mutedColor);
  doc.text("modelová železnice", logoX + logoW / 2, logoY + 19.5, { align: "center" });

  // "FAKTURA" (vedle loga)
  y = logoY + 15;
  doc.setTextColor(...accentColor);
  doc.setFontSize(28);
  doc.setFont("Roboto", "bold");
  doc.text("FAKTURA", logoX + logoW + 12, y);

  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont("Roboto", "normal");
  const orderNum = order.order_number || "";
  doc.text(`Číslo: ${orderNum}`, pageWidth - margin, y - 8, { align: "right" });

  const createdDate = new Date(order.created_at);
  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + 14);

  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(`Datum vystavení: ${formatDate(createdDate)}`, pageWidth - margin, y - 2, { align: "right" });
  doc.text(`Datum splatnosti: ${formatDate(dueDate)}`, pageWidth - margin, y + 3, { align: "right" });

  y += 14;

  // Divider line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // === SUPPLIER & CUSTOMER & DELIVERY ===
  const colWidth = contentWidth / 3 - 4;
  const leftX = margin;
  const midX = margin + colWidth + 6;
  const rightX = margin + (colWidth + 6) * 2;

  // Helper: draw address block
  function drawAddressBlock(x: number, label: string, name: string, lines: string[], startY: number): number {
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.setFont("Roboto", "normal");
    doc.text(label, x, startY);

    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.setFont("Roboto", "bold");
    doc.text(name, x, startY + 6);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);

    let lineY = startY + 12;
    for (const line of lines) {
      if (line) {
        doc.text(line, x, lineY);
        lineY += 4.5;
      }
    }
    return lineY;
  }

  // Supplier
  const supplierLines: string[] = [];
  if (supplierStreet) supplierLines.push(supplierStreet);
  const supplierCityZip = [supplierZip, supplierCity].filter(Boolean).join(" ");
  if (supplierCityZip) supplierLines.push(supplierCityZip);
  if (supplierIco) supplierLines.push(`IČ: ${supplierIco}`);
  if (supplierDic) supplierLines.push(`DIČ: ${supplierDic}`);
  supplierLines.push(supplierEmail);
  if (supplierPhone) supplierLines.push(`Tel: ${supplierPhone}`);

  const sy = drawAddressBlock(leftX, "Dodavatel", supplierName, supplierLines, y);

  // Customer
  const customerLines: string[] = [];
  const hasCompany = !!order.billing_company;
  if (hasCompany && order.billing_name) customerLines.push(order.billing_name);
  if (order.billing_street) customerLines.push(order.billing_street);
  const cityZip = [order.billing_zip, order.billing_city].filter(Boolean).join(" ");
  if (cityZip) customerLines.push(cityZip);
  if (order.billing_country && order.billing_country !== "CZ") customerLines.push(order.billing_country);
  if (order.billing_ico) customerLines.push(`IČ: ${order.billing_ico}`);
  if (order.billing_dic) customerLines.push(`DIČ: ${order.billing_dic}`);

  const customerHeading = hasCompany ? order.billing_company! : (order.billing_name || "");
  const cy = drawAddressBlock(midX, "Odběratel", customerHeading, customerLines, y);

  // Delivery address
  let dy = cy;
  if ((order as any).pickup_point_name) {
    const carrierLabel = (order as any).pickup_point_carrier === "zasilkovna" ? "Zásilkovna" : "Balíkovna";
    const pickupLines: string[] = [];
    if ((order as any).pickup_point_address) pickupLines.push((order as any).pickup_point_address);
    dy = drawAddressBlock(rightX, `Výdejní místo (${carrierLabel})`, (order as any).pickup_point_name, pickupLines, y);
  } else if (order.shipping_street) {
    const deliveryName = order.shipping_name || order.billing_name || "";
    const deliveryLines: string[] = [];
    if ((order as any).shipping_company) deliveryLines.push((order as any).shipping_company);
    deliveryLines.push(order.shipping_street);
    const delCityZip = [order.shipping_zip, order.shipping_city].filter(Boolean).join(" ");
    if (delCityZip) deliveryLines.push(delCityZip);
    if (order.shipping_country && order.shipping_country !== "CZ") deliveryLines.push(order.shipping_country);

    dy = drawAddressBlock(rightX, "Dodací adresa", deliveryName, deliveryLines, y);
  }

  y = Math.max(sy + 6, cy + 6, dy + 6);

  // === PAYMENT METHOD & SHIPPING METHOD ===
  const paymentMethodSlug = order.payment_method || (order.payment as any)?.slug || "";
  const paymentMethodName = PAYMENT_METHOD_MAP[paymentMethodSlug] || (order.payment?.name) || paymentMethodSlug;
  const shippingMethodName = order.shipping?.name || "";

  if (paymentMethodName || shippingMethodName) {
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const infoParts: string[] = [];
    if (paymentMethodName) infoParts.push(`Způsob úhrady: ${paymentMethodName}`);
    if (shippingMethodName) infoParts.push(`Způsob dopravy: ${shippingMethodName}`);
    doc.text(infoParts.join("    |    "), margin, y);
    y += 8;
  }

  // === ITEMS TABLE ===
  const items = order.items || [];

  if (isVatPayer) {
    // ── DPH plátce: rozšířená tabulka se sloupci DPH ──
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 8, "F");

    doc.setFontSize(7);
    doc.setFont("Roboto", "bold");
    doc.setTextColor(...textColor);

    const tCol1 = margin + 2;                         // Název
    const tCol2 = margin + 72;                        // Ks
    const tCol3 = margin + 85;                        // Cena/ks bez DPH
    const tCol4 = margin + 113;                       // DPH %
    const tCol5 = margin + 127;                       // DPH
    const tCol6 = margin + contentWidth - 2;          // Celkem s DPH

    doc.text("Název", tCol1, y + 5.5);
    doc.text("Ks", tCol2, y + 5.5);
    doc.text("Cena/ks bez DPH", tCol3, y + 5.5);
    doc.text("DPH %", tCol4, y + 5.5);
    doc.text("DPH", tCol5, y + 5.5);
    doc.text("Celkem s DPH", tCol6, y + 5.5, { align: "right" });

    y += 10;

    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);

    for (const item of items) {
      const productName = item.product?.title || "Produkt";
      const truncatedName = productName.length > 38 ? productName.substring(0, 35) + "..." : productName;
      const itemVatRate = (item as any).vat_rate ?? 21;
      const unitWithoutVat = priceWithoutVat(item.unit_price, itemVatRate);
      const totalVatAmt = vatAmount(item.total_price, itemVatRate);

      doc.setTextColor(...textColor);
      doc.text(truncatedName, tCol1, y + 4);
      doc.text(String(item.quantity) + "x", tCol2, y + 4);
      doc.text(formatVatPrice(unitWithoutVat), tCol3, y + 4);
      doc.text(itemVatRate + " %", tCol4, y + 4);
      doc.text(formatVatPrice(totalVatAmt), tCol5, y + 4);
      doc.text(formatPrice(item.total_price), tCol6, y + 4, { align: "right" });

      y += 7;

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 1;
    }
  } else {
    // ── Neplátce DPH: jednoduchá tabulka (jako předtím) ──
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 8, "F");

    doc.setFontSize(8);
    doc.setFont("Roboto", "bold");
    doc.setTextColor(...textColor);

    const col1 = margin + 2;
    const col2 = margin + 95;
    const col3 = margin + 115;
    const col5 = margin + contentWidth - 2;

    doc.text("Název", col1, y + 5.5);
    doc.text("Množství", col2, y + 5.5);
    doc.text("Cena/ks", col3, y + 5.5);
    doc.text("Celkem", col5, y + 5.5, { align: "right" });

    y += 10;

    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);

    for (const item of items) {
      const productName = item.product?.title || "Produkt";
      const truncatedName = productName.length > 50 ? productName.substring(0, 47) + "..." : productName;

      doc.setTextColor(...textColor);
      doc.text(truncatedName, col1, y + 4);
      doc.text(String(item.quantity) + "x", col2, y + 4);
      doc.text(formatPrice(item.unit_price), col3, y + 4);
      doc.text(formatPrice(item.total_price), col5, y + 4, { align: "right" });

      y += 7;

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 1;
    }
  }

  y += 6;

  // === SUMMARY ===
  const summaryX = margin + contentWidth - 80;
  const summaryValX = margin + contentWidth;

  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);

  doc.text("Mezisoučet:", summaryX, y);
  doc.setTextColor(...textColor);
  doc.text(formatPrice(subtotal), summaryValX, y, { align: "right" });
  y += 5;

  if (order.shipping_price > 0) {
    doc.setTextColor(...mutedColor);
    doc.text("Doprava:", summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(formatPrice(order.shipping_price), summaryValX, y, { align: "right" });
    y += 5;
  }

  if (order.payment_surcharge > 0) {
    doc.setTextColor(...mutedColor);
    doc.text("Příplatek za platbu:", summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(formatPrice(order.payment_surcharge), summaryValX, y, { align: "right" });
    y += 5;
  }

  if (order.coupon_discount > 0) {
    doc.setTextColor(...mutedColor);
    doc.text("Sleva (kupón):", summaryX, y);
    doc.setTextColor(34, 197, 94);
    doc.text("-" + formatPrice(order.coupon_discount), summaryValX, y, { align: "right" });
    y += 5;
  }

  if (order.loyalty_discount > 0) {
    doc.setTextColor(...mutedColor);
    doc.text("Věrnostní sleva:", summaryX, y);
    doc.setTextColor(34, 197, 94);
    doc.text("-" + formatPrice(order.loyalty_discount), summaryValX, y, { align: "right" });
    y += 5;
  }

  const totalPrice = order.total_price ?? subtotal;

  // === DPH REKAPITULACE (pouze plátce DPH) ===
  if (isVatPayer) {
    y += 4;

    // Vypočítáme DPH summary z položek + doprava + příplatek
    const shippingVatRate = (order.shipping as any)?.vat_rate ?? 21;
    const vatSummaryItems = items.map(item => ({
      totalPrice: item.total_price,
      vatRate: (item as any).vat_rate ?? 21,
    }));
    const vatSummary = calculateVatSummary(
      vatSummaryItems,
      order.shipping_price || 0,
      shippingVatRate,
      order.payment_surcharge || 0,
    );

    // Rekapitulace DPH — mini tabulka
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.setTextColor(...textColor);
    doc.text("Rekapitulace DPH", summaryX, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont("Roboto", "normal");
    doc.setTextColor(...mutedColor);

    // Hlavička
    const vatLabelX = summaryX;
    const vatBaseX = summaryX + 25;
    const vatAmtX = summaryValX;

    doc.text("Sazba", vatLabelX, y);
    doc.text("Základ", vatBaseX, y);
    doc.text("DPH", vatAmtX, y, { align: "right" });
    y += 4;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(summaryX, y, summaryValX, y);
    y += 3;

    doc.setTextColor(...textColor);
    for (const row of vatSummary.rows) {
      doc.text(`${row.rate} %`, vatLabelX, y);
      doc.text(formatVatPrice(row.base), vatBaseX, y);
      doc.text(formatVatPrice(row.vat), vatAmtX, y, { align: "right" });
      y += 4;
    }

    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(summaryX, y, summaryValX, y);
    y += 5;

    // Celkem bez DPH
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text("Celkem bez DPH:", summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(formatVatPrice(vatSummary.totalBase), summaryValX, y, { align: "right" });
    y += 5;

    // Celkem DPH
    doc.setTextColor(...mutedColor);
    doc.text("Celkem DPH:", summaryX, y);
    doc.setTextColor(...textColor);
    doc.text(formatVatPrice(vatSummary.totalVat), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Total — CELKEM S DPH (nebo CELKEM pro neplátce)
  y += 2;
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y, summaryValX, y);
  y += 6;

  doc.setFontSize(13);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(...accentColor);
  doc.text(isVatPayer ? "CELKEM S DPH:" : "CELKEM:", summaryX, y);
  doc.text(formatPrice(totalPrice), summaryValX, y, { align: "right" });

  y += 16;

  // === PAYMENT INFO + QR CODE ===
  const vs = orderNum.replace(/\D/g, "");
  const iban = czechToIBAN(supplierBankAccount);

  // Generate QR code (SPD payment format)
  let qrDataUrl: string | null = null;
  try {
    const amount = (totalPrice ?? 0).toFixed(2);
    const spdString = `SPD*1.0*ACC:${iban}*AM:${amount}*CC:CZK*MSG:${orderNum}*X-VS:${vs}`;
    qrDataUrl = await QRCode.toDataURL(spdString, { width: 200, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    // QR generation failed — continue without it
  }

  const paymentBoxHeight = 28;
  const qrSize = 24;

  doc.setFillColor(250, 248, 243);
  doc.rect(margin, y - 4, contentWidth, paymentBoxHeight, "F");
  doc.setDrawColor(230, 220, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 4, contentWidth, paymentBoxHeight, "S");

  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(...textColor);
  doc.text("Platební údaje", margin + 4, y + 2);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  doc.text(`Číslo účtu: ${supplierBankAccount}    |    Variabilní symbol: ${vs}`, margin + 4, y + 9);
  doc.text(`Částka k úhradě: ${formatPrice(totalPrice)}`, margin + 4, y + 14);
  if (iban !== supplierBankAccount) {
    doc.text(`IBAN: ${iban}`, margin + 4, y + 19);
  }

  // QR code
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize - 2, y - 2, qrSize, qrSize);
  }

  y += paymentBoxHeight + 6;

  // === INVOICE NOTE ===
  if (invoiceNote) {
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(invoiceNote, margin, y);
    y += 6;
  }

  // === FOOTER ===
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.setFont("Roboto", "normal");
  doc.text(supplierNote, margin, y);
  doc.text(`Vystaveno: ${formatDate(createdDate)}`, pageWidth - margin, y, { align: "right" });

  // Bottom accent bar
  doc.setFillColor(...accentColor);
  doc.rect(0, 285, pageWidth, 12, "F");

  return doc;
}
