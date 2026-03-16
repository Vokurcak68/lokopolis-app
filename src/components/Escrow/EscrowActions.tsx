"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EscrowTransaction } from "@/types/database";
import DisputeForm from "./DisputeForm";

interface EscrowActionsProps {
  transaction: EscrowTransaction;
  role: "buyer" | "seller" | "admin";
  onUpdate: () => void;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function apiCall(path: string, body: Record<string, unknown>) {
  const token = await getToken();
  const res = await fetch(`/api/escrow/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Chyba");
  return data;
}

export default function EscrowActions({ transaction, role, onUpdate }: EscrowActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showShipForm, setShowShipForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

  async function handleAction(path: string, body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setLoading(true);
    setError("");
    try {
      await apiCall(path, body);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }

  async function handleShip() {
    setLoading(true);
    setError("");
    try {
      await apiCall("ship", {
        escrow_id: transaction.id,
        tracking_number: trackingNumber || undefined,
        carrier: carrier || undefined,
      });
      setShowShipForm(false);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }

  const btnStyle = (bg: string, color: string, border: string): React.CSSProperties => ({
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
    border: `1px solid ${border}`,
    background: bg,
    color,
    transition: "opacity 0.2s",
  });

  return (
    <div>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {/* Admin: confirm payment */}
        {role === "admin" && transaction.status === "created" && (
          <button
            onClick={() => handleAction("confirm-payment", { escrow_id: transaction.id }, "Opravdu potvrdit přijetí platby?")}
            disabled={loading}
            style={btnStyle("rgba(34,197,94,0.15)", "#22c55e", "rgba(34,197,94,0.3)")}
          >
            💰 Potvrdit platbu
          </button>
        )}

        {/* Seller: ship */}
        {role === "seller" && transaction.status === "paid" && !showShipForm && (
          <button
            onClick={() => setShowShipForm(true)}
            disabled={loading}
            style={btnStyle("rgba(139,92,246,0.15)", "#8b5cf6", "rgba(139,92,246,0.3)")}
          >
            📦 Zadat tracking a odeslat
          </button>
        )}

        {/* Buyer: confirm delivery */}
        {role === "buyer" && (transaction.status === "shipped" || transaction.status === "delivered") && (
          <button
            onClick={() => handleAction("confirm-delivery", { escrow_id: transaction.id }, "Potvrzujete, že jste zboží obdrželi v pořádku?")}
            disabled={loading}
            style={btnStyle("rgba(34,197,94,0.15)", "#22c55e", "rgba(34,197,94,0.3)")}
          >
            ✅ Potvrdit přijetí
          </button>
        )}

        {/* Buyer: open dispute */}
        {role === "buyer" && (transaction.status === "shipped" || transaction.status === "delivered") && !showDisputeForm && (
          <button
            onClick={() => setShowDisputeForm(true)}
            disabled={loading}
            style={btnStyle("rgba(239,68,68,0.1)", "#ef4444", "rgba(239,68,68,0.3)")}
          >
            ⚠️ Otevřít spor
          </button>
        )}

        {/* Buyer/Admin: cancel */}
        {((role === "buyer" && ["created", "paid"].includes(transaction.status)) ||
          (role === "admin" && ["created", "paid", "shipped", "delivered", "disputed"].includes(transaction.status))) && (
          <button
            onClick={() => handleAction("cancel", { escrow_id: transaction.id }, "Opravdu chcete transakci zrušit?")}
            disabled={loading}
            style={btnStyle("rgba(107,114,128,0.1)", "#6b7280", "rgba(107,114,128,0.3)")}
          >
            ❌ Zrušit
          </button>
        )}
      </div>

      {/* Ship form */}
      {showShipForm && (
        <div style={{ marginTop: "16px", padding: "16px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>📦 Zadání odeslání</h4>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Číslo zásilky</label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Nepovinné"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-input, var(--bg-card))",
                color: "var(--text-primary)",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Dopravce</label>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Např. Česká pošta, Zásilkovna, PPL"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-input, var(--bg-card))",
                color: "var(--text-primary)",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleShip}
              disabled={loading}
              style={btnStyle("rgba(139,92,246,0.15)", "#8b5cf6", "rgba(139,92,246,0.3)")}
            >
              📦 Potvrdit odeslání
            </button>
            <button
              onClick={() => setShowShipForm(false)}
              style={btnStyle("transparent", "var(--text-muted)", "var(--border)")}
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Dispute form */}
      {showDisputeForm && (
        <DisputeForm
          escrowId={transaction.id}
          onClose={() => setShowDisputeForm(false)}
          onSubmitted={onUpdate}
        />
      )}
    </div>
  );
}
