"use client";

import { useState } from "react";

// Typ pro výdejní místo
export interface PickupPoint {
  id: string;
  name: string;
  address: string;
}

interface Props {
  onSelect: (point: PickupPoint) => void;
  selectedPoint: PickupPoint | null;
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

/**
 * Výběr výdejního místa Balíkovny.
 * Zatím používáme statický seznam — do budoucna lze napojit na API České pošty.
 */
export default function PickupPointSelector({ onSelect, selectedPoint }: Props) {
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  // Filtrování výdejních míst podle hledání
  const filtered = search.trim()
    ? STATIC_POINTS.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.address.toLowerCase().includes(search.toLowerCase())
      )
    : STATIC_POINTS;

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

  // Ruční zadání výdejního místa
  if (manualMode) {
    return (
      <div
        style={{
          padding: "16px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          marginTop: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            📍 Zadejte výdejní místo ručně
          </h4>
          <button
            onClick={() => setManualMode(false)}
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={labelStyle}>Název výdejního místa *</label>
            <input
              style={inputStyle}
              placeholder="např. Balíkovna Praha 1 — Jindřišská"
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

  return (
    <div
      style={{
        padding: "16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        marginTop: "12px",
      }}
    >
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

      {/* Vybrané výdejní místo */}
      {selectedPoint && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(240, 160, 48, 0.08)",
            border: "1px solid var(--accent)",
            borderRadius: "8px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
              ✓ {selectedPoint.name}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{selectedPoint.address}</div>
          </div>
          <button
            onClick={() => onSelect({ id: "", name: "", address: "" })}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dimmer)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            ✕ Zrušit
          </button>
        </div>
      )}

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
