import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jak funguje bazar | Lokopolis.cz",
  description:
    "Průvodce bazarem Lokopolis.cz — jak prodávat, nakupovat, komunikovat a využívat Bezpečnou platbu.",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const h2Style: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: "12px",
  paddingBottom: "8px",
  borderBottom: "1px solid var(--border)",
};

const pStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  lineHeight: 1.7,
  marginBottom: "12px",
  fontSize: "15px",
};

const liStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  lineHeight: 1.7,
  marginBottom: "6px",
  fontSize: "15px",
};

const ulStyle: React.CSSProperties = {
  paddingLeft: "20px",
  listStyleType: "disc",
};

const olStyle: React.CSSProperties = {
  paddingLeft: "20px",
  listStyleType: "decimal",
};

const tipBox: React.CSSProperties = {
  background: "rgba(240,160,48,0.08)",
  border: "1px solid rgba(240,160,48,0.25)",
  borderRadius: "10px",
  padding: "16px 20px",
  marginBottom: "16px",
  fontSize: "14px",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

export default function BazarGuidePage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: "8px",
        }}
      >
        🛒 Jak funguje bazar
      </h1>
      <p
        style={{
          color: "var(--text-faint)",
          fontSize: "13px",
          marginBottom: "40px",
        }}
      >
        Kompletní průvodce pro kupující i prodávající
      </p>

      {/* 1. Co je bazar */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>1. Co je bazar Lokopolis?</h2>
        <p style={pStyle}>
          Bazar je místo, kde si členové komunity Lokopolis mohou navzájem prodávat a kupovat
          modely železnic, příslušenství, díly a literaturu. Jedná se o prodej mezi uživateli (C2C) —
          Lokopolis není prodejcem zboží, ale poskytuje platformu pro spojení kupujících a prodávajících.
        </p>
        <p style={pStyle}>
          Inzerování v bazaru je <strong style={{ color: "var(--text-primary)" }}>zdarma</strong>.
          Poplatek se platí pouze při využití služby{" "}
          <Link href="/bazar/podminky-escrow" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Bezpečná platba
          </Link>.
        </p>
      </div>

      {/* 2. Jak prodávat */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Jak prodávat</h2>
        <ol style={olStyle}>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Zaregistrujte se a přihlaste</strong> —
            pro vkládání inzerátů potřebujete účet na Lokopolis.cz.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Vytvořte inzerát</strong> — klikněte na
            &quot;+ Přidat inzerát&quot; v bazaru. Vyplňte název, popis, cenu, kategorii, měřítko a stav zboží.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Přidejte fotky</strong> — nahrajte až
            8 fotografií (drag &amp; drop). Kvalitní fotky výrazně zvyšují šanci na prodej.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Zvolte způsob platby</strong> — zaškrtněte,
            jak chcete přijímat platbu: hotovost, bankovní převod, dobírka, nebo Bezpečná platba.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Zadejte možnost doručení</strong> — uveďte,
            zda nabízíte osobní předání, zaslání poštou, nebo obojí. U zaslání uveďte cenu poštovného.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Publikujte</strong> — inzerát se ihned
            zobrazí v bazaru a je přístupný všem návštěvníkům.
          </li>
        </ol>
        <div style={tipBox}>
          💡 <strong>Tip:</strong> Můžete duplikovat existující inzerát tlačítkem 📋 a upravit jen detaily.
          Šetří to čas při vkládání podobných položek.
        </div>
      </div>

      {/* 3. Jak nakupovat */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Jak nakupovat</h2>
        <ol style={olStyle}>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Procházejte a filtrujte</strong> —
            v bazaru můžete filtrovat podle kategorie, měřítka, stavu, cenového rozsahu
            nebo hledat fulltextově.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Kontaktujte prodávajícího</strong> —
            u každého inzerátu můžete poslat zprávu přímo prodávajícímu. Dohodněte se na detailech,
            ceně a způsobu předání.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Zvolte způsob platby</strong> — pokud
            prodávající povolil Bezpečnou platbu, uvidíte u inzerátu zelený štítek 🛡️. Klikněte na
            &quot;Koupit s Bezpečnou platbou&quot; pro maximální ochranu.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Proveďte platbu</strong> — při Bezpečné
            platbě obdržíte platební údaje (číslo účtu, variabilní symbol, QR kód). Peníze jsou drženy
            na účtu Lokopolis, dokud nepotvrdíte přijetí zboží.
          </li>
        </ol>
      </div>

      {/* 4. Zprávy */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Komunikace mezi uživateli</h2>
        <p style={pStyle}>
          Lokopolis má interní systém zpráv. Ke každému inzerátu můžete zahájit konverzaci
          s prodávajícím — vše zůstává v rámci platformy, nemusíte sdílet svůj e-mail ani telefon.
        </p>
        <p style={pStyle}>
          Zprávy najdete v sekci <strong style={{ color: "var(--text-primary)" }}>💬 Zprávy</strong> v bazaru.
          Prodávající vidí příchozí zprávy u svých inzerátů a může na ně odpovídat.
        </p>
        <div style={tipBox}>
          ⚠️ <strong>Důležité:</strong> Veškerá komunikace by měla probíhat přes platformu.
          Lokopolis nemůže řešit spory, pokud komunikace probíhala mimo web.
        </div>
      </div>

      {/* 5. Bezpečná platba */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Bezpečná platba (escrow)</h2>
        <p style={pStyle}>
          Bezpečná platba chrání obě strany obchodu. Peníze kupujícího jsou drženy na účtu Lokopolis
          a prodávajícímu jsou vyplaceny až po potvrzení doručení zboží.
        </p>
        <p style={pStyle}>
          <strong style={{ color: "var(--text-primary)" }}>Jak to funguje:</strong>
        </p>
        <ol style={olStyle}>
          <li style={liStyle}>Kupující vytvoří transakci a zadá dodací adresu.</li>
          <li style={liStyle}>Kupující odešle platbu na účet Lokopolis (QR kód nebo bankovní převod).</li>
          <li style={liStyle}>Po přijetí platby je prodávající vyzván k odeslání zboží.</li>
          <li style={liStyle}>Prodávající odešle zásilku a zadá sledovací číslo.</li>
          <li style={liStyle}>Po doručení kupující potvrdí přijetí — peníze jsou uvolněny prodávajícímu.</li>
        </ol>
        <p style={pStyle}>
          Pokud kupující nepotvrdí přijetí ani neotevře spor, transakce se automaticky dokončí
          (peníze jsou uvolněny prodávajícímu). Za službu je účtována provize z ceny inzerátu, kterou hradí prodávající.
        </p>
        <p style={pStyle}>
          Kompletní podmínky najdete v dokumentu{" "}
          <Link href="/bazar/podminky-escrow" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Podmínky služby Bezpečná platba
          </Link>.
        </p>
      </div>

      {/* 6. Hlídací pes */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Hlídací pes</h2>
        <p style={pStyle}>
          Hledáte něco konkrétního? Nastavte si hlídacího psa — zadejte klíčová slova, kategorii
          nebo měřítko a systém vás automaticky upozorní, když se v bazaru objeví odpovídající inzerát.
        </p>
      </div>

      {/* 7. Správa inzerátů */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>7. Správa vašich inzerátů</h2>
        <p style={pStyle}>
          V sekci <strong style={{ color: "var(--text-primary)" }}>📋 Moje inzeráty</strong> najdete
          přehled všech svých inzerátů. Můžete:
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>Upravovat popis, fotky a cenu</li>
          <li style={liStyle}>Měnit stav (aktivní / rezervováno / prodáno)</li>
          <li style={liStyle}>Duplikovat inzerát pro podobné zboží</li>
          <li style={liStyle}>Smazat inzerát</li>
        </ul>
        <p style={pStyle}>
          Své transakce Bezpečné platby sledujete v sekci{" "}
          <strong style={{ color: "var(--text-primary)" }}>🛡️ Transakce</strong>.
        </p>
      </div>

      {/* 8. Pravidla bazaru */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>8. Pravidla bazaru</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>
            Inzerát musí obsahovat <strong style={{ color: "var(--text-primary)" }}>jasný popis</strong>,{" "}
            <strong style={{ color: "var(--text-primary)" }}>stav zboží</strong> a{" "}
            <strong style={{ color: "var(--text-primary)" }}>cenu</strong>.
          </li>
          <li style={liStyle}>
            Fotky nabízeného zboží jsou <strong style={{ color: "var(--text-primary)" }}>povinné</strong> — inzerát bez fotky nemůže být publikován.
          </li>
          <li style={liStyle}>
            Bazar slouží výhradně k prodeji modelářského zboží a příslušenství. Nesouvisející položky budou odstraněny.
          </li>
          <li style={liStyle}>
            Komerční nabídky obchodů a firem nepatří do bazaru — využijte sekci Novinky ze světa na fóru.
          </li>
          <li style={liStyle}>
            Podvodné inzeráty vedou k <strong style={{ color: "#ef4444" }}>okamžitému banu</strong>.
          </li>
          <li style={liStyle}>
            Prodávající odpovídá za správnost údajů v inzerátu a za stav nabízeného zboží.
          </li>
          <li style={liStyle}>
            Lokopolis nezodpovídá za průběh obchodu mimo službu Bezpečná platba.
          </li>
        </ul>
      </div>

      {/* 9. Hodnocení */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>9. Hodnocení prodávajících</h2>
        <p style={pStyle}>
          Po dokončení transakce přes Bezpečnou platbu může kupující ohodnotit prodávajícího
          (1–5 hvězdiček a slovní hodnocení). Hodnocení je veřejné a pomáhá ostatním
          kupujícím rozhodnout se, komu důvěřovat.
        </p>
        <p style={pStyle}>
          Falešná nebo manipulativní hodnocení jsou zakázána a budou odstraněna.
        </p>
      </div>

      {/* 10. Řešení sporů */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>10. Řešení sporů</h2>
        <p style={pStyle}>
          Pokud při Bezpečné platbě zboží neodpovídá popisu nebo nedorazí, kupující může otevřít spor.
          Administrátor Lokopolis posoudí situaci a rozhodne o uvolnění nebo vrácení platby.
        </p>
        <p style={pStyle}>
          Pro obchody mimo Bezpečnou platbu Lokopolis nemůže zasahovat — doporučujeme vždy využít
          Bezpečnou platbu pro cenově vyšší položky.
        </p>
      </div>

      {/* 11. Kontakt */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>11. Kontakt a podpora</h2>
        <p style={pStyle}>
          Máte otázku nebo problém? Napište nám na{" "}
          <a href="mailto:info@lokopolis.cz" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            info@lokopolis.cz
          </a>{" "}
          nebo využijte{" "}
          <Link href="/kontakt" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            kontaktní formulář
          </Link>.
        </p>
      </div>

      {/* Navigation */}
      <div
        style={{
          marginTop: "48px",
          paddingTop: "24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          fontSize: "14px",
        }}
      >
        <Link href="/bazar" style={{ color: "var(--accent)", textDecoration: "none" }}>
          ← Zpět do bazaru
        </Link>
        <Link href="/bazar/podminky-escrow" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>
          Podmínky Bezpečné platby
        </Link>
        <Link href="/pravidla" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>
          Pravidla komunity
        </Link>
        <Link href="/obchodni-podminky" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>
          Obchodní podmínky
        </Link>
      </div>
    </div>
  );
}
