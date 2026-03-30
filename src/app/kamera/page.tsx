import type { Metadata } from "next";
import Link from "next/link";

const YOUTUBE_VIDEO_ID = "9RI87qlP3XU";
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`;

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

      {/* YouTube embedded player */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "#000",
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&rel=0`}
          title="Lokopolis – Kolejiště LIVE"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </div>

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
