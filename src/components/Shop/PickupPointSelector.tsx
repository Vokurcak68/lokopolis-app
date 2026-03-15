"use client";

import { useState, useEffect, useCallback } from "react";
import Script from "next/script";

// Typ pro výdejní místo
export interface PickupPoint {
  id: string;
  name: string;
  address: string;
}

interface Props {
  onSelect: (point: PickupPoint) => void;
  selectedPoint: PickupPoint | null;
  carrier?: "balikovna" | "zasilkovna";
}

// Statický seznam výdejních míst Balíkovny (placeholder — do budoucna nahradit API)
const STATIC_POINTS: PickupPoint[] = [
  { id: "BP-PRAHA-1", name: "Balíkovna Praha 1 — Jindřišská", address: "Jindřišská 14, 110 00 Praha 1" },
  { id: "BP-PRAHA-3", name: "Balíkovna Praha 3 — Žižkov", address: "Husitská 70, 130 00 Praha 3" },
  { id: "BP-PRAHA-5", name: "Balíkovna Praha 5 — Smíchov", address: "Plzeňská 8, 150 00 Praha 5" },
  { id: "BP-PRAHA-10", name: "Balíkovna Praha 10 — Vršovice", address: "Vršovická 68, 101 00 Praha 10" },
  { id: "BP-BRNO-1", name: "Balíkovna Brno — centrum", address: "Orlí 30, 602 00 Brno" },
  { id: "BP-BRNO-2", name: "Balíkovna Brno — Královo Pole", address: "Palackého třída 13, 612 00 Brno" },
  { id: "BP-OSTRAVA", name: "Balíkovna Ostrava — centrum", address: "Poštovní 4, 702 00 Ostrava" },
  { id: "BP-PLZEN", name: "Balíkovna Plzeň — centrum", address: "Solní 20, 301 00 Plzeň" },
  { id: "BP-OLOMOUC", name: "Balíkovna Olomouc", address: "Horní náměstí 27, 779 00 Olomouc" },
  { id: "BP-LIBEREC", name: "Balíkovna Liberec", address: "Moskevská 2, 460 01 Liberec" },
  { id: "BP-CESKE-BUDEJOVICE", name: "Balíkovna České Budějovice", address: "Pražská tř. 24, 370 04 České Budějovice" },
  { id: "BP-HRADEC-KRALOVE", name: "Balíkovna Hradec Králové", address: "Čs. armády 212, 500 03 Hradec Králové" },
  { id: "BP-PARDUBICE", name: "Balíkovna Pardubice", address: "Palackého 62, 530 02 Pardubice" },
  { id: "BP-ZLIN", name: "Balíkovna Zlín", address: "Zarámí 88, 760 01 Zlín" },
  { id: "BP-JIHLAVA", name: "Balíkovna Jihlava", address: "Masarykovo náměstí 1, 586 01 Jihlava" },
];

const PACKETA_API_KEY = process.env.NEXT_PUBLIC_PACKETA_API_KEY || "";

// ─── Společné styly ──────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: "4px",
};

const containerStyle: React.CSSProperties = {
  padding: "16px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  marginTop: "12px",
};

// ─── Karta vybraného bodu ────────────────────────────────────────
function SelectedPointCard({
  point,
  onClear,
  carrierLabel,
}: {
  point: PickupPoint;
  onClear: () => void;
  carrierLabel: string;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "rgba(240, 160, 48, 0.08)",
        border: "1px solid var(--accent)",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
          ✓ {carrierLabel}: {point.name}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{point.address}</div>
      </div>
      <button
        onClick={onClear}
        style={{
          padding: "6px 14px",
          background: "var(--bg-page)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          color: "var(--text-muted)",
          fontSize: "13px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Změnit
      </button>
    </div>
  );
}

// ─── Ruční zadání (fallback pro oba carriery) ────────────────────
function ManualEntry({
  onSelect,
  onBack,
  placeholder,
}: {
  onSelect: (point: PickupPoint) => void;
  onBack?: () => void;
  placeholder?: string;
}) {
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          📍 Zadejte výdejní místo ručně
        </h4>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ← Vybrat ze seznamu
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <label style={labelStyle}>Název výdejního místa *</label>
          <input
            style={inputStyle}
            placeholder={placeholder || "např. Balíkovna Praha 1 — Jindřišská"}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Adresa *</label>
          <input
            style={inputStyle}
            placeholder="např. Jindřišská 14, 110 00 Praha 1"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            if (manualName.trim() && manualAddress.trim()) {
              onSelect({
                id: `manual-${Date.now()}`,
                name: manualName.trim(),
                address: manualAddress.trim(),
              });
            }
          }}
          disabled={!manualName.trim() || !manualAddress.trim()}
          style={{
            padding: "10px 20px",
            background: manualName.trim() && manualAddress.trim() ? "var(--accent)" : "var(--border)",
            color: manualName.trim() && manualAddress.trim() ? "var(--accent-text-on)" : "var(--text-dimmer)",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: manualName.trim() && manualAddress.trim() ? "pointer" : "default",
            alignSelf: "flex-start",
          }}
        >
          ✓ Potvrdit výdejní místo
        </button>
      </div>
    </div>
  );
}

