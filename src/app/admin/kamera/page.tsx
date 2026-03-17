"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// go2rtc tunnel URL — update when tunnel changes
const GO2RTC_URL = "https://rid-weekly-decade-homework.trycloudflare.com";
const STREAM_NAME = "kolejiste";

export default function AdminCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sbRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const [status, setStatus] = useState<"checking" | "denied" | "connecting" | "live" | "error">("checking");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"mse" | "mp4">("mse");

  // Check admin
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");
    }
    checkAdmin();
  }, []);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    sbRef.current = null;
    queueRef.current = [];
  }, []);

  // MSE via WebSocket (low latency)
  const connectMSE = useCallback(async () => {
    cleanup();
    setStatus("connecting");
    setError("");

    if (!videoRef.current) return;

    try {
      if (!("MediaSource" in window)) {
        // Fallback to MP4 stream
        setMode("mp4");
        return;
      }

      const ms = new MediaSource();
      videoRef.current.src = URL.createObjectURL(ms);

      ms.addEventListener("sourceopen", () => {
        const wsUrl = GO2RTC_URL.replace("https://", "wss://").replace("http://", "ws://");
        const ws = new WebSocket(`${wsUrl}/api/ws?src=${STREAM_NAME}`);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        let sourceBuffer: SourceBuffer | null = null;
        let mimeType = "";

        ws.onmessage = (event) => {
          if (typeof event.data === "string") {
            // go2rtc sends codec info as JSON first
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "mse") {
                mimeType = msg.value;
                try {
                  sourceBuffer = ms.addSourceBuffer(mimeType);
                  sbRef.current = sourceBuffer;
                  sourceBuffer.mode = "segments";
                  sourceBuffer.addEventListener("updateend", () => {
                    if (queueRef.current.length > 0 && sourceBuffer && !sourceBuffer.updating) {
                      sourceBuffer.appendBuffer(queueRef.current.shift()!);
                    }
                  });
                  setStatus("live");
                } catch (e) {
                  console.error("addSourceBuffer error:", e);
                  setMode("mp4");
                }
              }
            } catch {
              // not JSON, ignore
            }
          } else if (event.data instanceof ArrayBuffer && sourceBuffer) {
            if (sourceBuffer.updating) {
              // Keep buffer from growing too large
              if (queueRef.current.length < 100) {
                queueRef.current.push(event.data);
              }
            } else {
              try {
                sourceBuffer.appendBuffer(event.data);
              } catch {
                queueRef.current.push(event.data);
              }
            }
          }
        };

        ws.onerror = () => {
          setMode("mp4");
        };

        ws.onclose = () => {
          if (status === "live") {
            setStatus("error");
            setError("WebSocket spojení ukončeno.");
          }
        };
      });

      videoRef.current.play().catch(() => {});
    } catch {
      setMode("mp4");
    }
  }, [cleanup, status]);

  // MP4 fallback (works everywhere via HTTP)
  const connectMP4 = useCallback(() => {
    cleanup();
    setStatus("connecting");
    setError("");

    if (!videoRef.current) return;

    const video = videoRef.current;
    video.src = `${GO2RTC_URL}/api/stream.mp4?src=${STREAM_NAME}`;

    video.oncanplay = () => {
      setStatus("live");
      video.play().catch(() => {});
    };

    video.onerror = () => {
      setStatus("error");
      setError("Nepodařilo se načíst MP4 stream. Zkontroluj go2rtc na PC.");
    };
  }, [cleanup]);

  // Connect based on mode
  useEffect(() => {
    if (isAdmin !== true) return;
    if (mode === "mse") {
      connectMSE();
    } else {
      connectMP4();
    }
    return cleanup;
  }, [isAdmin, mode, connectMSE, connectMP4, cleanup]);

  function handleRefresh() {
    setMode("mse");
  }

  function handleSwitchMode() {
    setMode(m => m === "mse" ? "mp4" : "mse");
  }

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
            Živý stream · Režim: {mode === "mse" ? "MSE (WebSocket)" : "MP4 (HTTP)"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={handleRefresh}
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
          <button
            onClick={handleSwitchMode}
            style={{
              padding: "8px 16px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {mode === "mse" ? "📺 MP4 režim" : "⚡ MSE režim"}
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {status === "connecting" && (
          <div style={{ position: "absolute", color: "#fff", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", zIndex: 2 }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            Připojuji se ke streamu...
          </div>
        )}

        {status === "error" && (
          <div style={{ color: "#ef4444", fontSize: "14px", textAlign: "center", padding: "20px", maxWidth: "400px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
            {error || "Stream není dostupný"}
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                onClick={handleRefresh}
                style={{
                  padding: "8px 20px",
                  background: "var(--accent)",
                  color: "var(--accent-text-on)",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Zkusit znovu
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      {/* Status */}
      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-dimmer)", display: "flex", gap: "16px", alignItems: "center" }}>
        <span style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: status === "live" ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444",
        }} />
        <span>
          {status === "live" && `🟢 Stream aktivní — ${mode === "mse" ? "MSE/WebSocket" : "MP4/HTTP"}`}
          {status === "connecting" && "🟡 Připojování..."}
          {status === "error" && "🔴 Stream nedostupný — zkontroluj go2rtc na PC"}
        </span>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
