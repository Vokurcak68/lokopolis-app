"use client";

import { useState, useEffect } from "react";
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
        <h2 style={h2Style}>1. Správce osobních údajů</h2>
        <p style={pStyle}>
          Správcem osobních údajů je provozovatel webu <strong style={{ color: "var(--accent)" }}>Lokopolis.cz</strong>, 
          internetového obchodu a komunity zaměřené na modelovou železnici a modelářství.
        </p>
        <p style={pStyle}>
          Kontaktní e-mail: <a href="mailto:info@lokopolis.cz" style={{ color: "var(--accent)" }}>info@lokopolis.cz</a>
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Účel zpracování osobních údajů</h2>
        <p style={pStyle}>Vaše osobní údaje zpracováváme pro následující účely:</p>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}><strong>Zpracování objednávek</strong> — jméno, e-mail, adresa, telefon pro vyřízení a doručení objednávky z e-shopu (modely, příslušenství, digitální produkty)</li>
          <li style={liStyle}><strong>Správa uživatelského účtu</strong> — uživatelské jméno, e-mail, heslo (hashované) pro přihlašování a personalizaci</li>
          <li style={liStyle}><strong>Komunikace</strong> — e-mail pro zasílání potvrzení objednávek, notifikací o změně stavu objednávky a odpovědí na dotazy z kontaktního formuláře</li>
          <li style={liStyle}><strong>Věrnostní program</strong> — sledování bodů a úrovní pro poskytování slev registrovaným zákazníkům</li>
          <li style={liStyle}><strong>Komunita a fórum</strong> — uživatelské jméno a příspěvky pro fungování fóra a diskuzí</li>
          <li style={liStyle}><strong>Bazar</strong> — kontaktní údaje pro zprostředkování prodeje mezi uživateli</li>
          <li style={liStyle}><strong>Zabezpečení</strong> — IP adresy a technické údaje pro ochranu proti zneužití (anti-spam, rate limiting)</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Právní základ zpracování</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}><strong>Plnění smlouvy</strong> (čl. 6 odst. 1 písm. b) GDPR) — zpracování údajů nezbytných pro vyřízení objednávky a poskytnutí služeb e-shopu</li>
          <li style={liStyle}><strong>Oprávněný zájem</strong> (čl. 6 odst. 1 písm. f) GDPR) — zabezpečení webu, prevence podvodů, vedení interní statistiky</li>
          <li style={liStyle}><strong>Souhlas</strong> (čl. 6 odst. 1 písm. a) GDPR) — zpracování údajů nad rámec plnění smlouvy, např. účast ve věrnostním programu, zasílání informací o novinkách</li>
          <li style={liStyle}><strong>Právní povinnost</strong> (čl. 6 odst. 1 písm. c) GDPR) — uchování fakturačních údajů dle zákona o účetnictví</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Kategorie zpracovávaných údajů</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}>Identifikační údaje: jméno, příjmení, uživatelské jméno</li>
          <li style={liStyle}>Kontaktní údaje: e-mailová adresa, telefonní číslo, doručovací a fakturační adresa</li>
          <li style={liStyle}>Fakturační údaje: IČO, DIČ (u podnikatelů)</li>
          <li style={liStyle}>Údaje o objednávkách: historie nákupů, věrnostní body</li>
          <li style={liStyle}>Technické údaje: IP adresa, cookies, informace o prohlížeči</li>
          <li style={liStyle}>Uživatelský obsah: příspěvky na fóru, inzeráty v bazaru, recenze</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Příjemci osobních údajů</h2>
        <p style={pStyle}>Vaše osobní údaje mohou být předány následujícím příjemcům:</p>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}><strong>Přepravní společnosti</strong> — pro doručení fyzických zásilek (jméno, adresa, telefon)</li>
          <li style={liStyle}><strong>Supabase</strong> — poskytovatel databázové a autentizační infrastruktury (data uložena v EU)</li>
          <li style={liStyle}><strong>Vercel</strong> — hosting webové aplikace</li>
          <li style={liStyle}><strong>Cloudflare</strong> — zabezpečení a ochrana proti botům (Turnstile)</li>
        </ul>
        <p style={pStyle}>
          Osobní údaje neprodáváme ani nepředáváme třetím stranám pro marketingové účely.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Doba uchování údajů</h2>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}><strong>Údaje o objednávkách</strong> — po dobu 10 let od uskutečnění objednávky (zákonná povinnost dle zákona o účetnictví)</li>
          <li style={liStyle}><strong>Uživatelský účet</strong> — po dobu existence účtu; po smazání účtu do 30 dnů</li>
          <li style={liStyle}><strong>Kontaktní formulář</strong> — po dobu nezbytnou pro vyřízení dotazu, max. 1 rok</li>
          <li style={liStyle}><strong>Technické logy</strong> — max. 90 dnů</li>
          <li style={liStyle}><strong>Cookies</strong> — dle typu cookies, viz sekce o cookies</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>7. Vaše práva</h2>
        <p style={pStyle}>Jako subjekt údajů máte následující práva:</p>
        <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
          <li style={liStyle}><strong>Právo na přístup</strong> — můžete požádat o informace o tom, jaké údaje o vás zpracováváme</li>
          <li style={liStyle}><strong>Právo na opravu</strong> — můžete požádat o opravu nepřesných údajů (většinu údajů si můžete upravit přímo v profilu)</li>
          <li style={liStyle}><strong>Právo na výmaz</strong> — můžete požádat o smazání vašich údajů (s výjimkou údajů, které jsme povinni uchovávat ze zákona)</li>
          <li style={liStyle}><strong>Právo na přenositelnost</strong> — můžete požádat o export vašich údajů ve strojově čitelném formátu</li>
          <li style={liStyle}><strong>Právo vznést námitku</strong> — můžete namítat proti zpracování na základě oprávněného zájmu</li>
          <li style={liStyle}><strong>Právo odvolat souhlas</strong> — souhlas se zpracováním můžete kdykoli odvolat</li>
        </ul>
        <p style={pStyle}>
          Pro uplatnění svých práv nás kontaktujte na{" "}
          <a href="mailto:info@lokopolis.cz" style={{ color: "var(--accent)" }}>info@lokopolis.cz</a>. 
          Na vaši žádost odpovíme do 30 dnů.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>8. Cookies</h2>
        <p style={pStyle}>
          Web Lokopolis.cz používá nezbytné cookies pro správné fungování (přihlášení, nastavení tématu, souhlas s cookies). 
          Analytické nebo marketingové cookies nepoužíváme. Podrobnosti o používaných cookies najdete v cookie banneru při první návštěvě.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>9. Zabezpečení údajů</h2>
        <p style={pStyle}>
          Vaše údaje chráníme pomocí šifrovaného přenosu (HTTPS/TLS), hashování hesel, 
          přístupu na základě rolí a pravidelných bezpečnostních aktualizací. 
          Přístup k osobním údajům mají pouze oprávnění správci webu.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>10. Stížnost u dozorového úřadu</h2>
        <p style={pStyle}>
          Pokud se domníváte, že vaše osobní údaje zpracováváme v rozporu s právními předpisy, 
          máte právo podat stížnost u Úřadu pro ochranu osobních údajů (ÚOOÚ):
        </p>
        <div style={{ padding: "16px", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border)", marginTop: "8px" }}>
          <p style={{ ...pStyle, marginBottom: "4px" }}><strong>Úřad pro ochranu osobních údajů</strong></p>
          <p style={{ ...pStyle, marginBottom: "4px" }}>Pplk. Sochora 27, 170 00 Praha 7</p>
          <p style={{ ...pStyle, marginBottom: "4px" }}>
            Web: <a href="https://www.uoou.cz" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>www.uoou.cz</a>
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            E-mail: <a href="mailto:posta@uoou.cz" style={{ color: "var(--accent)" }}>posta@uoou.cz</a>
          </p>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>11. Změny těchto zásad</h2>
        <p style={pStyle}>
          Tyto zásady ochrany osobních údajů můžeme aktualizovat. O významných změnách vás budeme informovat 
          prostřednictvím e-mailu nebo oznámením na webu. Aktuální verze je vždy dostupná na této stránce.
        </p>
      </div>
    </>
  );
}

export function OchranaUdajuContent() {
  const [customHtml, setCustomHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/shop/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.page_gdpr && typeof data.page_gdpr === "string") {
          setCustomHtml(data.page_gdpr);
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
        Ochrana osobních údajů
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
