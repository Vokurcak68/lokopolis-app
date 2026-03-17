"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// go2rtc — direct IP (port forwarded, supports WebSocket)
const GO2RTC_DIRECT = "http://178.17.15.153:1984";
const STREAM_NAME = "kolejiste";

type Status = "checking" | "connecting" | "live" | "error";

export default function AdminCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const msRef = useRef<MediaSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState("");
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

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (msRef.current && msRef.current.readyState === "open") {
      try { msRef.current.endOfStream(); } catch { /* ok */ }
    }
    msRef.current = null;
  }, []);

  const startStream = useCallback(() => {
    cleanup();
    setStatus("connecting");
    setError("");

    const video = videoRef.current;
    if (!video) return;

    // Check MSE support
    if (!("MediaSource" in window) || !MediaSource.isTypeSupported('video/mp4; codecs="avc1.640029"')) {
      setStatus("error");
      setError("Prohlížeč nepodporuje MSE/H264. Zkus Chrome nebo Edge.");
      return;
    }

    const ms = new MediaSource();
    msRef.current = ms;
    video.src = URL.createObjectURL(ms);

    ms.addEventListener("sourceopen", () => {
      const wsUrl = GO2RTC_DIRECT.replace("http://", "ws://") + `/api/ws?src=${STREAM_NAME}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      let sb: SourceBuffer | null = null;
      const queue: ArrayBuffer[] = [];
      let alive = true;

      function appendNext() {
        if (sb && !sb.updating && queue.length > 0) {
          try {
            sb.appendBuffer(queue.shift()!);
          } catch (e) {
            console.warn("appendBuffer error:", e);
          }
        }
      }

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "mse" }));
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "mse" && msg.value && !sb) {
              try {
                sb = ms.addSourceBuffer(msg.value);
                sb.mode = "segments";
                sb.addEventListener("updateend", () => {
                  appendNext();
                  // Keep buffer trimmed — max 10s behind
                  if (sb && !sb.updating && video.buffered.length > 0) {
                    const end = video.buffered.end(video.buffered.length - 1);
                    const start = video.buffered.start(0);
                    if (end - start > 15) {
                      try { sb.remove(0, end - 10); } catch { /* ok */ }
                    }
                  }
                });
                setStatus("live");
                video.play().catch(() => {});
              } catch (e) {
                setStatus("error");
                setError(`Codec nepodporovaný: ${msg.value}`);
                ws.close();
              }
            }
          } catch { /* not JSON */ }
        } else if (event.data instanceof ArrayBuffer && sb) {
          if (sb.updating || queue.length > 0) {
            if (queue.length > 50) {
              queue.splice(0, queue.length - 10);
            }
            queue.push(event.data);
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
        if (alive) {
          alive = false;
          setStatus("error");
          setError("Připojení selhalo. Zkontroluj go2rtc na PC.");
        }
      };

      ws.onclose = (e) => {
        if (alive) {
          alive = false;
          // Auto-reconnect after 3s on unexpected close
          if (e.code !== 1000) {
            setStatus("connecting");
            setError("");
            reconnectTimer.current = setTimeout(() => startStream(), 3000);
          } else {
            setStatus("error");
            setError("Stream ukončen.");
          }
        }
      };
    }, { once: true });
  }, [cleanup]);

  // Auto-start
  useEffect(() => {
    if (isAdmin !== true) return;
    startStream();
    return cleanup;
  }, [isAdmin, startStream, cleanup]);

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
            Živý stream z IP kamery (MSE/WebSocket)
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={startStream}
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
                <button onClick={startStream} style={{ padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text-on)", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
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
          {status === "live" && "Stream aktivní · MSE/WebSocket"}
          {status === "connecting" && "Připojování..."}
          {status === "error" && "Stream nedostupný"}
        </span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
