"use client";

import { useMemo, useState, type ReactNode, type JSX } from "react";

const tabs = [
  { id: "quick", label: "🚀 Rychlý start" },
  { id: "board", label: "📐 Deska" },
  { id: "tracks", label: "🛤️ Koleje" },
  { id: "portals", label: "🚪 Portály" },
  { id: "elevation", label: "📏 Výšky" },
  { id: "shortcuts", label: "⌨️ Klávesy" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in oklab, var(--bg-card) 90%, white 10%)",
      }}
    >
      <h4 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
        {icon ? `${icon} ` : ""}
        {title}
      </h4>
      <div className="space-y-2 text-sm" style={{ color: "var(--text-body)" }}>
        {children}
      </div>
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs"
      style={{
        borderColor: "rgba(245,158,11,0.45)",
        background: "rgba(245,158,11,0.12)",
        color: "var(--text-body)",
      }}
    >
      💡 {children}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: "var(--accent)", color: "#111" }}
      >
        {n}
      </span>
      <span className="opacity-90">{text}</span>
    </li>
  );
}

function TabQuickStart() {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--accent) 30%, transparent), color-mix(in oklab, var(--bg-card) 88%, white 12%))",
        }}
      >
        <h3 className="text-base font-bold" style={{ color: "var(--text-heading)" }}>
          Začni během 30 sekund
        </h3>
        <ol className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-body)" }}>
          <Step n={1} text="Vlevo vyber kolej z katalogu a klikni na desku." />
          <Step n={2} text="Polož další koleje — automaticky se přichytí na volné konce." />
          <Step n={3} text="V horním menu klikni 🚪 Portál ▾ a založ tunel nebo most (single/double)." />
          <Step n={4} text="Přepni na 🏔️ 3D a zkontroluj výšky, tunely i mosty." />
        </ol>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SectionCard title="Nejčastější akce" icon="⚡">
          <ul className="list-inside list-disc space-y-1 opacity-90">
            <li><strong>Delete / Backspace</strong> = smazat vybraný objekt</li>
            <li><strong>Ctrl+Z / Ctrl+Shift+Z</strong> = zpět / znovu</li>
            <li><strong>R</strong> = otočit (u vybrané koleje jen když není napojená)</li>
            <li><strong>F</strong> = zrcadlit výhybku / kolej</li>
          </ul>
        </SectionCard>

        <SectionCard title="Co je nové" icon="🆕">
          <ul className="list-inside list-disc space-y-1 opacity-90">
            <li><strong>⤴️ Vždy navrch</strong> — kolej je ve 2D vždy nad overlayi</li>
            <li><strong>🟢 Vždy pod tunelem</strong> — kolej je vždy schovaná pod zeleným tunelem</li>
            <li>Na plátně vidíš indikátory <strong>TOP</strong> / <strong>TUN</strong></li>
            <li>Tunel/most tlačítka byla sloučena do <strong>🚪 Portál</strong></li>
          </ul>
        </SectionCard>
      </div>

      <Tip>
        Když se něco chová divně po úpravách portálů, ulož projekt a jednou obnov stránku — rychle ověříš, že je stav perzistentní.
      </Tip>
    </div>
  );
}

function TabBoard() {
  return (
    <div className="space-y-4">
      <SectionCard title="Tvary desky" icon="📐">
        <ul className="list-inside list-disc space-y-1 opacity-90">
          <li><strong>Obdélník</strong> — nejrychlejší start</li>
          <li><strong>L</strong> — nastavíš rozměr ramen + roh výřezu (↖ ↗ ↙ ↘)</li>
          <li><strong>U</strong> — nastavíš hloubku výřezu + šířku bočních ramen</li>
        </ul>
      </SectionCard>

      <SectionCard title="Jak to nastavit správně" icon="✅">
        <ol className="space-y-2">
          <Step n={1} text="Nejdřív zadej celkové rozměry desky (šířka × hloubka v cm)." />
          <Step n={2} text="Až potom dolaď L/U parametry (ramena, hloubka výřezu)." />
          <Step n={3} text="Teprve pak začni pokládat koleje — vyhneš se předělávkám." />
        </ol>
      </SectionCard>

      <Tip>
        Měřítko <strong>TT/H0</strong> přepínej podle katalogu kolejí, ne podle rozměru desky.
      </Tip>
    </div>
  );
}

function TabTracks() {
  return (
    <div className="space-y-4">
      <SectionCard title="Pokládání a napojování" icon="🛤️">
        <ul className="list-inside list-disc space-y-1 opacity-90">
          <li>Vyber díl v katalogu vlevo a klikni na desku</li>
          <li>Napojení je automatické podle koncových bodů</li>
          <li><strong>Červený bod</strong> = volný konec, <strong>zelený bod</strong> = napojený konec</li>
        </ul>
      </SectionCard>

      <SectionCard title="Výběr a hromadný pohyb" icon="🧲">
        <ul className="list-inside list-disc space-y-1 opacity-90">
          <li><strong>Klik</strong> vybere jednu kolej</li>
          <li><strong>Ctrl + klik</strong> přidá/odebere kolej z výběru</li>
          <li><strong>Tažení na prázdné ploše</strong> udělá obdélníkový výběr</li>
          <li>Vybrané koleje můžeš přesouvat společně</li>
        </ul>
      </SectionCard>

      <SectionCard title="Flagy vybrané koleje" icon="🏷️">
        <ul className="list-inside list-disc space-y-1 opacity-90">
          <li><strong>⤴️ Vždy navrch</strong> → kolej se ve 2D kreslí úplně nahoře</li>
          <li><strong>🟢 Vždy pod tunelem</strong> → přes kolej se vždy kreslí zelený tunelový overlay</li>
          <li>Flagy jsou vzájemně exkluzivní</li>
          <li>Na plátně se u koleje zobrazí štítky <strong>TOP</strong> nebo <strong>TUN</strong></li>
        </ul>
      </SectionCard>
    </div>
  );
}

