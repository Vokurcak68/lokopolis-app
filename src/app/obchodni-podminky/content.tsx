"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";

const sectionStyle: CSSProperties = {
  marginBottom: "32px",
};

const h2Style: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: "12px",
  paddingBottom: "8px",
  borderBottom: "1px solid var(--border)",
};

const pStyle: CSSProperties = {
  color: "var(--text-muted)",
  lineHeight: 1.7,
  marginBottom: "12px",
  fontSize: "15px",
};

const liStyle: CSSProperties = {
  color: "var(--text-muted)",
  lineHeight: 1.7,
  marginBottom: "6px",
  fontSize: "15px",
};

function DefaultContent() {
  return (
    <>
      <div style={sectionStyle}>
        <h2 style={h2Style}>1. Základní ustanovení</h2>
        <p style={pStyle}>
          Tyto všeobecné obchodní podmínky (dále jen &quot;VOP&quot;) upravují práva a povinnosti smluvních stran 
          vzniklé v souvislosti s nákupem zboží a digitálních produktů prostřednictvím internetového obchodu 
          <strong style={{ color: "var(--accent)" }}> Lokopolis.cz</strong>, provozovaného na adrese{" "}
          <a href="https://lokopolis.cz" style={{ color: "var(--accent)" }}>lokopolis.cz</a>.
        </p>
        <p style={pStyle}>
          E-shop Lokopolis.cz se specializuje na prodej produktů spojených s modelovou železnicí — 
          modely lokomotiv, vagónů, kolejí, příslušenství, budov, elektroniky, literatury a digitálních produktů 
          (kolejové plány, STL modely pro 3D tisk, návody ke stažení).
        </p>
        <p style={pStyle}>
          Kupující odesláním objednávky potvrzuje, že se seznámil s těmito VOP a že s nimi souhlasí.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Objednávka a uzavření smlouvy</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Nabídka zboží na webu je nezávazná. Vystavené produkty nepředstavují návrh na uzavření smlouvy.</li>
          <li style={liStyle}>Objednávka kupujícího je návrhem kupní smlouvy. Smlouva je uzavřena okamžikem přijetí objednávky prodávajícím (potvrzovací e-mail).</li>
          <li style={liStyle}>Kupující může objednávat jako registrovaný uživatel i jako host (bez registrace).</li>
          <li style={liStyle}>Prodávající si vyhrazuje právo odmítnout objednávku, pokud je zboží vyprodáno, obsahuje chybnou cenu nebo existuje podezření na podvodné jednání.</li>
          <li style={liStyle}>Po odeslání objednávky obdrží kupující potvrzení na uvedený e-mail s číslem objednávky a přehledem objednaného zboží.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Ceny a platební podmínky</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Všechny ceny jsou uvedeny v českých korunách (CZK) včetně DPH, je-li prodávající plátcem DPH.</li>
          <li style={liStyle}>Cena zboží je platná v okamžiku odeslání objednávky.</li>
          <li style={liStyle}>K ceně zboží se připočítává cena dopravy a případný příplatek za zvolený způsob platby, které jsou uvedeny v průběhu objednávky.</li>
          <li style={liStyle}>
            Dostupné způsoby platby:
            <ul style={{ paddingLeft: "20px", listStyleType: "circle", marginTop: "4px" }}>
              <li style={liStyle}>Bankovní převod — platba předem na účet prodávajícího</li>
              <li style={liStyle}>QR platba — pomocí QR kódu v potvrzovacím e-mailu</li>
              <li style={liStyle}>Dobírka — platba při převzetí zásilky (pokud je dostupná)</li>
            </ul>
          </li>
          <li style={liStyle}>Při platbě bankovním převodem je kupující povinen uvést správný variabilní symbol. Objednávka bude zpracována po připsání platby.</li>
          <li style={liStyle}>Kupóny a věrnostní body lze uplatnit v průběhu objednávky. Podmínky jednotlivých kupónů jsou uvedeny u každé akce.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Doprava a doručení</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Způsoby dopravy a jejich ceny jsou zobrazeny v průběhu objednávky a závisí na povaze zboží (fyzické/digitální).</li>
          <li style={liStyle}>Objednávka je expedována zpravidla do 1–3 pracovních dnů od přijetí platby.</li>
          <li style={liStyle}>Doba doručení závisí na zvoleném přepravci — obvykle 1–3 pracovní dny po expedici.</li>
          <li style={liStyle}>Kupující je povinen zkontrolovat zásilku při převzetí. Viditelné poškození obalu je nutné reklamovat přímo u přepravce.</li>
          <li style={liStyle}>Při objednávce nad stanovenou částku (uvedenou u konkrétního způsobu dopravy) může být doprava zdarma.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Digitální produkty</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Digitální produkty (kolejové plány, STL modely, návody ke stažení) jsou po zaplacení zpřístupněny ke stažení v uživatelském účtu.</li>
          <li style={liStyle}>Bezplatné digitální produkty jsou zpřístupněny ihned po objednávce.</li>
          <li style={liStyle}>Digitální produkty jsou určeny výhradně pro osobní potřebu kupujícího. Další šíření, prodej nebo úprava bez souhlasu autora je zakázána.</li>
          <li style={liStyle}>U digitálních produktů kupující souhlasem s VOP výslovně žádá o poskytnutí digitálního obsahu před uplynutím lhůty pro odstoupení od smlouvy a bere na vědomí, že tím ztrácí právo na odstoupení.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Odstoupení od smlouvy</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>
            Kupující (spotřebitel) má právo odstoupit od smlouvy bez udání důvodu do <strong>14 dnů</strong> od 
            převzetí zboží, a to v souladu s § 1829 občanského zákoníku.
          </li>
          <li style={liStyle}>Odstoupení je nutné oznámit e-mailem na <a href="mailto:info@lokopolis.cz" style={{ color: "var(--accent)" }}>info@lokopolis.cz</a> s uvedením čísla objednávky.</li>
          <li style={liStyle}>Zboží musí být vráceno kompletní, nepoškozené a v původním obalu (pokud to povaha zboží umožňuje).</li>
          <li style={liStyle}>Kupní cena bude vrácena do 14 dnů od doručení vráceného zboží, a to stejným způsobem, jakým byla přijata.</li>
          <li style={liStyle}>Náklady na vrácení zboží nese kupující.</li>
          <li style={liStyle}>
            <strong>Výjimky z práva na odstoupení:</strong>
            <ul style={{ paddingLeft: "20px", listStyleType: "circle", marginTop: "4px" }}>
              <li style={liStyle}>Digitální obsah dodaný na žádost kupujícího před uplynutím lhůty pro odstoupení</li>
              <li style={liStyle}>Zboží upravené na míru dle přání kupujícího</li>
              <li style={liStyle}>Zboží, které bylo z hygienických důvodů rozbaleno a nelze vrátit</li>
            </ul>
          </li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>7. Reklamace a záruka</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Práva z vadného plnění se řídí příslušnými ustanoveními občanského zákoníku (§ 2099 a násl.).</li>
          <li style={liStyle}>Zákonná lhůta pro uplatnění práv z vad je 24 měsíců od převzetí zboží.</li>
          <li style={liStyle}>Reklamaci uplatněte e-mailem na <a href="mailto:info@lokopolis.cz" style={{ color: "var(--accent)" }}>info@lokopolis.cz</a> s popisem vady a přiloženou fotografií.</li>
          <li style={liStyle}>Reklamace bude vyřízena do 30 dnů od jejího uplatnění.</li>
          <li style={liStyle}>U modelů a příslušenství prosíme o ohleduplné zacházení — jedná se o křehké sběratelské předměty.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>8. Ochrana osobních údajů</h2>
        <p style={pStyle}>
          Podrobné informace o zpracování osobních údajů najdete v dokumentu{" "}
          <Link href="/ochrana-udaju" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Ochrana osobních údajů
          </Link>.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>9. Věrnostní program</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Registrovaní uživatelé se automaticky účastní věrnostního programu.</li>
          <li style={liStyle}>Za nákupy jsou přidělovány body, které lze uplatnit jako slevu na další objednávky.</li>
          <li style={liStyle}>Podrobné podmínky věrnostního programu jsou uvedeny v uživatelském profilu.</li>
          <li style={liStyle}>Prodávající si vyhrazuje právo podmínky věrnostního programu změnit. O změnách budou uživatelé informováni.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>10. Závěrečná ustanovení</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Tyto VOP jsou platné a účinné od 14. 3. 2026.</li>
          <li style={liStyle}>Právní vztahy neupravené těmito VOP se řídí zákonem č. 89/2012 Sb. (občanský zákoník) a zákonem č. 634/1992 Sb. (o ochraně spotřebitele).</li>
          <li style={liStyle}>Případné spory budou řešeny mimosoudně prostřednictvím České obchodní inspekce (ČOI) — <a href="https://www.coi.cz" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>www.coi.cz</a>.</li>
          <li style={liStyle}>Prodávající si vyhrazuje právo tyto VOP měnit. Změny nabývají účinnosti zveřejněním na webu.</li>
          <li style={liStyle}>Pro nákupy platí vždy verze VOP platná v době odeslání objednávky.</li>
        </ul>
      </div>
    </>
  );
}

export function ObchodniPodminkyContent() {
  const [customHtml, setCustomHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/shop/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.page_vop && typeof data.page_vop === "string") {
          setCustomHtml(data.page_vop);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ height: "32px", width: "300px", background: "var(--bg-card)", borderRadius: "8px", marginBottom: "40px" }} />
        <div style={{ height: "200px", background: "var(--bg-card)", borderRadius: "8px" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
        Všeobecné obchodní podmínky
      </h1>
      <p style={{ color: "var(--text-faint)", fontSize: "13px", marginBottom: "40px" }}>
        Platné od 14. 3. 2026
      </p>

      {customHtml ? (
        <div
          style={{ color: "var(--text-muted)", lineHeight: 1.7, fontSize: "15px" }}
          dangerouslySetInnerHTML={{ __html: customHtml }}
        />
      ) : (
        <DefaultContent />
      )}
    </div>
  );
}
