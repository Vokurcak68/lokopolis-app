"use client";

import { useState, useCallback } from "react";

const CATEGORIES = [
  { value: "", label: "Všechny kategorie" },
  { value: "lokomotivy", label: "🚂 Lokomotivy" },
  { value: "vagony", label: "🚃 Vagóny" },
  { value: "koleje", label: "🛤️ Koleje" },
  { value: "prislusenstvi", label: "🔧 Příslušenství" },
  { value: "budovy", label: "🏠 Budovy" },
  { value: "elektronika", label: "⚡ Elektronika" },
  { value: "literatura", label: "📚 Literatura" },
  { value: "kolejiste", label: "🗺️ Kolejiště" },
  { value: "ostatni", label: "📦 Ostatní" },
];

const SCALES = ["TT", "H0", "N", "Z", "G", "0", "1", "other"];

const SCALE_LABELS: Record<string, string> = {
  TT: "TT",
  H0: "H0",
  N: "N",
  Z: "Z",
  G: "G",
  "0": "0",
  "1": "1",
  other: "Jiné",
};

const SCALE_COLORS: Record<string, string> = {
  TT: "#3b82f6",
  H0: "#22c55e",
  N: "#a855f7",
  Z: "#ec4899",
  G: "#f59e0b",
};

const CONDITIONS = [
  { value: "", label: "Všechny stavy" },
  { value: "new", label: "Nový" },
  { value: "opened", label: "Rozbalený" },
  { value: "used", label: "Použitý" },
  { value: "parts", label: "Na díly" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Nejnovější" },
  { value: "cheapest", label: "Nejlevnější" },
  { value: "expensive", label: "Nejdražší" },
];

export interface FilterState {
  search: string;
  category: string;
  scales: string[];
  condition: string;
  priceFrom: string;
  priceTo: string;
  sort: string;
}

interface ListingFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
}

export default function ListingFilters({ filters, onChange, totalCount }: ListingFiltersProps) {
  const [collapsed, setCollapsed] = useState(true);

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange]
  );

  const toggleScale = useCallback(
    (scale: string) => {
      const newScales = filters.scales.includes(scale)
        ? filters.scales.filter((s) => s !== scale)
        : [...filters.scales, scale];
      update({ scales: newScales });
    },
    [filters.scales, update]
  );

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Search + count */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
          <input
            type="text"
            placeholder="🔍 Hledat v bazaru..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "10px",
              color: "var(--text-body)",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>
        <span style={{ fontSize: "14px", color: "var(--text-dimmer)", whiteSpace: "nowrap" }}>
          {totalCount} {totalCount === 1 ? "inzerát" : totalCount < 5 ? "inzeráty" : "inzerátů"}
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mobile-filter-toggle"
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            color: "var(--text-muted)",
            fontSize: "13px",
            cursor: "pointer",
            display: "none",
          }}
        >
          {collapsed ? "🔽 Filtry" : "🔼 Skrýt filtry"}
        </button>
      </div>

      {/* Filter controls */}
      <div
        className={`bazar-filters ${collapsed ? "collapsed" : ""}`}
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Category */}
        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          style={selectStyle}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Scale badges */}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {SCALES.map((scale) => {
            const active = filters.scales.includes(scale);
            const color = SCALE_COLORS[scale] || "#6b7280";
            return (
              <button
                key={scale}
                onClick={() => toggleScale(scale)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${active ? color : "var(--border)"}`,
                  background: active ? `${color}20` : "transparent",
                  color: active ? color : "var(--text-dimmer)",
                  transition: "all 0.15s",
                }}
              >
                {SCALE_LABELS[scale]}
              </button>
            );
          })}
        </div>

        {/* Condition */}
        <select
          value={filters.condition}
          onChange={(e) => update({ condition: e.target.value })}
          style={selectStyle}
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Price range */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="number"
            placeholder="Od Kč"
            value={filters.priceFrom}
            onChange={(e) => update({ priceFrom: e.target.value })}
            style={{ ...selectStyle, width: "90px" }}
            min={0}
          />
          <span style={{ color: "var(--text-dimmer)", fontSize: "13px" }}>–</span>
          <input
            type="number"
            placeholder="Do Kč"
            value={filters.priceTo}
            onChange={(e) => update({ priceTo: e.target.value })}
            style={{ ...selectStyle, width: "90px" }}
            min={0}
          />
        </div>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value })}
          style={selectStyle}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(filters.search || filters.category || filters.scales.length > 0 || filters.condition || filters.priceFrom || filters.priceTo) && (
          <button
            onClick={() =>
              onChange({
                search: "",
                category: "",
                scales: [],
                condition: "",
                priceFrom: "",
                priceTo: "",
                sort: filters.sort,
              })
            }
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
            }}
          >
            ✕ Zrušit filtry
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-filter-toggle { display: block !important; }
          .bazar-filters.collapsed { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-input)",
  borderRadius: "8px",
  color: "var(--text-body)",
  fontSize: "13px",
  outline: "none",
  cursor: "pointer",
};
