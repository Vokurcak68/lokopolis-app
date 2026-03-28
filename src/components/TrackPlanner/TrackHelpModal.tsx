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
      className="rounded-xl border p-4 sm:p-5"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <h4 className="mb-3 text-sm font-bold sm:text-base" style={{ color: "var(--text-heading)" }}>
        {title}
      </h4>
      <div className="space-y-2 text-sm leading-relaxed sm:text-[15px]" style={{ color: "var(--text-body)" }}>
        {children}
      </div>
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm"
      style={{ borderColor: "#f59e0b55", background: "#f59e0b1f", color: "var(--text-body)" }}
    >
      💡 {children}
    </div>
  );
}

function DotList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1 text-xs opacity-70">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StepList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: "var(--accent)", color: "#111" }}
          >
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function TabQuick() {
  return (
    <div className="space-y-4">
      <Card title="Začni během minuty">
        <StepList
          items={[
            <>Vlevo vyber kolej z katalogu a klikni na desku.</>,
            <>Přidávej další díly — napojení probíhá automaticky přes koncové body.</>,
            <>
              Pro tunel/most použij <strong>🚪 Portál ▾</strong> (single nebo double).
            </>,
            <>Přepni na <strong>🏔️ 3D</strong> a ověř výšky + průjezdy.</>,
          ]}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <Tip>Po větších úpravách portálů mrkni i do 3D pohledu, ať hned vidíš, že párování sedí.</Tip>
    </div>
  );
}

function TabBoard() {
  return (
    <div className="space-y-4">
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

      <Tip>Měřítko TT/H0 přepínej podle katalogu kolejí, ne podle rozměru desky.</Tip>
    </div>
  );
}

function TabTracks() {
  return (
    <div className="space-y-4">
      <Card title="Pokládání a napojování kolejí">
        <DotList
          items={[
            <>Vyber díl v katalogu vlevo a klikni na desku.</>,
            <>Konce se přichytávají automaticky.</>,
            <><strong>Červený bod</strong> = volný konec, <strong>zelený bod</strong> = napojený konec.</>,
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
            <>Oba flagy jsou vzájemně exkluzivní</>,
            <>Na plátně se ukáže štítek <strong>TOP</strong> nebo <strong>TUN</strong></>,
          ]}
        />
      </Card>
    </div>
  );
}

function TabPortals() {
  return (
    <div className="space-y-4">
      <Card title="Portály: tunel i most na jednom místě">
        <p>
          Pro tunel i most používej jen <strong>🚪 Portál ▾</strong> v horní liště.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Jednokolejný portál (single)">
          <StepList
            items={[
              <>🚪 Portál ▾ → zvol typ + <strong>single</strong></>,
              <>1. klik = začátek</>,
              <>2. klik = konec</>,
            ]}
          />
        </Card>

        <Card title="Dvojkolejný portál (double)">
          <StepList
            items={[
              <>🚪 Portál ▾ → zvol typ + <strong>double</strong></>,
              <>1. a 2. klik = dvě startovní koleje</>,
              <>3. a 4. klik = dvě koncové koleje</>,
            ]}
          />
        </Card>
      </div>

      <Card title="Úpravy a mazání">
        <DotList items={[<>Klik na portál = výběr</>, <><strong>Delete</strong> nebo tlačítko <strong>🗑 Smazat</strong></>]} />
      </Card>
    </div>
  );
}

function TabElevation() {
  return (
    <div className="space-y-4">
      <Card title="Výškový profil">
        <StepList
          items={[
            <>Zapni režim <strong>📐 Výšky</strong>.</>,
            <>Klikni na kolej, zadej výšku v mm.</>,
            <>Bod můžeš později upravit nebo smazat.</>,
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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map(([key, desc], i) => (
              <tr key={key} style={{ background: i % 2 ? "transparent" : "var(--bg-card)" }}>
                <td className="px-3 py-2 align-top">
                  <kbd
                    className="rounded border px-2 py-0.5 font-mono text-xs font-semibold"
                    style={{ borderColor: "var(--border)", background: "var(--bg-input)" }}
                  >
                    {key}
                  </kbd>
                </td>
                <td className="px-3 py-2" style={{ color: "var(--text-body)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: "var(--border)", background: "var(--bg-page)" }}
      >
        <div className="border-b px-4 py-3 sm:px-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold sm:text-lg" style={{ color: "var(--text-heading)" }}>
                ❓ Nápověda — Konfigurátor kolejiště
              </h2>
              <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--text-dim)" }}>
                Jednoduše a přehledně: od prvního dílu až po kontrolu v 3D.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md border px-2 py-1 text-lg"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--bg-card)" }}
              aria-label="Zavřít nápovědu"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium"
                style={{
                  borderColor: activeTab === tab.id ? "transparent" : "var(--border)",
                  background: activeTab === tab.id ? "var(--accent)" : "var(--bg-card)",
                  color: activeTab === tab.id ? "#111" : "var(--text-body)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="mx-auto max-w-3xl">
            <Content />
          </div>
        </div>
      </div>
    </div>
  );
}
