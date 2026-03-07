"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        <span style={{ color: "#fff" }}>O projektu </span>
        <span style={{ color: "#f0a030" }}>Lokopolis</span>
      </h1>
      <p style={{ fontSize: "15px", color: "#8a8ea0", marginBottom: "40px" }}>
        Česká komunita modelové železnice
      </p>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Co je Lokopolis */}
        <section
          style={{
            background: "#1a1e2e",
            border: "1px solid #252838",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
            🚂 Co je Lokopolis?
          </h2>
          <p style={{ fontSize: "15px", color: "#c8c8d0", lineHeight: 1.7, marginBottom: "12px" }}>
            Lokopolis je česká online platforma pro všechny nadšence modelové železnice — od úplných začátečníků
            po zkušené modeláře. Vznikla v roce 2026 s cílem vytvořit moderní místo, kde se dá sdílet inspirace,
            zkušenosti a radost z tohoto krásného koníčku.
          </p>
          <p style={{ fontSize: "15px", color: "#c8c8d0", lineHeight: 1.7 }}>
            Nezáleží na tom, jestli stavíte v měřítku TT, H0, N nebo jiném — Lokopolis je tu pro všechny.
          </p>
        </section>

        {/* Co tu najdete */}
        <section
          style={{
            background: "#1a1e2e",
            border: "1px solid #252838",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
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
                  background: "rgba(240,160,48,0.04)",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "24px", flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#e0e0e0", marginBottom: "4px" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "13px", color: "#8a8ea0", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Proč vznikl */}
        <section
          style={{
            background: "#1a1e2e",
            border: "1px solid #252838",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
            💡 Proč Lokopolis vznikl?
          </h2>
          <p style={{ fontSize: "15px", color: "#c8c8d0", lineHeight: 1.7, marginBottom: "12px" }}>
            V českém internetu chybělo moderní místo zaměřené na modelovou železnici. Existující fóra a weby
            jsou často zastaralé, nepřehledné nebo neaktivní. Lokopolis chce nabídnout svěží alternativu —
            s moderním designem, jednoduchým ovládáním a přátelskou komunitou.
          </p>
          <p style={{ fontSize: "15px", color: "#c8c8d0", lineHeight: 1.7 }}>
            Věříme, že modelová železnice je koníček, který spojuje generace. Ať už jste dědečkové předávající
            tradici vnukům, nebo mladí nadšenci objevující kouzlo miniaturního světa — jste tu vítáni.
          </p>
        </section>

        {/* Technologie */}
        <section
          style={{
            background: "#1a1e2e",
            border: "1px solid #252838",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
            ⚙️ Technologie
          </h2>
          <p style={{ fontSize: "15px", color: "#c8c8d0", lineHeight: 1.7, marginBottom: "16px" }}>
            Lokopolis je postavený na moderních webových technologiích, aby byl rychlý, bezpečný a spolehlivý:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {["Next.js", "React", "TypeScript", "Supabase", "Vercel", "Tailwind CSS"].map((tech) => (
              <span
                key={tech}
                style={{
                  padding: "6px 14px",
                  background: "rgba(240,160,48,0.1)",
                  border: "1px solid rgba(240,160,48,0.2)",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "#f0a030",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p style={{ fontSize: "16px", color: "#a0a4b8", marginBottom: "20px" }}>
            Chcete se zapojit? Registrace je zdarma!
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/registrace"
              style={{
                padding: "12px 28px",
                background: "#f0a030",
                color: "#0f1117",
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
                color: "#a0a4b8",
                border: "1px solid #353a50",
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
