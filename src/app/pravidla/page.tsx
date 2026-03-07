"use client";

export default function RulesPage() {
  const sections = [
    {
      icon: "🤝",
      title: "1. Respekt a slušnost",
      rules: [
        "Jednejte s ostatními tak, jak chcete, aby jednali s vámi.",
        "Osobní útoky, urážky a šikana jsou zakázány.",
        "Respektujte odlišné názory — ne každý staví stejné měřítko nebo preferuje stejného výrobce.",
        "Diskuze by měla být věcná a konstruktivní.",
      ],
    },
    {
      icon: "📝",
      title: "2. Obsah příspěvků",
      rules: [
        "Pište česky (nebo slovensky). Příspěvky v jiných jazycích mohou být smazány.",
        "Používejte výstižné nadpisy — ne jen \"Pomoc!!!\" nebo \"Dotaz\".",
        "Zakládejte vlákna ve správné sekci fóra.",
        "Nekopírujte cizí texty ani obrázky bez souhlasu autora. Vždy uveďte zdroj.",
        "Zakázán je spam, opakované příspěvky a bezvýznamné příspěvky.",
      ],
    },
    {
      icon: "🛒",
      title: "3. Bazar",
      rules: [
        "Inzerát musí obsahovat jasný popis, stav zboží a orientační cenu.",
        "Fotky nabízeného zboží jsou povinné.",
        "Podvodné inzeráty vedou k okamžitému banu.",
        "Lokopolis nezodpovídá za průběh obchodu mezi uživateli.",
        "Komerční nabídky obchodů patří do sekce Novinky ze světa, ne do bazaru.",
      ],
    },
    {
      icon: "📸",
      title: "4. Obrázky a média",
      rules: [
        "Nahrávejte pouze vlastní fotky a videa, nebo obsah s povolením autora.",
        "Pornografický, násilný nebo jinak nevhodný obsah je zakázán.",
        "Dbejte na rozumnou velikost obrázků — web není osobní cloudové úložiště.",
      ],
    },
    {
      icon: "🔒",
      title: "5. Bezpečnost a soukromí",
      rules: [
        "Nezveřejňujte osobní údaje jiných lidí (adresa, telefon, e-mail) bez jejich souhlasu.",
        "Nevyhrožujte, nesledujte a neobtěžujte ostatní uživatele.",
        "Každý uživatel smí mít pouze jeden účet.",
        "Sdílení přihlašovacích údajů je zakázáno.",
      ],
    },
    {
      icon: "⚖️",
      title: "6. Moderace",
      rules: [
        "Moderátoři a administrátoři mají právo upravit, skrýt nebo smazat jakýkoliv obsah porušující pravidla.",
        "Ban z fóra může být dočasný nebo trvalý podle závažnosti porušení.",
        "Rozhodnutí moderátorů je konečné. Pokud nesouhlasíte, kontaktujte administrátora.",
        "Obcházení banu (nový účet) vede k trvalému zákazu.",
      ],
    },
    {
      icon: "⚠️",
      title: "7. Zakázaný obsah",
      rules: [
        "Reklama a spam bez povolení administrace.",
        "Politická propaganda a extremistický obsah.",
        "Nelegální obsah nebo návody k protiprávní činnosti.",
        "Malware, phishing a podvodné odkazy.",
      ],
    },
  ];

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        <span style={{ color: "#fff" }}>Pravidla </span>
        <span style={{ color: "#f0a030" }}>komunity</span>
      </h1>
      <p style={{ fontSize: "15px", color: "#8a8ea0", marginBottom: "40px" }}>
        Aby se tu všem líbilo a dobře spolupracovalo, dodržujte prosím tato pravidla.
      </p>

      {/* Rules */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {sections.map((sec) => (
          <section
            key={sec.title}
            style={{
              background: "#1a1e2e",
              border: "1px solid #252838",
              borderRadius: "12px",
              padding: "24px 28px",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#f0a030", marginBottom: "14px" }}>
              {sec.icon} {sec.title}
            </h2>
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {sec.rules.map((rule, i) => (
                <li key={i} style={{ fontSize: "14px", color: "#c8c8d0", lineHeight: 1.6 }}>
                  {rule}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Footer note */}
      <div
        style={{
          marginTop: "32px",
          padding: "20px 24px",
          background: "rgba(240,160,48,0.06)",
          border: "1px solid rgba(240,160,48,0.15)",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "14px", color: "#a0a4b8", lineHeight: 1.6 }}>
          Registrací na Lokopolis souhlasíte s těmito pravidly. Pravidla mohou být kdykoliv aktualizována.
          <br />
          <span style={{ color: "#6a6e80", fontSize: "13px" }}>Poslední aktualizace: březen 2026</span>
        </p>
      </div>
    </div>
  );
}
