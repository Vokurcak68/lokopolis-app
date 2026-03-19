import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kolejiště LIVE 🔴 | Lokopolis",
  description:
    "Sledujte naše modelové kolejiště v reálném čase přes živou kameru. YouTube Live stream z Lokopolis.",
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

      {/* YouTube embed — responsive 16:9 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "56.25%", // 16:9
          borderRadius: "12px",
          overflow: "hidden",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <iframe
          src="https://www.youtube.com/embed/9RI87qlP3XU?autoplay=1&mute=1"
          title="Lokopolis – Kolejiště LIVE"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
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
          pokud zrovna neběží, zkuste to později. Pro nejlepší zážitek zapněte
          zvuk a přepněte na fullscreen.
        </p>
      </div>
    </div>
  );
}
