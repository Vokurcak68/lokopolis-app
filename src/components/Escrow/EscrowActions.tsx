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
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [partialAmount, setPartialAmount] = useState("");

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

  async function handlePartialPayment() {
    const amount = Number(partialAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Zadejte platnou částku");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiCall("partial-payment", {
        escrow_id: transaction.id,
        partial_amount: amount,
      });
      setShowPartialForm(false);
      setPartialAmount("");
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

        {/* Admin: partial payment */}
        {role === "admin" && transaction.status === "created" && !showPartialForm && (
          <button
            onClick={() => setShowPartialForm(true)}
            disabled={loading}
            style={btnStyle("rgba(249,115,22,0.15)", "#f97316", "rgba(249,115,22,0.3)")}
          >
            ⚠️ Neúplná platba
          </button>
        )}

        {/* Admin: send payout */}
        {role === "admin" && (transaction.status === "completed" || transaction.status === "auto_completed") && (
          <button
            onClick={() => handleAction("send-payout", { escrow_id: transaction.id }, `Opravdu odeslat výplatu ${Number(transaction.seller_payout).toLocaleString("cs-CZ")} Kč prodávajícímu?`)}
            disabled={loading}
            style={btnStyle("rgba(139,92,246,0.15)", "#8b5cf6", "rgba(139,92,246,0.3)")}
          >
            💸 Odeslat výplatu
          </button>
        )}

        {/* Seller: confirm payout received */}
        {role === "seller" && transaction.status === "payout_sent" && (
          <button
            onClick={() => handleAction("confirm-payout", { escrow_id: transaction.id }, "Potvrzujete, že jste přijal/a výplatu na svůj účet?")}
            disabled={loading}
            style={btnStyle("rgba(34,197,94,0.15)", "#22c55e", "rgba(34,197,94,0.3)")}
          >
            ✅ Potvrdit přijetí výplaty
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
        {((role === "buyer" && ["created", "paid", "partial_paid"].includes(transaction.status)) ||
          (role === "admin" && ["created", "paid", "partial_paid", "shipped", "delivered", "disputed"].includes(transaction.status))) && (
          <button
            onClick={() => handleAction("cancel", { escrow_id: transaction.id }, "Opravdu chcete transakci zrušit?")}
            disabled={loading}
            style={btnStyle("rgba(107,114,128,0.1)", "#6b7280", "rgba(107,114,128,0.3)")}
          >
            ❌ Zrušit
          </button>
        )}
      </div>

      {/* Partial payment form */}
      {showPartialForm && (
        <div style={{ marginTop: "16px", padding: "16px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>⚠️ Neúplná platba</h4>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
            Požadovaná částka: <strong>{Number(transaction.amount).toLocaleString("cs-CZ")} Kč</strong>
          </p>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Přijatá částka (Kč)</label>
            <input
              type="number"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder="Např. 500"
              min="1"
              max={Number(transaction.amount) - 1}
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
          {partialAmount && Number(partialAmount) > 0 && Number(partialAmount) < Number(transaction.amount) && (
            <p style={{ fontSize: "13px", color: "#f97316", marginBottom: "12px" }}>
              Chybí doplatit: <strong>{(Number(transaction.amount) - Number(partialAmount)).toLocaleString("cs-CZ")} Kč</strong>
            </p>
          )}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handlePartialPayment}
              disabled={loading}
              style={btnStyle("rgba(249,115,22,0.15)", "#f97316", "rgba(249,115,22,0.3)")}
            >
              ⚠️ Oznámit neúplnou platbu
            </button>
            <button
              onClick={() => { setShowPartialForm(false); setPartialAmount(""); }}
              style={btnStyle("transparent", "var(--text-muted)", "var(--border)")}
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

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
