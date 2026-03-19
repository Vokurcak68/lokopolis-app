import type { Metadata } from "next";
import Link from "next/link";

const YOUTUBE_VIDEO_ID = "9RI87qlP3XU";
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`;
const THUMBNAIL_URL = `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`;

export const metadata: Metadata = {
  title: "Kolejiště LIVE 🔴 | Lokopolis",
  description:
    "Sledujte naše modelové kolejiště v reálném čase přes živou kameru na YouTube.",
};

export default function KameraPage() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>Kolejiště </span>
          <span style={{ color: "var(--accent)" }}>LIVE</span>
          <span> 🔴</span>
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
          Sledujte naše modelové kolejiště v reálném čase
        </p>
      </div>

      {/* YouTube thumbnail with play button */}
      <Link
        href={YOUTUBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          textDecoration: "none",
        }}
      >
        {/* Thumbnail */}
        <img
          src={THUMBNAIL_URL}
          alt="Lokopolis – Kolejiště LIVE"
          style={{
            width: "100%",
            display: "block",
            aspectRatio: "16/9",
            objectFit: "cover",
            background: "var(--bg-card)",
          }}
        />
        {/* Play button overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(255,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="white"
              style={{ marginLeft: "4px" }}
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* LIVE badge */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            background: "#ff0000",
            color: "white",
            padding: "4px 12px",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1px",
          }}
        >
          🔴 LIVE
        </div>
      </Link>

      {/* CTA button */}
      <div style={{ marginTop: "16px", textAlign: "center" }}>
        <Link
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 28px",
            background: "#ff0000",
            color: "white",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ▶ Sledovat na YouTube
        </Link>
      </div>

      {/* Info under video */}
      <div
        style={{
          marginTop: "24px",
          padding: "20px 24px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          📹 O živém přenosu
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-dim)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Kamera snímá naše kolejiště 24/7. Přenos se spouští automaticky —
          pokud zrovna neběží, zkuste to později. Kliknutím na náhled výše
          otevřete stream přímo na YouTube.
        </p>
      </div>
    </div>
  );
}
