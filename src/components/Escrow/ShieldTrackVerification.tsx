"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface ShieldTrackCheck {
  name: string;
  status: "passed" | "warning" | "failed" | "pending";
  detail: string | null;
}

interface VerificationData {
  score: number;
  status: "verified" | "partial" | "failed" | "pending";
  checks: ShieldTrackCheck[];
  address_match: {
    city: boolean;
    zip: boolean;
  } | null;
  verified_at: string | null;
}

interface ApiResponse {
  available: boolean;
  verification?: VerificationData;
  error?: string;
}

const CHECK_STATUS_ICON: Record<string, string> = {
  passed: "✅",
  warning: "⚠️",
  failed: "❌",
  pending: "⏳",
};

const CHECK_NAME_CS: Record<string, string> = {
  tracking_valid: "Platnost trackovacího čísla",
  carrier_detected: "Detekce dopravce",
  delivery_confirmed: "Potvrzení doručení",
  address_match: "Shoda adresy",
  signature_verified: "Ověření podpisu",
  timeline_consistent: "Konzistence časové osy",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function getStatusBadge(status: string): { label: string; icon: string; color: string } {
  switch (status) {
    case "verified":
      return { label: "Ověřeno", icon: "✅", color: "#22c55e" };
    case "partial":
      return { label: "Částečně ověřeno", icon: "⚠️", color: "#f59e0b" };
    case "failed":
      return { label: "Verifikace selhala", icon: "❌", color: "#ef4444" };
    default:
      return { label: "Čeká na verifikaci", icon: "⏳", color: "#6b7280" };
  }
}

export default function ShieldTrackVerification({
  escrowId,
}: {
  escrowId: string;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVerification = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token || "";

        const res = await fetch(
          `/api/escrow/verification?escrow_id=${escrowId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const json: ApiResponse = await res.json();
          setData(json);
        } else {
          setData({ available: false });
        }
      } catch {
        setData({ available: false });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [escrowId]
  );

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  if (loading) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          textAlign: "center",
        }}
      >
        <span style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
          ⏳ Načítám verifikaci zásilky...
        </span>
      </div>
    );
  }

  if (!data?.available || !data.verification) {
    return null; // Tiše skrýt pokud ShieldTrack není dostupný
  }

  const v = data.verification;
  const scoreColor = getScoreColor(v.score);
  const badge = getStatusBadge(v.status);
  const addressMismatch =
    v.address_match && (!v.address_match.city || !v.address_match.zip);

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        background: "var(--bg-card)",
        border: `1px solid var(--border)`,
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          🛡️ Verifikace zásilky
        </h3>
        <button
          onClick={() => fetchVerification(true)}
          disabled={refreshing}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1,
            border: "1px solid var(--border)",
            background: "var(--bg-soft, var(--bg-card))",
            color: "var(--text-muted)",
          }}
        >
          {refreshing ? "⏳" : "🔄"} Obnovit
        </button>
      </div>

      {/* Score + Status row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Score bar */}
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Skóre verifikace
            </span>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: scoreColor,
              }}
            >
              {v.score}/100
            </span>
          </div>
          <div
            style={{
              height: "8px",
              borderRadius: "4px",
              background: "var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${v.score}%`,
                borderRadius: "4px",
                background: scoreColor,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        {/* Status badge */}
        <div
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            background: `${badge.color}15`,
            border: `1px solid ${badge.color}30`,
            fontSize: "14px",
            fontWeight: 600,
            color: badge.color,
            whiteSpace: "nowrap",
          }}
        >
          {badge.icon} {badge.label}
        </div>
      </div>

      {/* Address mismatch warning */}
      {addressMismatch && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#ef4444",
            fontWeight: 600,
          }}
        >
          ⚠️ Neshoda adresy doručení!
          {v.address_match && !v.address_match.city && (
            <span style={{ display: "block", fontWeight: 400, marginTop: "4px" }}>
              Město na zásilce neodpovídá adrese kupujícího.
            </span>
          )}
          {v.address_match && !v.address_match.zip && (
            <span style={{ display: "block", fontWeight: 400, marginTop: "4px" }}>
              PSČ na zásilce neodpovídá adrese kupujícího.
            </span>
          )}
        </div>
      )}

      {/* Checks list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {v.checks.map((check, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "6px",
              background:
                check.status === "failed"
                  ? "rgba(239,68,68,0.05)"
                  : check.status === "warning"
                  ? "rgba(245,158,11,0.05)"
                  : "transparent",
            }}
          >
            <span style={{ fontSize: "16px", flexShrink: 0 }}>
              {CHECK_STATUS_ICON[check.status] || "⏳"}
            </span>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-body)",
                }}
              >
                {CHECK_NAME_CS[check.name] || check.name}
              </span>
              {check.detail && (
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "var(--text-dimmer)",
                    marginTop: "2px",
                  }}
                >
                  {check.detail}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Verified at */}
      {v.verified_at && (
        <div
          style={{
            marginTop: "12px",
            fontSize: "11px",
            color: "var(--text-dimmer)",
            textAlign: "right",
          }}
        >
          Ověřeno: {new Date(v.verified_at).toLocaleString("cs-CZ")}
        </div>
      )}
    </div>
  );
}