function TabPortals() {
  return (
    <div className="space-y-4">
      <SectionCard title="Portál = jediný způsob pro tunel/most" icon="🚪">
        <p className="opacity-90">
          V horním menu použij <strong>🚪 Portál ▾</strong>. Stará samostatná tlačítka Tunel/Most už jsou schovaná, aby to nebylo duplicitní.
        </p>
      </SectionCard>

      <div className="grid gap-3 md:grid-cols-2">
        <SectionCard title="Jednokolejný portál (single)" icon="1️⃣">
          <ol className="space-y-2">
            <Step n={1} text="🚪 Portál ▾ → zvol typ (tunel/most) + single" />
            <Step n={2} text="Klik na kolej = začátek" />
            <Step n={3} text="Klik na kolej = konec" />
          </ol>
        </SectionCard>

        <SectionCard title="Dvojkolejný portál (double)" icon="2️⃣">
          <ol className="space-y-2">
            <Step n={1} text="🚪 Portál ▾ → typ + double" />
            <Step n={2} text="1. klik: kolej A (start), 2. klik: kolej B (start)" />
            <Step n={3} text="3. klik: kolej A (konec), 4. klik: kolej B (konec)" />
          </ol>
        </SectionCard>
      </div>

      <SectionCard title="Úpravy a mazání" icon="🧹">
        <ul className="list-inside list-disc space-y-1 opacity-90">
          <li>Klikem na portál ho vybereš</li>
          <li><strong>Delete</strong> nebo tlačítko <strong>🗑 Smazat</strong> ho odstraní</li>
          <li>Po úpravě složitého párování si vždy zkontroluj i 3D pohled</li>
        </ul>
      </SectionCard>
    </div>
  );
}

function TabElevation() {
  return (
    <div className="space-y-4">
      <SectionCard title="Přidání výškového bodu" icon="📏">
        <ol className="space-y-2">
          <Step n={1} text="Klikni nahoře na 📐 Výšky" />
          <Step n={2} text="Klikni na místo na koleji" />
          <Step n={3} text="V popupu zadej výšku v mm" />
        </ol>
      </SectionCard>

      <SectionCard title="Barvy bodů" icon="🎨">
        <ul className="list-inside list-disc space-y-1 opacity-90">
          <li>🟢 0 mm (úroveň desky)</li>
          <li>🔵 kladná výška (nad deskou)</li>
          <li>🔴 záporná výška (pod deskou)</li>
        </ul>
      </SectionCard>

      <SectionCard title="Kde to ověřit" icon="🏔️">
        <p className="opacity-90">
          Přepni na <strong>3D</strong> a zkontroluj sklon, průjezdnost a návaznost mostů/tunelů.
        </p>
      </SectionCard>

      <Tip>
        Reálně drž stoupání ideálně do <strong>3–4&nbsp;%</strong>, jinak budou mít delší soupravy problém.
      </Tip>
    </div>
  );
}

function TabShortcuts() {
  const rows = useMemo(
    () => [
      ["Delete / Backspace", "Smazat vybranou kolej / portál / zónu"],
      ["Ctrl + Z", "Zpět (Undo)"],
      ["Ctrl + Shift + Z", "Znovu (Redo)"],
      ["R", "Otočit vybranou kolej (pokud není napojená) / ghost při vkládání"],
      ["F", "Zrcadlit vybranou kolej (flip)"],
      ["Ctrl + klik", "Přidat/odebrat kolej z multivýběru"],
      ["Escape", "Zrušit režim (vkládání, portál, výšky) / odznačit výběr"],
      ["Kolečko myši", "Zoom"],
      ["Pravé tlačítko + tažení", "Posun plátna"],
    ] as const,
    [],
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map(([key, desc], i) => (
              <tr key={key} style={{ background: i % 2 ? "transparent" : "color-mix(in oklab, var(--bg-card) 92%, white 8%)" }}>
                <td className="px-3 py-2 align-top">
                  <kbd
                    className="rounded px-2 py-0.5 font-mono text-xs font-semibold"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                  >
                    {key}
                  </kbd>
                </td>
                <td className="px-3 py-2 opacity-90">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Tip>
        Na touch zařízení místo pravého tlačítka používej gesto dvěma prsty pro posun plátna.
      </Tip>
    </div>
  );
}

const tabContent: Record<TabId, () => JSX.Element> = {
  quick: TabQuickStart,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.62)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-heading)" }}>
                ❓ Nápověda — Konfigurátor kolejiště
              </h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
                Praktický průvodce: od prvního kliknutí po 3D kontrolu tunelů a mostů.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-lg hover:opacity-70"
              style={{ color: "var(--text-dim)", border: "1px solid var(--border)" }}
              aria-label="Zavřít nápovědu"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition"
                style={{
                  background: activeTab === tab.id ? "var(--accent)" : "transparent",
                  color: activeTab === tab.id ? "#111" : "var(--text-body)",
                  border: `1px solid ${activeTab === tab.id ? "transparent" : "var(--border)"}`,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <Content />
        </div>
      </div>
    </div>
  );
}
