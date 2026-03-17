"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// go2rtc tunnel URL — update when tunnel changes
const GO2RTC_URL = "https://rid-weekly-decade-homework.trycloudflare.com";
const STREAM_NAME = "kolejiste";

export default function AdminCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<"checking" | "denied" | "connecting" | "live" | "error">("checking");
  const [error, setError] = useState("");

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

  // Connect WebRTC to go2rtc
  async function connectWebRTC() {
    setStatus("connecting");
    setError("");

    try {
      // Cleanup previous connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus("live");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          setStatus("error");
          setError("Spojení přerušeno. Zkus obnovit.");
        }
      };

      // We need to receive video and audio
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") resolve();
          };
          // Timeout after 3s
          setTimeout(resolve, 3000);
        }
      });

      // Send offer to go2rtc
      const res = await fetch(`${GO2RTC_URL}/api/webrtc?src=${STREAM_NAME}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp,
      });

      if (!res.ok) {
        throw new Error(`go2rtc error: ${res.status}`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: "answer",
        sdp: answerSdp,
      }));
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Nepodařilo se připojit ke streamu");
    }
  }

  // Auto-connect when admin confirmed
  useEffect(() => {
    if (isAdmin === true) {
      connectWebRTC();
    }
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
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
            Živý stream přes WebRTC · Pouze admin
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={connectWebRTC}
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
        {status === "connecting" && (
          <div style={{ color: "#fff", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            Připojuji se ke streamu...
          </div>
        )}

        {status === "error" && (
          <div style={{ color: "#ef4444", fontSize: "14px", textAlign: "center", padding: "20px", maxWidth: "400px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
            {error || "Stream není dostupný"}
            <div style={{ marginTop: "16px" }}>
              <button
                onClick={connectWebRTC}
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
            display: status === "live" ? "block" : "none",
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
          {status === "live" && "🟢 Stream aktivní — WebRTC"}
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
