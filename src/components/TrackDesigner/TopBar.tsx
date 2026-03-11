"use client";

import React from "react";
import type { TrackScale } from "@/lib/track-library";
import type { BoardShape } from "@/lib/track-designer-store";

interface TopBarProps {
  scale: TrackScale;
  boardWidth: number;
  boardDepth: number;
  boardShape?: BoardShape;
  onScaleChange: (scale: TrackScale) => void;
  onBoardWidthChange: (w: number) => void;
  onBoardDepthChange: (d: number) => void;
  onOpenAI: () => void;
  onClear: () => void;
  aiGenerating: boolean;
}

const SHAPE_LABELS: Record<BoardShape, string> = {
  rectangle: "▬",
  "l-shape": "⌐ L",
  "u-shape": "⊔ U",
};

export default function TopBar({
  scale,
  boardWidth,
  boardDepth,
  boardShape,
  onScaleChange,
  onBoardWidthChange,
  onBoardDepthChange,
  onOpenAI,
  onClear,
  aiGenerating,
}: TopBarProps) {
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-input)",
    borderRadius: "6px",
    color: "var(--text-body)",
    fontSize: "13px",
    width: "70px",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    width: "90px",
    cursor: "pointer",
    appearance: "none" as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-dim)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        padding: "10px 16px",
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "18px" }}>🛤️</span>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
          Návrhář tratí
        </span>
      </div>

      <div style={{ width: "1px", height: "24px", background: "var(--border)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={labelStyle}>Měřítko</span>
        <select
          value={scale}
          onChange={(e) => onScaleChange(e.target.value as TrackScale)}
          style={selectStyle}
        >
          <option value="TT">TT (1:120)</option>
          <option value="H0">H0 (1:87)</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={labelStyle}>Deska</span>
        <input
          type="number"
          value={boardWidth}
          onChange={(e) => onBoardWidthChange(Number(e.target.value))}
          min={60}
          max={600}
          style={inputStyle}
        />
        <span style={{ color: "var(--text-dim)", fontSize: "13px" }}>×</span>
        <input
          type="number"
          value={boardDepth}
          onChange={(e) => onBoardDepthChange(Number(e.target.value))}
          min={40}
          max={400}
          style={inputStyle}
        />
        <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>cm</span>
        {boardShape && boardShape !== "rectangle" && (
          <span
            style={{
              padding: "4px 10px",
              background: "rgba(240, 160, 48, 0.1)",
              borderRadius: "4px",
              color: "var(--accent, #f0a030)",
              fontWeight: 600,
              fontSize: "12px",
              marginLeft: "4px",
            }}
          >
            {SHAPE_LABELS[boardShape]}
          </span>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onClear}
        style={{
          padding: "8px 14px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        🗑️ Smazat vše
      </button>

      <button
        onClick={onOpenAI}
        disabled={aiGenerating}
        style={{
          padding: "8px 16px",
          borderRadius: "6px",
          border: "none",
          background: aiGenerating
            ? "var(--border-hover)"
            : "linear-gradient(135deg, #667eea, #764ba2)",
          color: aiGenerating ? "var(--text-dim)" : "#fff",
          cursor: aiGenerating ? "not-allowed" : "pointer",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.3px",
        }}
      >
        {aiGenerating ? "⏳ Generuji..." : "🤖 AI Generovat"}
      </button>
    </div>
  );
}
