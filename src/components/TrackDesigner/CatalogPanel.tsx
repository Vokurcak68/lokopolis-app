"use client";

import React from "react";
import { getCatalogGrouped, type TrackScale, type TrackPieceDefinition } from "@/lib/track-library";

interface CatalogPanelProps {
  scale: TrackScale;
  activePieceId: string | null;
  onSelectPiece: (piece: TrackPieceDefinition | null) => void;
}

const typeIcons: Record<string, string> = {
  "Přímé": "━",
  "Oblouky": "↩",
  "Výhybky": "⑂",
  "Křížení": "✕",
};

export default function CatalogPanel({ scale, activePieceId, onSelectPiece }: CatalogPanelProps) {
  const grouped = getCatalogGrouped(scale);

  return (
    <div
      style={{
        width: "240px",
        minWidth: "240px",
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "var(--accent)",
          padding: "8px 0",
          borderBottom: "1px solid var(--border)",
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        🛤️ Katalog kolejí
      </div>

      {/* Deselect button */}
      {activePieceId && (
        <button
          onClick={() => onSelectPiece(null)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--accent-bg)",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          ✕ Zrušit výběr
        </button>
      )}

      {Object.entries(grouped).map(([category, pieces]) => (
        <div key={category}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--text-muted)",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "14px" }}>{typeIcons[category] || "•"}</span>
            {category}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {pieces.map((piece) => {
              const isActive = activePieceId === piece.id;
              return (
                <button
                  key={piece.id}
                  onClick={() => onSelectPiece(isActive ? null : piece)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-body)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: isActive ? 700 : 400,
                    textAlign: "left",
                    transition: "all 0.15s",
                    lineHeight: 1.3,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{piece.name}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
                    {piece.type === "straight" && `${piece.length}mm`}
                    {piece.type === "curve" && `R${piece.radius}mm / ${piece.angle}°`}
                    {piece.type === "turnout" && `${piece.length}mm / ${piece.angle}° ${piece.direction === "left" ? "levá" : "pravá"}`}
                    {piece.type === "crossing" && `${piece.length}mm / ${piece.angle}°`}
                    {piece.catalogNumber && ` · č.${piece.catalogNumber}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
