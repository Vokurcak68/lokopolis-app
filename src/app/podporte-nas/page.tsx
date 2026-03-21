"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Convert Czech account number (e.g. "2100235025/2010") to IBAN */
function accountToIban(accountNum: string, bankCode: string): string {
  const padded = accountNum.padStart(16, "0");
  const bban = bankCode + padded;
  // CZ = 12 35, append "00" for check
  const numStr = bban + "1235" + "00";
  // Modular arithmetic for big numbers
  let remainder = 0;
  for (const ch of numStr) {
    remainder = (remainder * 10 + parseInt(ch)) % 97;
  }
  const check = (98 - remainder).toString().padStart(2, "0");
  return `CZ${check}${bban}`;
}

function useDonationAccount() {
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/escrow/donation-account")
      .then(r => r.json())
      .then(d => setAccount(d.account || null))
      .catch(() => {});
  }, []);
  return account;
}

export default function SupportPage() {
  const account = useDonationAccount();
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
            a chcete nám pomoct s náklady, budeme moc rádi za jakýkoliv příspěvek. Pošlete kolik chcete —
            každá koruna pomáhá.
          </p>

          {account && (() => {
            const [num, code] = account.split("/");
            const iban = accountToIban(num, code);
            const spdString = `SPD*1.0*ACC:${iban}*AM:*CC:CZK*MSG:Podpora Lokopolis*X-VS:9999`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(spdString)}`;

            return (
              <div
                style={{
                  padding: "24px",
                  background: "var(--accent-bg-medium)",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
                  📱 Pošlete příspěvek přes QR kód
                </div>
                <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "16px", lineHeight: 1.6 }}>
                  Naskenujte QR kód svou bankovní aplikací. Částku si zvolte libovolnou —
                  klidně symbolických 50 Kč, nebo více, pokud chcete. Vše jde přímo na provoz webu.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="QR kód pro platbu"
                  width={200}
                  height={200}
                  style={{
                    borderRadius: "12px",
                    background: "#fff",
                    padding: "12px",
                    display: "inline-block",
                  }}
                />
                <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-dimmer)", lineHeight: 1.7 }}>
                  <div>Číslo účtu: <strong style={{ color: "var(--text-muted)" }}>{account}</strong> (FIO banka)</div>
                  <div>Variabilní symbol: <strong style={{ color: "var(--text-muted)" }}>9999</strong></div>
                  <div style={{ marginTop: "4px", fontStyle: "italic" }}>
                    Částku zadejte ručně ve své bankovní aplikaci — QR kód ji nechává na vás.
                  </div>
                </div>
              </div>
            );
          })()}

          {!account && (
            <div
              style={{
                padding: "20px",
                background: "var(--accent-bg-medium)",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                Načítání platebních údajů...
              </div>
            </div>
          )}
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
