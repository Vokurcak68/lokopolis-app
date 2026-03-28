"use client";

import { useState, type ReactNode } from "react";

const tabs = [
  { id: "quick", label: "🚀 Rychlý start" },
  { id: "board", label: "📐 Deska" },
  { id: "tracks", label: "🛤️ Koleje" },
  { id: "portals", label: "🚪 Portály" },
  { id: "elevation", label: "📏 Výšky" },
  { id: "shortcuts", label: "⌨️ Klávesy" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <h4
        style={{
          margin: "0 0 10px 0",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-heading)",
        }}
      >
        {title}
      </h4>
      <div style={{ color: "var(--text-body)", lineHeight: 1.65, fontSize: 14 }}>{children}</div>
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(245,158,11,0.45)",
        background: "rgba(245,158,11,0.12)",
        borderRadius: 10,
        padding: "10px 12px",
        color: "var(--text-body)",
        fontSize: 13,
        marginTop: 6,
      }}
    >
      💡 {children}
    </div>
  );
}

function DotList({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
          <span style={{ opacity: 0.7, marginTop: 2 }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StepList({ items }: { items: ReactNode[] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              background: "var(--accent)",
              color: "#111",
              marginTop: 1,
            }}
          >
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function TwoCol({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" style={{ marginBottom: 14 }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function TabQuick() {
  return (
    <div>
      <Card title="Začni během minuty">
        <StepList
          items={[
            <>Vlevo vyber kolej z katalogu a klikni na desku.</>,
            <>Přidávej další díly — napojení probíhá automaticky přes koncové body.</>,
            <>
              Pro tunel/most použij <strong>🚪 Portál ▾</strong> (single nebo double).
            </>,
            <>Přepni na <strong>🏔️ 3D</strong> a zkontroluj výšky + průjezdy.</>,
          ]}
        />
      </Card>

      <TwoCol
        left={
          <Card title="Nejčastější klávesy">
            <DotList
              items={[
                <><strong>Delete / Backspace</strong> = smazat vybraný objekt</>,
                <><strong>Ctrl + Z / Ctrl + Shift + Z</strong> = zpět / znovu</>,
                <><strong>R</strong> = otočit vybranou kolej (pokud není napojená)</>,
                <><strong>F</strong> = zrcadlit vybranou kolej / výhybku</>,
              ]}
            />
          </Card>
        }
        right={
          <Card title="Nové funkce">
            <DotList
              items={[
                <><strong>⤴️ Vždy navrch</strong> — kolej je ve 2D nad overlayi</>,
                <><strong>🟢 Vždy pod tunelem</strong> — kolej je vždy schovaná pod tunelem</>,
                <>Na plátně uvidíš štítky <strong>TOP</strong> / <strong>TUN</strong></>,
                <>Tunel/most tlačítka jsou sloučená pod <strong>🚪 Portál</strong></>,
              ]}
            />
          </Card>
        }
      />

      <Tip>Po větších úpravách portálů mrkni i do 3D pohledu, ať hned vidíš, že párování sedí.</Tip>
    </div>
  );
}

function TabBoard() {
  return (
    <div>
      <Card title="Nastavení desky">
        <DotList
          items={[
            <><strong>Obdélník</strong> — nejrychlejší start</>,
            <><strong>L tvar</strong> — nastavíš ramena + roh výřezu (↖ ↗ ↙ ↘)</>,
            <><strong>U tvar</strong> — nastavíš hloubku výřezu + šířku ramen</>,
          ]}
        />
      </Card>

      <Card title="Doporučený postup">
        <StepList
          items={[
            <>Nejdřív nastav celkové rozměry desky (šířka × hloubka v cm).</>,
            <>Pak dolaď parametry L/U tvaru.</>,
            <>Až potom začni pokládat koleje.</>,
          ]}
        />
      </Card>

      <TwoCol
        left={
          <Card title="L tvar — jak chápat ramena a výřez">
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>L ramena</strong> jsou části, které <strong>zůstávají</strong>. Šipka určuje roh, kde bude výřez.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                fontSize: 12,
                lineHeight: 1.4,
                overflowX: "auto",
              }}
            >{`Příklad: deska 200×100, L ramena 80×60, roh ↘

┌──────────────────┐
│                  │
│                  │  60 cm (rameno)
│      ┌───────────┘
│      │   ↘ výřez
│      │
└──────┘
 80 cm (rameno)`}</pre>
          </Card>
        }
        right={
          <Card title="U tvar — hloubka výřezu + šířka ramen">
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>U hloubka</strong> = jak hluboko jde výřez. <strong>Šířka ramen</strong> = levý/pravý pás, který zůstane.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                fontSize: 12,
                lineHeight: 1.4,
                overflowX: "auto",
              }}
            >{`Příklad: deska 200×100, U hloubka 60, ramena 40

┌──────┐          ┌──────┐
│      │  výřez   │      │
│      │ 120 cm   │      │  60 cm
│      └──────────┘      │
│                        │
└────────────────────────┘
 40 cm      120 cm      40 cm`}</pre>
          </Card>
        }
      />

      <Tip>
        Když si nejsi jistý tvarem, nejdřív nastav desku nahrubo, pak dolaď L/U parametry po krocích a sleduj obrys v reálném čase.
      </Tip>
      <Tip>Měřítko TT/H0 přepínej podle katalogu kolejí, ne podle rozměru desky.</Tip>
    </div>
  );
}
function TabTracks() {
  return (
    <div>
      <Card title="Pokládání a napojování kolejí">
        <DotList
          items={[
            <>Vyber díl v katalogu vlevo a klikni na desku.</>,
            <>Konce se přichytávají automaticky.</>,
            <><strong>Červený bod</strong> = volný konec, <strong>Zelený bod</strong> = napojený konec.</>,
          ]}
        />
      </Card>

      <Card title="Výběr a přesun více kolejí">
        <DotList
          items={[
            <><strong>Klik</strong> = výběr jedné koleje</>,
            <><strong>Ctrl + klik</strong> = přidání/odebrání z výběru</>,
            <><strong>Tažení na prázdné ploše</strong> = obdélníkový výběr</>,
            <>Vybrané koleje se přesouvají společně.</>,
          ]}
        />
      </Card>

      <Card title="Flagy vybrané koleje">
        <DotList
          items={[
            <><strong>⤴️ Vždy navrch</strong> vykreslí kolej nad overlayi</>,
            <><strong>🟢 Vždy pod tunelem</strong> vykreslí kolej pod tunelem</>,
            <>Oba flagy jsou vzájemně exkluzivní.</>,
            <>Na plátně se ukáže štítek <strong>TOP</strong> nebo <strong>TUN</strong>.</>,
          ]}
        />
      </Card>
    </div>
  );
}

