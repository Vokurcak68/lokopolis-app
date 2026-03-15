/**
 * DPH výpočty — ceny v DB jsou S DPH (B2C)
 */

export const VAT_RATES = [
  { value: 21, label: "21 % (základní)" },
  { value: 12, label: "12 % (snížená)" },
  { value: 0, label: "0 % (osvobozeno)" },
] as const;

/** Základ z ceny s DPH */
export function priceWithoutVat(priceWithVat: number, vatRate: number): number {
  if (vatRate <= 0) return priceWithVat;
  return Math.round((priceWithVat / (1 + vatRate / 100)) * 100) / 100;
}

/** DPH z ceny s DPH */
export function vatAmount(priceWithVat: number, vatRate: number): number {
  return Math.round((priceWithVat - priceWithoutVat(priceWithVat, vatRate)) * 100) / 100;
}

/** Formátovaná cena */
export function formatPrice(price: number): string {
  return price.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Kč";
}

/** Rekapitulace DPH — seskupení podle sazby */
export interface VatSummaryRow {
  rate: number;
  base: number;    // základ
  vat: number;     // DPH
  total: number;   // s DPH
}

export function calculateVatSummary(
  items: { totalPrice: number; vatRate: number }[],
  shippingPrice: number,
  shippingVatRate: number,
  paymentSurcharge?: number,
): { rows: VatSummaryRow[]; totalBase: number; totalVat: number; totalWithVat: number } {
  const byRate: Record<number, { base: number; vat: number; total: number }> = {};

  for (const item of items) {
    const rate = item.vatRate;
    if (!byRate[rate]) byRate[rate] = { base: 0, vat: 0, total: 0 };
    byRate[rate].total += item.totalPrice;
    byRate[rate].base += priceWithoutVat(item.totalPrice, rate);
    byRate[rate].vat += vatAmount(item.totalPrice, rate);
  }

  // Doprava
  if (shippingPrice > 0) {
    const rate = shippingVatRate;
    if (!byRate[rate]) byRate[rate] = { base: 0, vat: 0, total: 0 };
    byRate[rate].total += shippingPrice;
    byRate[rate].base += priceWithoutVat(shippingPrice, rate);
    byRate[rate].vat += vatAmount(shippingPrice, rate);
  }

  // Příplatek za platbu (21% default)
  if (paymentSurcharge && paymentSurcharge > 0) {
    const rate = 21;
    if (!byRate[rate]) byRate[rate] = { base: 0, vat: 0, total: 0 };
    byRate[rate].total += paymentSurcharge;
    byRate[rate].base += priceWithoutVat(paymentSurcharge, rate);
    byRate[rate].vat += vatAmount(paymentSurcharge, rate);
  }

  const rows: VatSummaryRow[] = Object.entries(byRate)
    .map(([rateStr, vals]) => ({
      rate: parseInt(rateStr),
      base: Math.round(vals.base * 100) / 100,
      vat: Math.round(vals.vat * 100) / 100,
      total: Math.round(vals.total * 100) / 100,
    }))
    .sort((a, b) => b.rate - a.rate);

  const totalBase = rows.reduce((s, r) => s + r.base, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);
  const totalWithVat = rows.reduce((s, r) => s + r.total, 0);

  return {
    rows,
    totalBase: Math.round(totalBase * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalWithVat: Math.round(totalWithVat * 100) / 100,
  };
}
