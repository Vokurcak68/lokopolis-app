"use client";

import { useState } from "react";

const tabs = [
  { id: "board", label: "📐 Deska" },
  { id: "tracks", label: "🛤️ Koleje" },
  { id: "portals", label: "🚪 Portály" },
  { id: "elevation", label: "📏 Výšky" },
  { id: "shortcuts", label: "⌨️ Klávesy" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function TabBoard() {
  return (
    <div className="space-y-4 text-sm" style={{ color: "var(--text-body)" }}>
      <h3 className="text-base font-bold" style={{ color: "var(--accent)" }}>Nastavení desky</h3>

      <div className="space-y-2">
        <p className="font-semibold">Obdélník (výchozí)</p>
        <p className="opacity-80">Zadejte šířku × hloubku v centimetrech. Nejjednodušší varianta.</p>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">L tvar</p>
        <p className="opacity-80">Deska ve tvaru písmene L — jako obdélník s jedním vyříznutým rohem.</p>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <p className="mb-2 font-medium">Jak na to:</p>
          <ol className="list-inside list-decimal space-y-1 opacity-80">
            <li>Nastavte celkové rozměry desky (šířka × hloubka) — to je obrys, do kterého se L vejde</li>
            <li><strong>L ramena</strong> = rozměr toho ramene, které <em>zůstane</em>. Představte si to jako menší obdélník, který z celku vyčnívá.</li>
            <li>Šipky <strong>↖ ↗ ↙ ↘</strong> určují, ve kterém rohu je „výřez" (prázdný kout)</li>
          </ol>
          <div className="mt-3 font-mono text-xs opacity-60">
            <p>Příklad: deska 200×100 cm, L ramena 80×60, roh ↘</p>
            <pre className="mt-1 whitespace-pre leading-tight">
{`┌──────────────┐
│              │ 60cm
│    ┌─────────┘
│    │    ↘ výřez
│    │
└────┘
 80cm`}
            </pre>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">U tvar</p>
        <p className="opacity-80">Deska ve tvaru písmene U — obdélník s výřezem uprostřed horní (nebo dolní) strany.</p>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <p className="mb-2 font-medium">Jak na to:</p>
          <ol className="list-inside list-decimal space-y-1 opacity-80">
            <li>Nastavte celkové rozměry desky (šířka × hloubka)</li>
            <li><strong>U hloubka</strong> = jak hluboko zasahuje výřez dovnitř desky</li>
            <li><strong>U šířka ramen</strong> = šířka bočních ramen (obou stejná). Výřez je prostor mezi nimi.</li>
          </ol>
          <div className="mt-3 font-mono text-xs opacity-60">
            <p>Příklad: deska 200×100 cm, hloubka výřezu 60 cm, ramena 40 cm</p>
            <pre className="mt-1 whitespace-pre leading-tight">
{`┌────┐        ┌────┐
│    │ výřez  │    │
│    │ 120cm  │    │ 60cm
│    └────────┘    │
│                  │
└──────────────────┘
 40cm   120cm   40cm`}
            </pre>
          </div>
        </div>
      </div>

      <p className="text-xs opacity-50">💡 Tip: Rozměry se zadávají v centimetrech. Měřítko kolejí (TT/H0) se nastaví zvlášť.</p>
    </div>
  );
}

function TabTracks() {
  return (
    <div className="space-y-4 text-sm" style={{ color: "var(--text-body)" }}>
      <h3 className="text-base font-bold" style={{ color: "var(--accent)" }}>Práce s kolejemi</h3>

      <div className="space-y-2">
        <p className="font-semibold">Pokládání</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li>Vyberte kolej z katalogu vlevo</li>
          <li>Klikněte na desku → kolej se položí</li>
          <li>Kolej se automaticky <strong>přichytí</strong> k volným koncům jiných kolejí (zelené body)</li>
          <li>Červené body = volný, nepřipojený konec</li>
          <li>Zelené body = připojený konec</li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Přesouvání</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li>Klikněte na kolej pro výběr, pak táhněte myší</li>
          <li>Při tažení se kolej přichytí k volným koncům</li>
          <li>Odpojení: stačí odtáhnout → body zčervenají</li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Multi-select</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li><strong>Ctrl+klik</strong> — přidat/odebrat kolej z výběru</li>
          <li><strong>Tažení na prázdném místě</strong> — obdélníkový výběr</li>
          <li>Vybrané koleje se přesouvají společně</li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Výhybky</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li>Výhybky mají hlavní kolej + odbočku</li>
          <li><strong>Zrcadlit</strong> (tlačítko nebo klávesa <code>M</code>) — překlopí odbočku na druhou stranu</li>
          <li><strong>Otočit</strong> (klávesa <code>R</code>) — otočí kolej o 180°</li>
        </ul>
      </div>

      <p className="text-xs opacity-50">💡 Tip: Kolečkem myši přibližujete/oddalujete. Pravým tlačítkem + tažení posouváte plátno.</p>
    </div>
  );
}

function TabPortals() {
  return (
    <div className="space-y-4 text-sm" style={{ color: "var(--text-body)" }}>
      <h3 className="text-base font-bold" style={{ color: "var(--accent)" }}>Tunely a mosty</h3>

      <div className="space-y-2">
        <p className="font-semibold">Normální tunel/most</p>
        <p className="opacity-80">Rychlá varianta — označíte začátek a konec na jedné trati:</p>
        <ol className="list-inside list-decimal space-y-1 opacity-80">
          <li>V menu nahoře klikněte na <strong>🏔️ Tunel</strong> nebo <strong>🌉 Most</strong></li>
          <li>Klikněte na kolej → <strong>začátek</strong></li>
          <li>Klikněte na jinou část koleje → <strong>konec</strong></li>
          <li>Mezi body se vykreslí zelený kopec (tunel) nebo modrý pás (most)</li>
        </ol>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Portálový systém (jednokolejný)</p>
        <p className="opacity-80">Pro přesnější kontrolu — 2 kliknutí:</p>
        <ol className="list-inside list-decimal space-y-1 opacity-80">
          <li>Menu <strong>🚪 Portál ▾</strong> → vyberte typ (tunel/most × single)</li>
          <li><strong>1. klik</strong> na kolej = vstupní portál</li>
          <li><strong>2. klik</strong> na kolej = výstupní portál</li>
          <li>Portály se automaticky spárují a kolej mezi nimi se zvýrazní</li>
        </ol>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Portálový systém (dvojkolejný)</p>
        <p className="opacity-80">Pro dvoukolejné tratě — 4 kliknutí:</p>
        <ol className="list-inside list-decimal space-y-1 opacity-80">
          <li>Menu <strong>🚪 Portál ▾</strong> → vyberte typ s „double"</li>
          <li><strong>1. klik</strong> = první kolej vstupu</li>
          <li><strong>2. klik</strong> = druhá kolej vstupu (musí být jiná kolej)</li>
          <li><strong>3. klik</strong> = první kolej výstupu</li>
          <li><strong>4. klik</strong> = druhá kolej výstupu</li>
          <li>Pokud jsou výstupní koleje blízko sebe → jeden široký portál. Pokud daleko → dva samostatné.</li>
        </ol>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Mazání</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li>Klikněte na portál → vybere se</li>
          <li><strong>Delete</strong> nebo tlačítko <strong>🗑 Smazat</strong></li>
        </ul>
      </div>

      <p className="text-xs opacity-50">💡 Koleje s výškovým bodem {`>`} 0 se vykreslí NAD tunelovou zelenou (přejezd přes tunel).</p>
    </div>
  );
}

function TabElevation() {
  return (
    <div className="space-y-4 text-sm" style={{ color: "var(--text-body)" }}>
      <h3 className="text-base font-bold" style={{ color: "var(--accent)" }}>Výškový profil</h3>

      <div className="space-y-2">
        <p className="font-semibold">Přidání výškového bodu</p>
        <ol className="list-inside list-decimal space-y-1 opacity-80">
          <li>Klikněte na <strong>📐 Výšky</strong> v horním menu</li>
          <li>Klikněte kamkoliv na kolej → objeví se popup</li>
          <li>Zadejte výšku v milimetrech (může být i záporná pro skryté nádraží)</li>
          <li>Koleje mezi body plynule stoupají/klesají</li>
        </ol>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Editace a mazání</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li>Klikněte na existující výškový bod (barevná tečka na koleji)</li>
          <li>V popupu můžete změnit výšku nebo bod smazat</li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Barvy bodů</p>
        <ul className="list-inside list-disc space-y-1 opacity-80">
          <li>🟢 Zelená = výška 0 mm (úroveň desky)</li>
          <li>🔵 Modrá = kladná výška (nad deskou)</li>
          <li>🔴 Červená = záporná výška (pod deskou — skryté nádraží)</li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">3D zobrazení</p>
        <p className="opacity-80">Přepněte na <strong>🏔️ 3D</strong> pro prostorové zobrazení kolejiště s výškami, stoupáním, mosty a tunely.</p>
      </div>

      <p className="text-xs opacity-50">💡 Tip: Reálné stoupání vlakové trati by nemělo přesáhnout 3–4 %. Strmější stoupání se zobrazí varovně.</p>
    </div>
  );
}

function TabShortcuts() {
  return (
    <div className="space-y-4 text-sm" style={{ color: "var(--text-body)" }}>
      <h3 className="text-base font-bold" style={{ color: "var(--accent)" }}>Klávesové zkratky</h3>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left">
          <tbody>
            {([
              ["Delete / Backspace", "Smazat vybranou kolej/portál"],
              ["Ctrl + Z", "Zpět (undo)"],
              ["Ctrl + Shift + Z", "Znovu (redo)"],
              ["R", "Otočit kolej o 180°"],
              ["M", "Zrcadlit výhybku (L↔P)"],
              ["Ctrl + klik", "Přidat/odebrat z výběru"],
              ["Kolečko myši", "Přiblížit / oddálit"],
              ["Pravé tlačítko + táhnutí", "Posun plátna"],
              ["Escape", "Zrušit aktuální akci"],
            ] as const).map(([key, desc], i) => (
              <tr key={key} style={{ background: i % 2 === 0 ? "var(--bg-card)" : "transparent" }}>
                <td className="px-3 py-2">
                  <kbd
                    className="rounded px-2 py-0.5 font-mono text-xs font-semibold"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                  >
                    {key}
                  </kbd>
                </td>
                <td className="px-3 py-2 opacity-80">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs opacity-50">💡 Na mobilu/tabletu se místo pravého tlačítka používá gesto dvěma prsty pro posun.</p>
    </div>
  );
}

const tabContent: Record<TabId, () => React.JSX.Element> = {
  board: TabBoard,
  tracks: TabTracks,
  portals: TabPortals,
  elevation: TabElevation,
  shortcuts: TabShortcuts,
};

export function TrackHelpModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("board");
  const Content = tabContent[activeTab];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-heading)" }}>
            ❓ Nápověda — Konfigurátor kolejiště
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-lg hover:opacity-70"
            style={{ color: "var(--text-dim)" }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 overflow-x-auto border-b px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: activeTab === tab.id ? "var(--accent)" : "transparent",
                color: activeTab === tab.id ? "#111" : "var(--text-body)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5">
          <Content />
        </div>
      </div>
    </div>
  );
}
