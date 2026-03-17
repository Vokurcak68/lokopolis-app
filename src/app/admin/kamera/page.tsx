"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// go2rtc tunnel URL — update when tunnel changes
const GO2RTC_URL = "https://rid-weekly-decade-homework.trycloudflare.com";
const STREAM_NAME = "kolejiste";

export default function AdminCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [status, setStatus] = useState<"checking" | "denied" | "connecting" | "live" | "error">("checking");
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  // Check admin
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
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

  function cleanup() {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }

  function startStream() {
    cleanup();
    if (!videoRef.current) return;
    setStatus("connecting");
    setError("");

    const video = videoRef.current;
    const hlsUrl = `${GO2RTC_URL}/api/stream.m3u8?src=${STREAM_NAME}`;

    // Safari supports HLS natively
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener("canplay", () => {
        setStatus("live");
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => {
        setStatus("error");
        setError("Stream nedostupný. Zkontroluj go2rtc na PC.");
      }, { once: true });
      return;
    }

    // Chrome/Firefox/Edge — use hls.js
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) {
        setStatus("error");
        setError("Prohlížeč nepodporuje HLS.");
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        liveDurationInfinity: true,
        maxBufferLength: 5,
        maxMaxBufferLength: 10,
      });

      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("live");
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try to recover
            hls.startLoad();
          } else {
            setStatus("error");
            setError("Stream chyba: " + data.details);
          }
        }
      });
    }).catch(() => {
      setStatus("error");
      setError("Nepodařilo se načíst HLS přehrávač.");
    });
  }

  // Auto-connect when admin confirmed
  useEffect(() => {
    if (isAdmin !== true || startedRef.current) return;
    startedRef.current = true;
    startStream();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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
            onClick={() => { startedRef.current = false; startStream(); }}
            disabled={status === "connecting"}
            style={{
              padding: "8px 16px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: status === "connecting" ? "wait" : "pointer",
              opacity: status === "connecting" ? 0.6 : 1,
            }}
          >
            🔄 Obnovit
          </button>
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

      {/* Video player */}
      <div
        style={{
          background: "#000",
          borderRadius: "12px",
          overflow: "hidden",
          position: "relative",
          aspectRatio: "16/9",
        }}
      >
        {status === "connecting" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, background: "rgba(0,0,0,0.7)" }}>
            <div style={{ color: "#fff", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Připojuji se...
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, background: "rgba(0,0,0,0.85)" }}>
            <div style={{ color: "#ef4444", fontSize: "14px", textAlign: "center", padding: "20px", maxWidth: "400px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
              {error}
              <div style={{ marginTop: "16px" }}>
                <button onClick={() => { startedRef.current = false; startStream(); }} style={{ padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text-on)", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Zkusit znovu
                </button>
              </div>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Status bar */}
      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-dimmer)", display: "flex", gap: "12px", alignItems: "center" }}>
        <span style={{
          display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
          background: status === "live" ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444",
        }} />
        <span>
          {status === "live" && "Stream aktivní"}
          {status === "connecting" && "Připojování..."}
          {status === "error" && "Stream nedostupný"}
        </span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
