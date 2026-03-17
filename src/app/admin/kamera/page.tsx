"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// go2rtc tunnel URL — update when tunnel changes
const GO2RTC_URL = "https://rid-weekly-decade-homework.trycloudflare.com";
const STREAM_NAME = "kolejiste";

export default function AdminCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"checking" | "denied" | "connecting" | "live" | "error">("checking");
  const [error, setError] = useState("");
  const [streamMode, setStreamMode] = useState<"mse" | "mp4">("mp4");
  const connectingRef = useRef(false);

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
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }

  function startMP4() {
    cleanup();
    if (!videoRef.current) return;
    connectingRef.current = true;
    setStatus("connecting");
    setError("");
    setStreamMode("mp4");

    const video = videoRef.current;
    // fMP4 stream — go2rtc serves continuous MP4 over HTTP
    video.src = `${GO2RTC_URL}/api/stream.mp4?src=${STREAM_NAME}`;

    const onCanPlay = () => {
      connectingRef.current = false;
      setStatus("live");
      video.play().catch(() => {});
    };

    const onError = () => {
      connectingRef.current = false;
      setStatus("error");
      setError("MP4 stream nedostupný. Zkontroluj go2rtc na PC.");
    };

    video.addEventListener("canplay", onCanPlay, { once: true });
    video.addEventListener("error", onError, { once: true });
  }

  function startMSE() {
    cleanup();
    if (!videoRef.current || !("MediaSource" in window)) {
      startMP4();
      return;
    }
    connectingRef.current = true;
    setStatus("connecting");
    setError("");
    setStreamMode("mse");

    const video = videoRef.current;
    const ms = new MediaSource();
    video.src = URL.createObjectURL(ms);

    const queue: ArrayBuffer[] = [];

    ms.addEventListener("sourceopen", () => {
      const wsUrl = GO2RTC_URL.replace("https://", "wss://").replace("http://", "ws://");
      const ws = new WebSocket(`${wsUrl}/api/ws?src=${STREAM_NAME}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      let sb: SourceBuffer | null = null;

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "mse" && msg.value) {
              try {
                sb = ms.addSourceBuffer(msg.value);
                sb.mode = "segments";
                sb.addEventListener("updateend", () => {
                  if (queue.length > 0 && sb && !sb.updating) {
                    sb.appendBuffer(queue.shift()!);
                  }
                  // Trim buffer to avoid memory leak
                  if (sb && !sb.updating && video.currentTime > 10) {
                    try { sb.remove(0, video.currentTime - 5); } catch { /* ok */ }
                  }
                });
                connectingRef.current = false;
                setStatus("live");
                video.play().catch(() => {});
              } catch {
                // SourceBuffer not supported for this codec — fallback
                ws.close();
                startMP4();
              }
            }
          } catch { /* not JSON */ }
        } else if (event.data instanceof ArrayBuffer && sb) {
          if (sb.updating || queue.length > 0) {
            if (queue.length < 50) queue.push(event.data);
          } else {
            try {
              sb.appendBuffer(event.data);
            } catch {
              queue.push(event.data);
            }
          }
        }
      };

      ws.onerror = () => {
        if (connectingRef.current) {
          startMP4(); // fallback
        }
      };

      ws.onclose = () => {
        if (!connectingRef.current && status !== "error") {
          setStatus("error");
          setError("WebSocket spojení ukončeno.");
        }
      };
    });
  }

  // Auto-connect when admin confirmed
  useEffect(() => {
    if (isAdmin !== true) return;
    startMP4(); // Start with MP4 (most reliable)
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
            Živý stream · {streamMode === "mse" ? "MSE/WebSocket" : "MP4/HTTP"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={startMP4}
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
            onClick={streamMode === "mse" ? startMP4 : startMSE}
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
            {streamMode === "mse" ? "📺 MP4" : "⚡ MSE"}
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
                <button onClick={startMP4} style={{ padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text-on)", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
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
          {status === "live" && `Stream aktivní`}
          {status === "connecting" && "Připojování..."}
          {status === "error" && "Stream nedostupný"}
        </span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