function TabPortals() {
  return (
    <div>
      <Card title="Portály: tunel i most na jednom místě">
        <p style={{ margin: 0 }}>Pro tunel i most používej jen <strong>🚪 Portál ▾</strong> v horní liště.</p>
      </Card>

      <TwoCol
        left={
          <Card title="Jednokolejný portál (single)">
            <StepList
              items={[
                <>🚪 Portál ▾ → zvol typ + <strong>single</strong></>,
                <>1. klik = začátek</>,
                <>2. klik = konec</>,
              ]}
            />
          </Card>
        }
        right={
          <Card title="Dvojkolejný portál (double)">
            <StepList
              items={[
                <>🚪 Portál ▾ → zvol typ + <strong>double</strong></>,
                <>1. a 2. klik = dvě startovní koleje</>,
                <>3. a 4. klik = dvě koncové koleje</>,
              ]}
            />
          </Card>
        }
      />

      <Card title="Úpravy a mazání">
        <DotList items={[<>Klik na portál = výběr</>, <><strong>Delete</strong> nebo tlačítko <strong>🗑 Smazat</strong></>]} />
      </Card>
    </div>
  );
}

function TabElevation() {
  return (
    <div>
      <Card title="Výškový profil">
        <StepList
          items={[
            <>Zapni režim <strong>📐 Výšky</strong>.</>,
            <>Klikni na kolej a zadej výšku v mm.</>,
            <>Bod můžeš kdykoliv upravit nebo smazat.</>,
          ]}
        />
      </Card>

      <Card title="Barvy bodů">
        <DotList
          items={[
            <>🟢 0 mm (úroveň desky)</>,
            <>🔵 kladná výška (nad deskou)</>,
            <>🔴 záporná výška (pod deskou)</>,
          ]}
        />
      </Card>

      <Tip>V 3D zkontroluj sklon i průjezdnost. V praxi drž stoupání ideálně do 3–4 %.</Tip>
    </div>
  );
}

function TabShortcuts() {
  const rows = [
    ["Delete / Backspace", "Smazat vybranou kolej / portál / zónu"],
    ["Ctrl + Z", "Zpět (Undo)"],
    ["Ctrl + Shift + Z", "Znovu (Redo)"],
    ["R", "Otočit vybranou kolej / ghost při vkládání"],
    ["F", "Zrcadlit vybranou kolej (flip)"],
    ["Ctrl + klik", "Přidat/odebrat kolej z multivýběru"],
    ["Escape", "Zrušit aktuální režim"],
    ["Kolečko myši", "Zoom"],
    ["Pravé tlačítko + tažení", "Posun plátna"],
  ] as const;

  return (
    <div>
      <section style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            {rows.map(([key, desc], i) => (
              <tr key={key} style={{ background: i % 2 ? "transparent" : "var(--bg-card)" }}>
                <td style={{ padding: "10px 12px", verticalAlign: "top", width: "40%" }}>
                  <kbd
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--bg-input)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontFamily: "monospace",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {key}
                  </kbd>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--text-body)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Tip>Na mobilu/tabletu používej pro posun plátna gesto dvěma prsty.</Tip>
    </div>
  );
}

const tabContent: Record<TabId, () => ReactNode> = {
  quick: TabQuick,
  board: TabBoard,
  tracks: TabTracks,
  portals: TabPortals,
  elevation: TabElevation,
  shortcuts: TabShortcuts,
};

export function TrackHelpModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("quick");
  const Content = tabContent[activeTab];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          maxHeight: "90vh",
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "var(--bg-page)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-heading)" }}>
                ❓ Nápověda — Konfigurátor kolejiště
              </h2>
              <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--text-dim)" }}>
                Přehledně: od prvního dílu až po kontrolu v 3D.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--bg-card)",
                color: "var(--text-dim)",
                fontSize: 20,
                lineHeight: 1,
                width: 34,
                height: 34,
                cursor: "pointer",
              }}
              aria-label="Zavřít nápovědu"
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)", padding: "10px 12px" }}>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                  border: `1px solid ${activeTab === tab.id ? "transparent" : "var(--border)"}`,
                  background: activeTab === tab.id ? "var(--accent)" : "var(--bg-card)",
                  color: activeTab === tab.id ? "#111" : "var(--text-body)",
                  padding: "7px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: 16 }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <Content />
          </div>
        </div>
      </div>
    </div>
  );
}
