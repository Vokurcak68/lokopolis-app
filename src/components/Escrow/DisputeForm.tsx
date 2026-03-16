"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface DisputeFormProps {
  escrowId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function DisputeForm({ escrowId, onClose, onSubmitted }: DisputeFormProps) {
  const [reason, setReason] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `escrow-disputes/${escrowId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, file, { contentType: file.type });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path);
        newUrls.push(publicUrl);
      }
    }

    setEvidenceUrls([...evidenceUrls, ...newUrls]);
    setUploading(false);
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Vyplňte důvod sporu");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/escrow/dispute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          escrow_id: escrowId,
          reason: reason.trim(),
          evidence_images: evidenceUrls,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba");

      onSubmitted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "16px", padding: "16px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <h4 style={{ fontSize: "15px", fontWeight: 600, color: "#ef4444", marginBottom: "12px" }}>⚠️ Otevřít spor</h4>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Důvod sporu *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Popište problém — co jste očekávali a co jste obdrželi..."
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--bg-input, var(--bg-card))",
            color: "var(--text-primary)",
            fontSize: "14px",
            resize: "vertical",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Fotky jako důkaz</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          style={{ fontSize: "13px", color: "var(--text-muted)" }}
        />
        {uploading && <span style={{ fontSize: "12px", color: "var(--text-dimmer)", marginLeft: "8px" }}>Nahrávám...</span>}

        {evidenceUrls.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            {evidenceUrls.map((url, i) => (
              <div
                key={i}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  position: "relative",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Důkaz ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
          }}
        >
          ⚠️ Odeslat spor
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
          }}
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}
