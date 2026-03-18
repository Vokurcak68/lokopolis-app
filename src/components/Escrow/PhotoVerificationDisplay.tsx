"use client";

import { useState } from "react";
import type { PhotoVerificationResult } from "@/types/database";

interface PhotoVerificationDisplayProps {
  shippingProofUrls: string[];
  photoVerification: PhotoVerificationResult | null;
  isAdmin: boolean;
}

export default function PhotoVerificationDisplay({
  shippingProofUrls,
  photoVerification,
  isAdmin,
}: PhotoVerificationDisplayProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!shippingProofUrls || shippingProofUrls.length === 0) return null;

  const score = photoVerification?.overall_score;

  function getScoreBadge() {
    if (score === undefined || score === null) return null;
    if (score >= 80) return { text: "✅ Foto potvrzení ověřeno", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" };
    if (score >= 40) return { text: "⚠️ Foto částečně ověřeno", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" };
    return { text: "❌ Foto vyžaduje kontrolu", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" };
  }

  const badge = getScoreBadge();

  return (
    <div style={{
      padding: "16px",
      borderRadius: "12px",
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      marginBottom: "24px",
    }}>
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
        📸 Důkaz odeslání
      </h3>

      {/* Thumbnail gallery */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
        {shippingProofUrls.map((url, i) => (
          <div
            key={i}
            onClick={() => setLightboxUrl(url)}
            style={{ cursor: "pointer" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Důkaz odeslání ${i + 1}`}
              style={{
                width: "120px",
                height: "90px",
                objectFit: "cover",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            />
          </div>
        ))}
      </div>

      {/* Verification badge */}
      {badge && (
        <div style={{
          display: "inline-block",
          padding: "6px 12px",
          borderRadius: "8px",
          background: badge.bg,
          border: `1px solid ${badge.border}`,
          color: badge.color,
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: isAdmin && photoVerification ? "12px" : "0",
        }}>
          {badge.text} ({score}/100)
        </div>
      )}

      {/* Admin detail view */}
      {isAdmin && photoVerification && (
        <div style={{
          marginTop: "12px",
          padding: "12px",
          borderRadius: "8px",
          background: "rgba(107,114,128,0.06)",
          border: "1px solid rgba(107,114,128,0.15)",
          fontSize: "12px",
        }}>
          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px", fontSize: "13px" }}>
            🔍 Detail AI ověření
          </div>

          {/* Matching summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
            <MatchItem label="Tracking číslo" match={photoVerification.matching.tracking_match} />
            <MatchItem label="Datum po platbě" match={photoVerification.matching.date_after_payment} />
            <MatchItem label="Město" match={photoVerification.matching.city_match} />
            <MatchItem label="PSČ" match={photoVerification.matching.zip_match} />
          </div>

          {/* Per-image results */}
          {photoVerification.results.map((r, i) => (
            <div key={i} style={{
              padding: "8px 10px",
              borderRadius: "6px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              marginBottom: "6px",
            }}>
              <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                Obrázek {i + 1}
                {r.is_legitimate_document
                  ? <span style={{ color: "#22c55e", marginLeft: "8px" }}>✅ Legitimní</span>
                  : <span style={{ color: "#ef4444", marginLeft: "8px" }}>❌ Podezřelý</span>
                }
                <span style={{ color: "var(--text-dimmer)", marginLeft: "8px" }}>
                  (jistota: {r.confidence}%)
                </span>
              </div>
              <div style={{ color: "var(--text-dimmer)", lineHeight: 1.6 }}>
                {r.tracking_number && <div>📦 Tracking: <strong style={{ color: "var(--text-body)" }}>{r.tracking_number}</strong></div>}
                {r.date && <div>📅 Datum: <strong style={{ color: "var(--text-body)" }}>{r.date}</strong></div>}
                {r.recipient_name && <div>👤 Příjemce: {r.recipient_name}</div>}
                {r.recipient_city && <div>🏙️ Město: {r.recipient_city}</div>}
                {r.recipient_zip && <div>📮 PSČ: {r.recipient_zip}</div>}
                {r.carrier && <div>🚚 Přepravce: {r.carrier}</div>}
                {r.notes && <div style={{ marginTop: "4px", fontStyle: "italic" }}>💬 {r.notes}</div>}
              </div>
            </div>
          ))}

          <div style={{ color: "var(--text-dimmer)", fontSize: "11px", marginTop: "6px" }}>
            Ověřeno: {new Date(photoVerification.verified_at).toLocaleString("cs-CZ")}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Důkaz odeslání"
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                borderRadius: "12px",
                objectFit: "contain",
              }}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                position: "absolute",
                top: "-12px",
                right: "-12px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 700,
                lineHeight: "32px",
                textAlign: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchItem({ label, match }: { label: string; match: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ fontSize: "14px" }}>{match ? "✅" : "❌"}</span>
      <span style={{ color: match ? "#22c55e" : "#ef4444" }}>{label}</span>
    </div>
  );
}
