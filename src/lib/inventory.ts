import { StockMode } from "@/types/database";

export function getStockLabel(
  stock_mode: StockMode,
  stock_quantity: number | null,
  stock_reserved: number | null,
  stock_alert_threshold: number | null = 5
): { label: string; color: string; available: number | null } {
  if (stock_mode === "unlimited") {
    return { label: "Skladem", color: "var(--success)", available: null };
  }

  if (stock_mode === "preorder") {
    return { label: "Předobjednávka", color: "var(--info)", available: null };
  }

  // tracked
  const qty = stock_quantity ?? 0;
  const reserved = stock_reserved ?? 0;
  const available = qty - reserved;

  if (available <= 0) {
    return { label: "Vyprodáno", color: "var(--error)", available: 0 };
  }

  if (available <= (stock_alert_threshold ?? 5)) {
    return { label: `Poslední kusy! (${available})`, color: "var(--warning)", available };
  }

  return { label: `Skladem (${available} ks)`, color: "var(--success)", available };
}

export function canAddToCart(
  stock_mode: StockMode,
  stock_quantity: number | null,
  stock_reserved: number | null,
  requestedQty: number
): boolean {
  if (stock_mode === "unlimited" || stock_mode === "preorder") {
    return true;
  }

  const available = (stock_quantity ?? 0) - (stock_reserved ?? 0);
  return available >= requestedQty;
}
