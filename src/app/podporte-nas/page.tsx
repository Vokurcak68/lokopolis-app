"use client";

import Link from "next/link";

export default function SupportPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        <span style={{ color: "var(--text-primary)" }}>Podpořte </span>
        <span style={{ color: "var(--accent)" }}>Lokopolis</span>
      </h1>
      <p style={{ fontSize: "15px", color: "var(--text-dim)", marginBottom: "40px" }}>
        Lokopolis je komunitní projekt bez reklam. Vaše podpora nám pomáhá udržet web v chodu.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Free ways */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            🆓 Zdarma — a přesto nám hodně pomůžete
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              {
                icon: "📝",
                title: "Napište článek",
                desc: "Sdílejte své zkušenosti, recenze nebo návody. Kvalitní obsah je základ komunity.",
                link: "/novy-clanek",
                linkText: "Napsat článek →",
              },
              {
                icon: "💬",
                title: "Zapojte se do fóra",
                desc: "Odpovídejte na dotazy, pomáhejte začátečníkům, sdílejte tipy.",
                link: "/forum",
                linkText: "Přejít na fórum →",
              },
              {
                icon: "📸",
                title: "Sdílejte fotky",
                desc: "Nahrajte fotky svého kolejiště, modelů nebo rozpracovaných projektů do galerie.",
                link: "/galerie",
                linkText: "Otevřít galerii →",
              },
              {
                icon: "📢",
                title: "Řekněte o nás dál",
                desc: "Doporučte Lokopolis kamarádům modelářům, v klubu nebo na sociálních sítích.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  padding: "14px",
                  background: "var(--accent-bg-subtle)",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "24px", flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5, marginBottom: item.link ? "6px" : "0" }}>
                    {item.desc}
                  </div>
                  {item.link && (
                    <Link href={item.link} style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}>
                      {item.linkText}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Financial support */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--accent-border-strong)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            ☕ Finanční podpora
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "16px" }}>
            Provoz webu stojí peníze — hosting, doména, databáze. Pokud vám Lokopolis přijde užitečný
            a chcete nám pomoct s náklady, budeme moc rádi za jakýkoliv příspěvek.
          </p>
          <div
            style={{
              padding: "20px",
              background: "var(--accent-bg-medium)",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "8px" }}>
              Možnosti podpory připravujeme
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>
              Chcete nás podpořit už teď? Napište nám na{" "}
              <Link href="/kontakt" style={{ color: "var(--accent)", textDecoration: "none" }}>kontaktní stránce</Link>.
            </div>
          </div>
        </section>

        {/* What the money goes to */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
            💰 Na co jdou peníze?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            {[
              { icon: "🖥️", label: "Hosting a server", desc: "Aby web běžel rychle a spolehlivě" },
              { icon: "🌐", label: "Doména", desc: "lokopolis.cz a další" },
              { icon: "🗄️", label: "Databáze", desc: "Bezpečné uložení dat a obsahu" },
              { icon: "🔧", label: "Vývoj", desc: "Nové funkce a vylepšení" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  textAlign: "center",
                  padding: "16px",
                  background: "var(--accent-bg-subtle)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>{item.icon}</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>{item.label}</div>
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Thanks */}
        <div
          style={{
            textAlign: "center",
            padding: "24px",
            background: "var(--accent-bg-medium)",
            border: "1px solid var(--accent-border)",
            borderRadius: "12px",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🙏</div>
          <p style={{ fontSize: "16px", color: "var(--text-body)", fontWeight: 600, marginBottom: "4px" }}>
            Děkujeme!
          </p>
          <p style={{ fontSize: "14px", color: "var(--text-dim)" }}>
            Každý příspěvek — ať už článek, fotka nebo dobrá rada — dělá Lokopolis lepším místem.
          </p>
        </div>
      </div>
    </div>
  );
}
