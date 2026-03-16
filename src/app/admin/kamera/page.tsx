"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamInfo, setStreamInfo] = useState<{ url: string; type: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check admin
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
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

  // Fetch stream
  useEffect(() => {
    if (isAdmin !== true) return;

    async function fetchStream() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/tuya/stream");
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Chyba" }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setStreamInfo(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Nepodařilo se načíst stream");
      } finally {
        setLoading(false);
      }
    }

    fetchStream();
  }, [isAdmin]);

  // Play HLS stream
  useEffect(() => {
    if (!streamInfo?.url || !videoRef.current) return;

    const video = videoRef.current;

    if (streamInfo.type === "hls") {
      // Check native HLS support (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamInfo.url;
        video.play().catch(() => {});
      } else {
        // Use HLS.js for other browsers
        import("hls.js").then(({ default: Hls }) => {
          if (!Hls.isSupported()) {
            setError("Prohlížeč nepodporuje HLS stream");
            return;
          }
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });
          hls.loadSource(streamInfo.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              setError("Stream error: " + data.type);
            }
          });
          hlsRef.current = hls;
        });
      }
    } else {
      // RTSP won't play directly — show URL
      setError(`Stream typu ${streamInfo.type} nelze přehrát přímo v prohlížeči. URL: ${streamInfo.url}`);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamInfo]);

  // Refresh stream (URLs expire)
  function handleRefresh() {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setStreamInfo(null);
    setError("");
    setLoading(true);
    fetch("/api/tuya/stream")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStreamInfo(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            📹 Kamera
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Živý stream z IP kamery · Pouze admin
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            🔄 Obnovit stream
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
        {loading && (
          <div style={{ color: "#fff", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            Načítám stream...
          </div>
        )}

        {error && !loading && (
          <div style={{ color: "#ef4444", fontSize: "14px", textAlign: "center", padding: "20px", maxWidth: "400px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
            {error}
            <div style={{ marginTop: "16px" }}>
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
          controls
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            display: loading || error ? "none" : "block",
          }}
        />
      </div>

      {/* Stream info */}
      {streamInfo && (
        <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-dimmer)", display: "flex", gap: "16px" }}>
          <span>Typ: {streamInfo.type.toUpperCase()}</span>
          <span>•</span>
          <span>Stream URL expiruje — použij 🔄 Obnovit stream pokud přestane fungovat</span>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
