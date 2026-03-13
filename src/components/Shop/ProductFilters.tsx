"use client";

import { useState, useCallback, useMemo } from "react";
import { type ShopCategory, buildCategoryTree } from "@/lib/shop-categories";

const SCALES = ["TT", "H0", "N", "universal"];

const SCALE_LABELS: Record<string, string> = {
  TT: "TT",
  H0: "H0",
  N: "N",
  universal: "Univerzální",
};

const SCALE_COLORS: Record<string, string> = {
  TT: "#3b82f6",
  H0: "#22c55e",
  N: "#a855f7",
  universal: "#6b7280",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Nejnovější" },
  { value: "cheapest", label: "Nejlevnější" },
  { value: "expensive", label: "Nejdražší" },
  { value: "popular", label: "Nejstahovanější" },
];

export interface ShopFilterState {
  search: string;
  category: string;
  scales: string[];
  priceFrom: string;
  priceTo: string;
  freeOnly: boolean;
  sort: string;
}

interface ProductFiltersProps {
  filters: ShopFilterState;
  onChange: (filters: ShopFilterState) => void;
  totalCount: number;
  categories?: ShopCategory[];
}

export default function ProductFilters({ filters, onChange, totalCount, categories = [] }: ProductFiltersProps) {
  const [collapsed, setCollapsed] = useState(true);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const update = useCallback(
    (patch: Partial<ShopFilterState>) => {
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

  const hasActiveFilters = filters.search || filters.category || filters.scales.length > 0 || filters.priceFrom || filters.priceTo || filters.freeOnly;

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
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="🔍 Hledat produkty..."
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
          {totalCount} {totalCount === 1 ? "produkt" : totalCount < 5 ? "produkty" : "produktů"}
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shop-mobile-filter-toggle"
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
        className={`shop-filters ${collapsed ? "collapsed" : ""}`}
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Category — hierarchical select */}
        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          style={selectStyle}
        >
          <option value="">Všechny kategorie</option>
          {tree.map((parent) => {
            if (parent.children.length === 0) {
              // No children — directly selectable
              return (
                <option key={parent.slug} value={parent.slug}>
                  {parent.emoji} {parent.name}
                </option>
              );
            }
            // Has children — parent is group header, children are selectable
            return (
              <optgroup key={parent.slug} label={`${parent.emoji} ${parent.name}`}>
                <option value={parent.slug}>
                  Vše z {parent.name}
                </option>
                {parent.children.map((child) => (
                  <option key={child.slug} value={child.slug}>
                    &nbsp;&nbsp;{child.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
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

        {/* Free only */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: filters.freeOnly ? "#22c55e" : "var(--text-dimmer)",
            cursor: "pointer",
            padding: "5px 10px",
            borderRadius: "6px",
            border: `1px solid ${filters.freeOnly ? "#22c55e40" : "var(--border)"}`,
            background: filters.freeOnly ? "#22c55e15" : "transparent",
          }}
        >
          <input
            type="checkbox"
            checked={filters.freeOnly}
            onChange={(e) => update({ freeOnly: e.target.checked })}
            style={{ display: "none" }}
          />
          {filters.freeOnly ? "✅" : "☐"} Pouze zdarma
        </label>

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
        {hasActiveFilters && (
          <button
            onClick={() =>
              onChange({
                search: "",
                category: "",
                scales: [],
                priceFrom: "",
                priceTo: "",
                freeOnly: false,
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
          .shop-mobile-filter-toggle { display: block !important; }
          .shop-filters.collapsed { display: none !important; }
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
