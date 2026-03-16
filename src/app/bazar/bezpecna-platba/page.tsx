"use client";

import Link from "next/link";

const steps = [
  { icon: "📝", title: "Kupující vytvoří objednávku", desc: "Klikne na \"Koupit s Bezpečnou platbou\" u inzerátu. Systém vygeneruje platební údaje." },
  { icon: "💳", title: "Kupující zaplatí", desc: "Převede částku na escrow účet Lokopolis. Peníze drží neutrální strana." },
  { icon: "📦", title: "Prodejce odešle zboží", desc: "Po potvrzení platby adminem prodejce odešle zásilku a zadá tracking číslo." },
  { icon: "✅", title: "Kupující potvrdí přijetí", desc: "Když zboží dorazí v pořádku, kupující potvrdí. Peníze se uvolní prodejci." },
  { icon: "💰", title: "Prodejce obdrží výplatu", desc: "Lokopolis odečte provizi a zbytek vyplatí prodejci." },
];

const faqs = [
  {
    q: "Co když zboží nepřijde?",
    a: "Kupující může otevřít spor. Admin Lokopolis situaci posoudí a rozhodne — peníze se vrátí kupujícímu, uvolní prodejci, nebo se částka rozdělí.",
  },
  {
    q: "Co když zboží neodpovídá popisu?",
    a: "I v tomto případě můžete otevřít spor s fotkami jako důkazem. Admin rozhodne spravedlivě.",
  },
  {
    q: "Jak dlouho má prodejce na odeslání?",
    a: "Standardně 5 dní od potvrzení platby. Lhůtu může admin upravit.",
  },
  {
    q: "Co když kupující nepotvrdí přijetí?",
    a: "Po uplynutí lhůty (standardně 14 dní od odeslání) se peníze automaticky uvolní prodejci.",
  },
  {
    q: "Kolik stojí provize?",
    a: "Standardně 5% z ceny inzerátu, minimálně 15 Kč. Provize se strhává z částky — prodejce obdrží cenu minus provize.",
  },
  {
    q: "Musím používat Bezpečnou platbu?",
    a: "Ne, je to volitelné. Můžete se s prodejcem domluvit i přímo přes zprávy. Bezpečná platba je tu pro ty, kteří chtějí extra jistotu.",
  },
];

export default function SafePaymentInfoPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ fontSize: "56px", marginBottom: "16px" }}>🛡️</div>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Bezpečná platba
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
          Nakupujte i prodávejte s jistotou. Peníze drží Lokopolis jako neutrální strana, dokud obě strany nepotvrdí, že je vše v pořádku.
        </p>
      </div>

      {/* Steps */}
      <div style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
          Jak to funguje
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "16px",
                padding: "16px",
                borderRadius: "12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--accent-bg, rgba(240,160,48,0.1))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)", marginBottom: "2px" }}>
                  Krok {i + 1}
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* For whom */}
      <div
        style={{
          marginBottom: "48px",
          padding: "24px",
          borderRadius: "12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
          Pro koho je to výhodné
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#22c55e", marginBottom: "8px" }}>🛒 Kupující</h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.8 }}>
              <li>Neznáte prodejce osobně</li>
              <li>Kupujete dražší položku</li>
              <li>Chcete jistotu, že peníze dostane prodejce až po doručení</li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#3b82f6", marginBottom: "8px" }}>💰 Prodávající</h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.8 }}>
              <li>Máte jistotu, že kupující zaplatil</li>
              <li>Chráníte se před neplatícími</li>
              <li>Budujete si důvěryhodnost</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
          Časté otázky
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                {faq.q}
              </h4>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center", padding: "32px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Připraveni nakupovat bezpečně?
        </h3>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
          Prohlédněte si inzeráty s možností bezpečné platby.
        </p>
        <Link
          href="/bazar"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            fontSize: "15px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          🚂 Prohlédnout bazar →
        </Link>
      </div>
    </div>
  );
}
