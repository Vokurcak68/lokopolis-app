"use client";

import { useState } from "react";
import type { ShopProduct } from "@/types/database";

interface OrderModalProps {
  product: ShopProduct;
  onClose: () => void;
  onSuccess: (orderNumber: string) => void;
}

// Simple QR code SVG generator for Czech SPD format
function generateQRCodeSVG(data: string): string {
  // This is a placeholder — we render the SPD string as text
  // In production, use a proper QR library
  // For now we show payment info text
  return data;
}

export default function OrderModal({ product, onClose, onSuccess }: OrderModalProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; spdString: string } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Chyba při vytváření objednávky");
      }

      const orderNum = data.orderNumber as string;
      const vs = orderNum.replace(/[^0-9]/g, "");
      const spdString = `SPD*1.0*ACC:CZ1234567890/0100*AM:${product.price}*CC:CZK*MSG:${orderNum}*X-VS:${vs}`;

      setOrderResult({ orderNumber: orderNum, spdString });
      onSuccess(orderNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neočekávaná chyba");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "32px",
        }}
      >
        {!orderResult ? (
          <>
            {/* Order form */}
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              🛒 Objednávka
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "24px" }}>
              Potvrďte objednávku produktu
            </p>

            {/* Product summary */}
            <div
              style={{
                background: "var(--bg-page)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
                {product.title}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)" }}>
                  {product.price.toLocaleString("cs-CZ")} Kč
                </span>
                {product.original_price && product.original_price > product.price && (
                  <span style={{ fontSize: "14px", color: "var(--text-dimmer)", textDecoration: "line-through" }}>
                    {product.original_price.toLocaleString("cs-CZ")} Kč
                  </span>
                )}
              </div>
            </div>

            {/* Notes */}
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-body)", marginBottom: "8px" }}>
              Poznámka k objednávce (volitelné)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Např. preferovaný formát, dotaz..."
              rows={3}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                resize: "vertical",
                outline: "none",
                marginBottom: "20px",
              }}
            />

            {error && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#ef4444", fontSize: "13px", marginBottom: "16px" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: submitting ? "var(--border)" : "var(--accent)",
                  border: "none",
                  borderRadius: "10px",
                  color: "var(--accent-text-on)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Odesílám..." : "Odeslat objednávku"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Payment instructions */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                Objednávka vytvořena!
              </h2>
              <p style={{ fontSize: "15px", color: "var(--accent)", fontWeight: 600 }}>
                {orderResult.orderNumber}
              </p>
            </div>

            <div
              style={{
                background: "var(--bg-page)",
                border: "1px solid var(--accent-border)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                💳 Platební údaje
              </h3>

              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Číslo účtu</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>CZ1234567890/0100</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Částka</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--accent)" }}>
                    {product.price.toLocaleString("cs-CZ")} Kč
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Variabilní symbol</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {orderResult.orderNumber.replace(/[^0-9]/g, "")}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Zpráva pro příjemce</div>
                  <div style={{ fontSize: "14px", color: "var(--text-body)" }}>
                    {orderResult.orderNumber}
                  </div>
                </div>
              </div>
            </div>

            {/* QR payment string */}
            <div
              style={{
                background: "var(--bg-page)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "13px", color: "var(--text-dimmer)", marginBottom: "8px" }}>
                📱 QR platba (SPD formát)
              </div>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "var(--text-dim)",
                  wordBreak: "break-all",
                  padding: "8px",
                  background: "var(--bg-card)",
                  borderRadius: "6px",
                }}
              >
                {generateQRCodeSVG(orderResult.spdString)}
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-dim)", textAlign: "center", marginBottom: "20px", lineHeight: 1.6 }}>
              Po přijetí platby vám odemkneme stažení produktu.
              Obvykle do 24 hodin. Potvrzení obdržíte emailem.
            </p>

            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--accent)",
                border: "none",
                borderRadius: "10px",
                color: "var(--accent-text-on)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Rozumím, zavřít
            </button>
          </>
        )}
      </div>
    </div>
  );
}