// ─── Zásilkovna (Packeta Widget v6) ─────────────────────────────
function ZasilkovnaSelector({
  onSelect,
  selectedPoint,
}: {
  onSelect: (point: PickupPoint) => void;
  selectedPoint: PickupPoint | null;
}) {
  const [widgetReady, setWidgetReady] = useState(false);

  // Zkontrolovat, jestli je widget už načtený (např. z cache)
  useEffect(() => {
    if (window.Packeta?.Widget) {
      setWidgetReady(true);
    }
  }, []);

  const openWidget = useCallback(() => {
    if (!window.Packeta?.Widget) return;
    window.Packeta.Widget.pick(PACKETA_API_KEY, (point) => {
      if (point) {
        onSelect({
          id: point.id.toString(),
          name: point.name,
          address: `${point.nameStreet}, ${point.zip} ${point.city}`,
        });
      }
    }, {
      country: "cz",
      language: "cs",
      appIdentity: "lokopolis.cz",
    });
  }, [onSelect]);

  // Pokud nemáme API klíč → fallback na ruční zadání
  if (!PACKETA_API_KEY) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", padding: "8px 12px", background: "rgba(240, 160, 48, 0.06)", borderRadius: "6px", border: "1px solid var(--border)" }}>
          ℹ️ Pro automatický výběr nastavte API klíč Zásilkovny
        </div>
        <ManualEntry onSelect={onSelect} placeholder="např. Z-BOX Praha 5 — Anděl" />
      </div>
    );
  }

  // Vybrané místo — zobrazit kartu
  if (selectedPoint) {
    return (
      <div style={containerStyle}>
        <SelectedPointCard
          point={selectedPoint}
          onClear={() => onSelect({ id: "", name: "", address: "" })}
          carrierLabel="Zásilkovna"
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Dynamické načtení Packeta Widget skriptu */}
      <Script
        src="https://widget.packeta.com/v6/www/js/library.js"
        strategy="lazyOnload"
        onReady={() => setWidgetReady(true)}
      />

      <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px 0" }}>
        📍 Výdejní místo Zásilkovny
      </h4>

      <button
        onClick={openWidget}
        disabled={!widgetReady}
        style={{
          width: "100%",
          padding: "14px 20px",
          background: widgetReady ? "var(--accent)" : "var(--border)",
          color: widgetReady ? "var(--accent-text-on)" : "var(--text-dimmer)",
          border: "none",
          borderRadius: "8px",
          fontWeight: 700,
          fontSize: "15px",
          cursor: widgetReady ? "pointer" : "default",
          transition: "all 0.15s",
        }}
      >
        {widgetReady ? "📍 Vybrat výdejní místo Zásilkovny" : "⏳ Načítám widget…"}
      </button>

      {!widgetReady && (
        <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "6px", textAlign: "center" }}>
          Načítám mapu výdejních míst…
        </div>
      )}
    </div>
  );
}

// ─── Balíkovna (stávající logika) ────────────────────────────────
function BalikovnaSelector({
  onSelect,
  selectedPoint,
}: {
  onSelect: (point: PickupPoint) => void;
  selectedPoint: PickupPoint | null;
}) {
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);

  const filtered = search.trim()
    ? STATIC_POINTS.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.address.toLowerCase().includes(search.toLowerCase())
      )
    : STATIC_POINTS;

  // Vybrané místo — zobrazit kartu
  if (selectedPoint && !manualMode) {
    return (
      <div style={containerStyle}>
        <SelectedPointCard
          point={selectedPoint}
          onClear={() => onSelect({ id: "", name: "", address: "" })}
          carrierLabel="Balíkovna"
        />
      </div>
    );
  }

  if (manualMode) {
    return (
      <ManualEntry
        onSelect={onSelect}
        onBack={() => setManualMode(false)}
        placeholder="např. Balíkovna Praha 1 — Jindřišská"
      />
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          📍 Vyberte výdejní místo
        </h4>
        <button
          onClick={() => setManualMode(true)}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontSize: "13px",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Zadat ručně →
        </button>
      </div>

      {/* Vyhledávání */}
      <input
        style={{ ...inputStyle, marginBottom: "12px" }}
        placeholder="Hledat město, adresu nebo PSČ…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Seznam výdejních míst */}
      <div
        style={{
          maxHeight: "240px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-dimmer)", fontSize: "13px" }}>
            Žádné výdejní místo neodpovídá hledání.{" "}
            <button
              onClick={() => setManualMode(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Zadat ručně
            </button>
          </div>
        ) : (
          filtered.map((point) => (
            <button
              key={point.id}
              onClick={() => onSelect(point)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                padding: "10px 14px",
                background:
                  selectedPoint?.id === point.id
                    ? "rgba(240, 160, 48, 0.08)"
                    : "var(--bg-page)",
                border: `1px solid ${selectedPoint?.id === point.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "8px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                width: "100%",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                {point.name}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{point.address}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Hlavní komponent ────────────────────────────────────────────
/**
 * Výběr výdejního místa — Balíkovna nebo Zásilkovna.
 * Carrier rozlišuje, který widget/logiku použít.
 */
export default function PickupPointSelector({ onSelect, selectedPoint, carrier = "balikovna" }: Props) {
  if (carrier === "zasilkovna") {
    return <ZasilkovnaSelector onSelect={onSelect} selectedPoint={selectedPoint} />;
  }
  return <BalikovnaSelector onSelect={onSelect} selectedPoint={selectedPoint} />;
}
