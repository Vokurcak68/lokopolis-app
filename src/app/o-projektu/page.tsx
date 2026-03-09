"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        <span style={{ color: "var(--text-primary)" }}>O projektu </span>
        <span style={{ color: "var(--accent)" }}>Lokopolis</span>
      </h1>
      <p style={{ fontSize: "15px", color: "var(--text-dim)", marginBottom: "40px" }}>
        Česká komunita modelové železnice
      </p>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Co je Lokopolis */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            🚂 Co je Lokopolis?
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "12px" }}>
            Lokopolis je česká online platforma pro všechny nadšence modelové železnice — od úplných začátečníků
            po zkušené modeláře. Vznikla v roce 2026 s cílem vytvořit moderní místo, kde se dá sdílet inspirace,
            zkušenosti a radost z tohoto krásného koníčku.
          </p>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Nezáleží na tom, jestli stavíte v měřítku TT, H0, N nebo jiném — Lokopolis je tu pro všechny.
          </p>
        </section>

        {/* Co tu najdete */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            📋 Co tu najdete?
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { icon: "📝", title: "Články a návody", desc: "Recenze modelů, stavební postupy, tipy a triky od zkušených modelářů" },
              { icon: "📸", title: "Galerie", desc: "Fotky a videa kolejišť, modelů a přestaveb z celé komunity" },
              { icon: "📥", title: "Ke stažení", desc: "Kolejové plány, STL modely pro 3D tisk, návody a další soubory" },
              { icon: "📅", title: "Akce", desc: "Přehled výstav, burzí a setkání modelářů v České republice i okolí" },
              { icon: "💬", title: "Fórum", desc: "Diskuzní fórum pro výměnu zkušeností, poradnu a bazar" },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  padding: "12px",
                  background: "var(--accent-bg-subtle)",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "24px", flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Proč vznikl */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            💡 Proč Lokopolis vznikl?
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "12px" }}>
            V českém internetu chybělo moderní místo zaměřené na modelovou železnici. Existující fóra a weby
            jsou často zastaralé, nepřehledné nebo neaktivní. Lokopolis chce nabídnout svěží alternativu —
            s moderním designem, jednoduchým ovládáním a přátelskou komunitou.
          </p>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Věříme, že modelová železnice je koníček, který spojuje generace. Ať už jste dědečkové předávající
            tradici vnukům, nebo mladí nadšenci objevující kouzlo miniaturního světa — jste tu vítáni.
          </p>
        </section>

        {/* Technologie */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            ⚙️ Technologie
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "16px" }}>
            Lokopolis je postavený na moderních webových technologiích, aby byl rychlý, bezpečný a spolehlivý:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {["Next.js", "React", "TypeScript", "Supabase", "Vercel", "Tailwind CSS"].map((tech) => (
              <span
                key={tech}
                style={{
                  padding: "6px 14px",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "var(--accent)",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Sledujte nás */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            📱 Sledujte nás
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "16px" }}>
            Novinky, fotky kolejišť a zákulisí najdete na našem Instagramu.
          </p>
          <a
            href="https://instagram.com/lokopolis"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 20px",
              background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
            @lokopolis
          </a>
        </section>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p style={{ fontSize: "16px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Chcete se zapojit? Registrace je zdarma!
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/registrace"
              style={{
                padding: "12px 28px",
                background: "var(--accent)",
                color: "var(--bg-page)",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Zaregistrovat se
            </Link>
            <Link
              href="/kontakt"
              style={{
                padding: "12px 28px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border-hover)",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Kontaktujte nás
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
