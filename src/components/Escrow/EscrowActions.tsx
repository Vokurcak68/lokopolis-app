"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { EscrowTransaction } from "@/types/database";
import DisputeForm from "./DisputeForm";
import ShippingProofUpload from "./ShippingProofUpload";

const CARRIERS = [
  { value: "ceska-posta", label: "Česká pošta" },
  { value: "zasilkovna", label: "Zásilkovna" },
  { value: "ppl", label: "PPL" },
  { value: "dpd", label: "DPD" },
  { value: "gls", label: "GLS" },
  { value: "balikovna", label: "Balíkovna" },
  { value: "wedo", label: "WE|DO (České pošta)" },
  { value: "intime", label: "InTime" },
  { value: "toptrans", label: "TopTrans" },
  { value: "geis", label: "Geis" },
  { value: "osobni-predani", label: "Osobní předání" },
  { value: "other", label: "Jiné..." },
];

interface EscrowActionsProps {
  transaction: EscrowTransaction;
  role: "buyer" | "seller" | "admin";
  roles?: ("buyer" | "seller" | "admin")[];
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

export default function EscrowActions({ transaction, role, roles, onUpdate }: EscrowActionsProps) {
  const effectiveRoles = roles || [role];
  const hasRole = (r: string) => effectiveRoles.includes(r as "buyer" | "seller" | "admin");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showShipForm, setShowShipForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [customCarrier, setCustomCarrier] = useState("");
  const [shipPhoto, setShipPhoto] = useState<File | null>(null);
  const [shipPhotoPreview, setShipPhotoPreview] = useState<string | null>(null);
  const shipPhotoRef = useRef<HTMLInputElement>(null);
  const [shippingProofFiles, setShippingProofFiles] = useState<File[]>([]);
  const [partialAmount, setPartialAmount] = useState("");
  const [adminNote, setAdminNote] = useState(transaction.admin_note || "");

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
    const effectiveCarrier = carrier === "other" ? customCarrier : CARRIERS.find(c => c.value === carrier)?.label || carrier;
    if (!trackingNumber.trim()) { setError("Vyplňte číslo zásilky"); return; }
    if (!carrier) { setError("Vyberte přepravce"); return; }
    if (carrier === "other" && !customCarrier.trim()) { setError("Vyplňte název přepravce"); return; }
    if (!shipPhoto) { setError("Nahrajte fotku potvrzení o odeslání"); return; }

    setLoading(true);
    setError("");
    try {
      // Upload main photo
      const ext = shipPhoto.name.split(".").pop() || "jpg";
      const path = `escrow/${transaction.id}/shipping_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("images").upload(path, shipPhoto);
      if (upErr) throw new Error("Nepodařilo se nahrát fotku: " + upErr.message);
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(path);

      // Upload shipping proof photos (optional)
      const shippingProofUrls: string[] = [];
      for (const proofFile of shippingProofFiles) {
        const proofExt = proofFile.name.split(".").pop() || "jpg";
        const proofPath = `escrow-proofs/${transaction.id}/proof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${proofExt}`;
        const { error: proofUpErr } = await supabase.storage.from("images").upload(proofPath, proofFile);
        if (proofUpErr) throw new Error("Nepodařilo se nahrát důkaz odeslání: " + proofUpErr.message);
        const { data: proofUrlData } = supabase.storage.from("images").getPublicUrl(proofPath);
        shippingProofUrls.push(proofUrlData.publicUrl);
      }

      await apiCall("ship", {
        escrow_id: transaction.id,
        tracking_number: trackingNumber.trim(),
        carrier: effectiveCarrier,
        shipping_photo: urlData.publicUrl,
        shipping_proof_urls: shippingProofUrls.length > 0 ? shippingProofUrls : undefined,
      });
      setShowShipForm(false);
      setShippingProofFiles([]);
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
        {hasRole("admin") && (transaction.status === "created" || transaction.status === "partial_paid") && (
          <button
            onClick={() => handleAction("confirm-payment", { escrow_id: transaction.id }, "Opravdu potvrdit přijetí platby?")}
            disabled={loading}
            style={btnStyle("rgba(34,197,94,0.15)", "#22c55e", "rgba(34,197,94,0.3)")}
          >
            💰 Potvrdit platbu
          </button>
        )}

        {/* Admin: partial payment */}
        {hasRole("admin") && (transaction.status === "created" || transaction.status === "partial_paid") && !showPartialForm && (
          <button
            onClick={() => setShowPartialForm(true)}
            disabled={loading}
            style={btnStyle("rgba(249,115,22,0.15)", "#f97316", "rgba(249,115,22,0.3)")}
          >
            ⚠️ Neúplná platba
          </button>
        )}

        {/* Admin: send payout */}
        {hasRole("admin") && (transaction.status === "completed" || transaction.status === "auto_completed") && (
          <button
            onClick={() => handleAction("send-payout", { escrow_id: transaction.id }, `Opravdu odeslat výplatu ${Number(transaction.seller_payout).toLocaleString("cs-CZ")} Kč prodávajícímu?`)}
            disabled={loading}
            style={btnStyle("rgba(139,92,246,0.15)", "#8b5cf6", "rgba(139,92,246,0.3)")}
          >
            💸 Odeslat výplatu
          </button>
        )}

        {/* Admin: add note */}
        {hasRole("admin") && !showNoteForm && (
          <button
            onClick={() => setShowNoteForm(true)}
            disabled={loading}
            style={btnStyle("rgba(107,114,128,0.1)", "#9ca3af", "rgba(107,114,128,0.3)")}
          >
            📝 Admin poznámka
          </button>
        )}

        {/* Seller: confirm payout received */}
        {hasRole("seller") && transaction.status === "payout_sent" && (
          <button
            onClick={() => handleAction("confirm-payout", { escrow_id: transaction.id }, "Potvrzujete, že jste přijal/a výplatu na svůj účet?")}
            disabled={loading}
            style={btnStyle("rgba(34,197,94,0.15)", "#22c55e", "rgba(34,197,94,0.3)")}
          >
            ✅ Potvrdit přijetí výplaty
          </button>
        )}

        {/* Seller: ship */}
        {hasRole("seller") && transaction.status === "paid" && !showShipForm && (
          <button
            onClick={() => setShowShipForm(true)}
            disabled={loading}
            style={btnStyle("rgba(139,92,246,0.15)", "#8b5cf6", "rgba(139,92,246,0.3)")}
          >
            📦 Zadat tracking a odeslat
          </button>
        )}

        {/* Buyer: confirm delivery */}
        {hasRole("buyer") && (transaction.status === "shipped" || transaction.status === "delivered") && (
          <button
            onClick={() => handleAction("confirm-delivery", { escrow_id: transaction.id }, "Potvrzujete, že jste zboží obdrželi v pořádku?")}
            disabled={loading}
            style={btnStyle("rgba(34,197,94,0.15)", "#22c55e", "rgba(34,197,94,0.3)")}
          >
            ✅ Potvrdit přijetí
          </button>
        )}

        {/* Buyer: open dispute */}
        {hasRole("buyer") && (transaction.status === "shipped" || transaction.status === "delivered") && !showDisputeForm && (
          <button
            onClick={() => setShowDisputeForm(true)}
            disabled={loading}
            style={btnStyle("rgba(239,68,68,0.1)", "#ef4444", "rgba(239,68,68,0.3)")}
          >
            ⚠️ Otevřít spor
          </button>
        )}

        {/* Buyer/Admin: cancel */}
        {((hasRole("buyer") && ["created", "paid", "partial_paid"].includes(transaction.status)) ||
          (hasRole("admin") && ["created", "paid", "partial_paid", "shipped", "delivered", "disputed"].includes(transaction.status))) && (
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
              onClick={() => {
                const amount = Number(partialAmount);
                if (isNaN(amount) || amount <= 0) { setError("Zadejte platnou částku"); return; }
                if (!confirm(`Opravdu oznámit neúplnou platbu ${amount.toLocaleString("cs-CZ")} Kč z ${Number(transaction.amount).toLocaleString("cs-CZ")} Kč?`)) return;
                handlePartialPayment();
              }}
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

          {/* Carrier select */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Přepravce *</label>
            <select
              value={carrier}
              onChange={(e) => { setCarrier(e.target.value); if (e.target.value !== "other") setCustomCarrier(""); }}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "var(--bg-input, var(--bg-card))",
                color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box",
              }}
            >
              <option value="">— Vyberte přepravce —</option>
              {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Custom carrier */}
          {carrier === "other" && (
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Název přepravce *</label>
              <input
                value={customCarrier}
                onChange={(e) => setCustomCarrier(e.target.value)}
                placeholder="Zadejte název přepravce"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "var(--bg-input, var(--bg-card))",
                  color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Tracking number */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Číslo zásilky *</label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Zadejte tracking číslo"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "var(--bg-input, var(--bg-card))",
                color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Shipping photo */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Fotka potvrzení o odeslání *</label>
            <input
              ref={shipPhotoRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setShipPhoto(file);
                  setShipPhotoPreview(URL.createObjectURL(file));
                }
              }}
              style={{ display: "none" }}
            />
            {shipPhotoPreview ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img src={shipPhotoPreview} alt="Potvrzení" style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "8px", border: "1px solid var(--border)" }} />
                <button
                  onClick={() => { setShipPhoto(null); setShipPhotoPreview(null); if (shipPhotoRef.current) shipPhotoRef.current.value = ""; }}
                  style={{ position: "absolute", top: "-6px", right: "-6px", width: "22px", height: "22px", borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, lineHeight: "22px", textAlign: "center" }}
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => shipPhotoRef.current?.click()}
                style={{
                  padding: "12px 20px", borderRadius: "8px", border: "2px dashed var(--border)",
                  background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px",
                }}
              >
                📷 Nahrát fotku potvrzení
              </button>
            )}
            <p style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "4px" }}>
              Např. podací lístek, potvrzení z appky přepravce, screenshot trackingu
            </p>
          </div>

          {/* Shipping proof upload (optional, for AI verification) */}
          <ShippingProofUpload
            carrier={carrier}
            files={shippingProofFiles}
            onFilesChange={setShippingProofFiles}
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                if (!confirm("Opravdu potvrdit odeslání zásilky? Po odeslání začne běžet lhůta pro kupujícího.")) return;
                handleShip();
              }}
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

      {/* Admin note form */}
      {showNoteForm && (
        <div style={{ marginTop: "16px", padding: "16px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>📝 Admin poznámka</h4>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Interní poznámka (vidí jen admin)..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-input, var(--bg-card))",
              color: "var(--text-primary)",
              fontSize: "14px",
              boxSizing: "border-box",
              resize: "vertical",
              marginBottom: "12px",
            }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  await apiCall("admin-note", { escrow_id: transaction.id, note: adminNote });
                  setShowNoteForm(false);
                  onUpdate();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Chyba");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={btnStyle("rgba(107,114,128,0.15)", "#9ca3af", "rgba(107,114,128,0.3)")}
            >
              💾 Uložit poznámku
            </button>
            <button
              onClick={() => setShowNoteForm(false)}
              style={btnStyle("transparent", "var(--text-muted)", "var(--border)")}
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Show existing admin note (admin only) */}
      {hasRole("admin") && transaction.admin_note && !showNoteForm && (
        <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "8px", background: "rgba(107,114,128,0.08)", border: "1px solid rgba(107,114,128,0.2)" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "4px", textTransform: "uppercase" }}>📝 Admin poznámka</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{transaction.admin_note}</div>
        </div>
      )}
    </div>
  );
}
