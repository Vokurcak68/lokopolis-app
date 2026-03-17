import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Podmínky služby Bezpečná platba | Lokopolis.cz",
  description:
    "Podmínky používání služby Bezpečná platba (escrow) v bazaru Lokopolis.cz",
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

const subUlStyle: React.CSSProperties = {
  paddingLeft: "20px",
  listStyleType: "circle",
  marginTop: "4px",
};

export default function EscrowTermsPage() {
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
        🛡️ Podmínky služby Bezpečná platba
      </h1>
      <p
        style={{
          color: "var(--text-faint)",
          fontSize: "13px",
          marginBottom: "40px",
        }}
      >
        Platné od 18. 3. 2026
      </p>

      {/* 1. Definice */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>1. Definice pojmů</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Provozovatel</strong> —
            provozovatel webu Lokopolis.cz.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Bezpečná platba (escrow)</strong> —
            služba zprostředkování úhrady mezi kupujícím a prodávajícím, při které Provozovatel
            dočasně drží finanční prostředky kupujícího na svém účtu do splnění podmínek pro jejich
            uvolnění.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Kupující</strong> — registrovaný
            uživatel, který prostřednictvím Bezpečné platby hradí kupní cenu za zboží.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Prodávající</strong> — registrovaný
            uživatel, který v inzerátu povolil Bezpečnou platbu jako způsob úhrady.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Transakce</strong> — jednotlivý obchod
            zprostředkovaný přes Bezpečnou platbu.
          </li>
          <li style={liStyle}>
            <strong style={{ color: "var(--text-primary)" }}>Provize</strong> — poplatek za
            zprostředkování Bezpečné platby.
          </li>
        </ul>
      </div>

      {/* 2. Předmět služby */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Předmět služby</h2>
        <p style={pStyle}>
          2.1. Provozovatel poskytuje službu Bezpečná platba jako volitelný způsob úhrady v bazaru
          Lokopolis.cz. Služba slouží k ochraně obou stran transakce — kupující má jistotu, že
          peníze budou uvolněny prodávajícímu až po doručení zboží, a prodávající má jistotu, že
          kupující zaplatil.
        </p>
        <p style={pStyle}>
          2.2. Provozovatel není smluvní stranou kupní smlouvy mezi kupujícím a prodávajícím.
          Vystupuje výhradně jako zprostředkovatel platby.
        </p>
        <p style={pStyle}>
          2.3. Služba je dostupná pouze pro inzeráty, u kterých prodávající výslovně povolil
          Bezpečnou platbu a vyplnil požadovanou dodací adresu.
        </p>
      </div>

      {/* 3. Aktivace */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Aktivace služby prodávajícím</h2>
        <p style={pStyle}>
          3.1. Prodávající aktivuje Bezpečnou platbu zaškrtnutím příslušné volby při vytváření nebo
          úpravě inzerátu.
        </p>
        <p style={pStyle}>
          3.2. Aktivací prodávající souhlasí s těmito Podmínkami a s úhradou provize dle čl.&nbsp;6.
        </p>
        <p style={pStyle}>
          3.3. Pro aktivaci je prodávající povinen vyplnit dodací adresu. Tato adresa slouží
          k ověření identity prodávajícího a k zajištění bezpečného průběhu transakce. Adresa není
          veřejně zobrazována.
        </p>
        <p style={pStyle}>
          3.4. Prodávající může Bezpečnou platbu u inzerátu kdykoliv deaktivovat, pokud neprobíhá
          aktivní transakce.
        </p>
      </div>

      {/* 4. Průběh transakce */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Průběh transakce</h2>
        <p style={pStyle}>
          4.1. <strong style={{ color: "var(--text-primary)" }}>Vytvoření transakce</strong> —
          kupující klikne na &quot;Koupit s&nbsp;Bezpečnou platbou&quot;. Systém vygeneruje platební
          údaje (číslo účtu, variabilní symbol, částku).
        </p>
        <p style={pStyle}>
          4.2. <strong style={{ color: "var(--text-primary)" }}>Úhrada kupujícím</strong> —
          kupující převede celou kupní cenu na účet Provozovatele. Provozovatel potvrdí přijetí
          platby (ručně nebo automaticky).
        </p>
        <p style={pStyle}>
          4.3. <strong style={{ color: "var(--text-primary)" }}>Odeslání zboží</strong> —
          prodávající je povinen odeslat zboží do{" "}
          <strong style={{ color: "var(--accent)" }}>5&nbsp;pracovních dnů</strong> od potvrzení
          platby a zadat do systému sledovací číslo zásilky (je-li dostupné).
        </p>
        <p style={pStyle}>
          4.4. <strong style={{ color: "var(--text-primary)" }}>Potvrzení přijetí</strong> —
          kupující po obdržení zboží potvrdí v systému, že zboží odpovídá popisu a je v pořádku.
        </p>
        <p style={pStyle}>
          4.5. <strong style={{ color: "var(--text-primary)" }}>Automatické uvolnění</strong> —
          pokud kupující nepotvrdí přijetí ani neotevře spor do{" "}
          <strong style={{ color: "var(--accent)" }}>14&nbsp;dnů</strong> od označení zásilky jako
          odeslané, peníze se automaticky uvolní prodávajícímu.
        </p>
        <p style={pStyle}>
          4.6. <strong style={{ color: "var(--text-primary)" }}>Výplata prodávajícímu</strong> — po
          potvrzení přijetí (nebo automatickém uvolnění) Provozovatel odečte provizi a zbývající
          částku vyplatí prodávajícímu na jeho bankovní účet.
        </p>
      </div>

      {/* 5. Spory */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Spory</h2>
        <p style={pStyle}>5.1. Kupující může otevřít spor, pokud:</p>
        <ul style={ulStyle}>
          <li style={liStyle}>zboží nebylo doručeno ve stanovené lhůtě</li>
          <li style={liStyle}>zboží neodpovídá popisu v inzerátu</li>
          <li style={liStyle}>zboží je poškozené nebo nekompletní</li>
        </ul>
        <p style={{ ...pStyle, marginTop: "12px" }}>
          5.2. Spor je nutné otevřít <strong>před potvrzením přijetí</strong> a{" "}
          <strong>nejpozději do 14&nbsp;dnů</strong> od odeslání zboží prodávajícím.
        </p>
        <p style={pStyle}>
          5.3. Při otevření sporu kupující uvede důvod a přiloží fotografický důkaz (je-li
          relevantní).
        </p>
        <p style={pStyle}>
          5.4. Provozovatel spor posoudí a rozhodne jedním z těchto způsobů:
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <strong>vrácení celé částky kupujícímu</strong> (kupující vrátí zboží prodávajícímu na
            vlastní náklady)
          </li>
          <li style={liStyle}>
            <strong>uvolnění celé částky prodávajícímu</strong>
          </li>
          <li style={liStyle}>
            <strong>rozdělení částky</strong> mezi obě strany dle uvážení Provozovatele
          </li>
        </ul>
        <p style={{ ...pStyle, marginTop: "12px" }}>
          5.5. Rozhodnutí Provozovatele o sporu je konečné v rámci služby Bezpečná platba. Tím
          nejsou dotčena práva stran domáhat se svých nároků soudní cestou.
        </p>
      </div>

      {/* 6. Provize */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Provize</h2>
        <p style={pStyle}>
          6.1. Za zprostředkování Bezpečné platby hradí <strong>prodávající</strong> provizi.
        </p>
        <p style={pStyle}>
          6.2. Výše provize činí{" "}
          <strong style={{ color: "var(--accent)" }}>5&nbsp;%</strong> z celkové ceny inzerátu,
          nejméně však <strong style={{ color: "var(--accent)" }}>15&nbsp;Kč</strong>. Aktuální
          sazby jsou zobrazeny prodávajícímu při aktivaci Bezpečné platby a kupujícímu při vytvoření
          transakce.
        </p>
        <p style={pStyle}>
          6.3. Provize se strhává automaticky z částky určené k výplatě prodávajícímu.
        </p>
        <p style={pStyle}>
          6.4. Provozovatel si vyhrazuje právo výši provize změnit. Změna se nevztahuje na již
          probíhající transakce.
        </p>
      </div>

      {/* 7. Zrušení transakce */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>7. Zrušení transakce</h2>
        <p style={pStyle}>
          7.1. Kupující může transakci zrušit <strong>před odesláním platby</strong> bez jakýchkoliv
          poplatků.
        </p>
        <p style={pStyle}>7.2. Po přijetí platby může být transakce zrušena pouze:</p>
        <ul style={ulStyle}>
          <li style={liStyle}>vzájemnou dohodou obou stran</li>
          <li style={liStyle}>rozhodnutím Provozovatele v rámci řešení sporu</li>
          <li style={liStyle}>
            pokud prodávající neodešle zboží ve stanovené lhůtě — v takovém případě se celá částka
            vrací kupujícímu
          </li>
        </ul>
      </div>

      {/* 8. Odpovědnost */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>8. Odpovědnost Provozovatele</h2>
        <p style={pStyle}>
          8.1. Provozovatel odpovídá za řádné vedení svěřených finančních prostředků a jejich včasné
          vyplacení dle těchto Podmínek.
        </p>
        <p style={pStyle}>8.2. Provozovatel <strong>neodpovídá</strong> za:</p>
        <ul style={ulStyle}>
          <li style={liStyle}>kvalitu, pravost ani stav prodávaného zboží</li>
          <li style={liStyle}>jednání kupujícího nebo prodávajícího mimo platformu</li>
          <li style={liStyle}>škody vzniklé při přepravě zásilky</li>
          <li style={liStyle}>prodlevy způsobené bankovním převodem nebo přepravní službou</li>
        </ul>
        <p style={{ ...pStyle, marginTop: "12px" }}>
          8.3. Provozovatel si vyhrazuje právo pozastavit nebo odmítnout transakci při podezření na
          podvodné jednání.
        </p>
      </div>

      {/* 9. Ochrana osobních údajů */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>9. Ochrana osobních údajů</h2>
        <p style={pStyle}>
          9.1. Osobní údaje zpracovávané v rámci Bezpečné platby (jméno, adresa, bankovní údaje)
          jsou využívány výhradně pro účely realizace transakce.
        </p>
        <p style={pStyle}>
          9.2. Podrobnosti o zpracování osobních údajů jsou uvedeny v dokumentu{" "}
          <Link
            href="/ochrana-udaju"
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            Ochrana osobních údajů
          </Link>
          .
        </p>
      </div>

      {/* 10. Závěrečná ustanovení */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>10. Závěrečná ustanovení</h2>
        <p style={pStyle}>
          10.1. Tyto Podmínky nabývají účinnosti dnem zveřejnění na webu Lokopolis.cz.
        </p>
        <p style={pStyle}>
          10.2. Provozovatel si vyhrazuje právo tyto Podmínky změnit. O podstatných změnách budou
          uživatelé informováni. Pro probíhající transakce platí vždy verze Podmínek platná
          v okamžiku vytvoření transakce.
        </p>
        <p style={pStyle}>
          10.3. Použitím služby Bezpečná platba uživatel potvrzuje, že se s těmito Podmínkami
          seznámil a souhlasí s nimi.
        </p>
        <p style={pStyle}>
          10.4. Právní vztahy neupravené těmito Podmínkami se řídí zákonem č.&nbsp;89/2012&nbsp;Sb.
          (občanský zákoník).
        </p>
      </div>

      {/* Zpět */}
      <div
        style={{
          marginTop: "40px",
          textAlign: "center",
          padding: "24px",
          borderRadius: "12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <Link
          href="/bazar/bezpecna-platba"
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
          🛡️ Jak Bezpečná platba funguje →
        </Link>
      </div>
    </div>
  );
}
