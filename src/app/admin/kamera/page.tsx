"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// go2rtc tunnel URL — update when tunnel changes
const GO2RTC_URL = "https://rid-weekly-decade-homework.trycloudflare.com";
const STREAM_NAME = "kolejiste";

export default function AdminCameraPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");
    })();
  }, []);

  if (isAdmin === null) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Ověřuji přístup...</div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "48px" }}>🔒</div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Přístup odepřen</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Tato stránka je dostupná pouze pro administrátory.</p>
        <Link href="/" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px" }}>← Zpět na hlavní stránku</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            📹 Kamera — Kolejiště
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Živý stream z IP kamery
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => { setLoaded(false); setIframeKey(k => k + 1); }}
            style={{
              padding: "8px 16px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔄 Obnovit
          </button>
          <a
            href={`${GO2RTC_URL}/stream.html?src=${STREAM_NAME}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "8px 16px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            🔗 Plné okno
          </a>
          <Link
            href="/admin"
            style={{
              padding: "8px 16px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Admin
          </Link>
        </div>
      </div>

      {/* Video player — go2rtc embedded player */}
      <div
        style={{
          background: "#000",
          borderRadius: "12px",
          overflow: "hidden",
          position: "relative",
          aspectRatio: "16/9",
        }}
      >
        {!loaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, background: "rgba(0,0,0,0.7)" }}>
            <div style={{ color: "#fff", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Načítám stream...
            </div>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={`${GO2RTC_URL}/stream.html?src=${STREAM_NAME}`}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          allow="autoplay; fullscreen"
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* Status */}
      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-dimmer)", display: "flex", gap: "12px", alignItems: "center" }}>
        <span style={{
          display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
          background: loaded ? "#22c55e" : "#f59e0b",
        }} />
        <span>{loaded ? "Stream načten" : "Načítání..."}</span>
        <span style={{ marginLeft: "auto", opacity: 0.5 }}>
          go2rtc · Cloudflare Tunnel
        </span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
