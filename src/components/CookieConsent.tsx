"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("lokopolis_cookies_consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem("lokopolis_cookies_consent", "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("lokopolis_cookies_consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: "0 16px 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          background: "var(--bg-card, #1e1e3a)",
          border: "1px solid var(--border, #333)",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
          pointerEvents: "auto",
        }}
      >
        <p style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "12px" }}>
          Tento web používá cookies pro správné fungování. 🍪
        </p>

        {showSettings && (
          <div style={{
            padding: "12px",
            background: "var(--bg-header, #16162b)",
            borderRadius: "8px",
            marginBottom: "12px",
            fontSize: "13px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}>
            <p style={{ marginBottom: "8px" }}><strong style={{ color: "var(--text-primary)" }}>Nezbytné cookies</strong> — přihlášení, nastavení tématu, souhlas s cookies. Nelze vypnout.</p>
            <p style={{ marginBottom: "0" }}>Analytické ani marketingové cookies nepoužíváme. Více v{" "}
              <Link href="/ochrana-udaju" style={{ color: "var(--accent, #f0a030)", textDecoration: "underline" }}>zásadách ochrany osobních údajů</Link>.
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={accept}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent, #f0a030)",
              color: "var(--bg-dark, #111)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Přijmout
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "1px solid var(--border, #333)",
              background: "transparent",
              color: "var(--text-muted)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {showSettings ? "Skrýt" : "Nastavení"}
          </button>
          <button
            onClick={decline}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "1px solid var(--border, #333)",
              background: "transparent",
              color: "var(--text-faint, #666)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Odmítnout nezbytné
          </button>
        </div>
      </div>
    </div>
  );
}
