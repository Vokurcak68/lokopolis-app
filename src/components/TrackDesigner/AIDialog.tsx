"use client";

import React, { useState } from "react";
import type { TrackScale } from "@/lib/track-library";
import type { BoardShape, LCorner } from "@/lib/track-designer-store";

export type { BoardShape, LCorner };
export type Complexity = "simple" | "medium" | "complex";
export type FeatureKey = "bridge" | "tunnel" | "turntable" | "station" | "sidings" | "parallel";

export interface AIFormData {
  scale: TrackScale;
  boardWidth: number;
  boardDepth: number;
  boardShape: BoardShape;
  lCorner?: LCorner;
  lArmWidth?: number;
  lArmDepth?: number;
  uArmDepth?: number;
  character: string;
  complexity: Complexity;
  features: FeatureKey[];
  additionalPrompt?: string;
}

interface AIDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (formData: AIFormData) => void;
  scale: TrackScale;
  boardWidth: number;
  boardDepth: number;
  generating: boolean;
  error: string | null;
}

const CHARACTER_OPTIONS = [
  { id: "mountain", emoji: "🏔️", label: "Horská trať", desc: "Jednokolejka, tunely, stoupání" },
  { id: "corridor", emoji: "🚄", label: "Hlavní koridor", desc: "Dvoukolejná trať, rychlé vlaky" },
  { id: "station", emoji: "🏛️", label: "Stanice + vlečky", desc: "Stanice, vlečky, posun" },
  { id: "diorama", emoji: "🏠", label: "Malá dioráma", desc: "Kompaktní scéna, jednoduchý ovál" },
  { id: "through-station", emoji: "🔄", label: "Průjezdná stanice", desc: "Ovál s výhybnou stanicí" },
  { id: "industrial", emoji: "🏭", label: "Průmyslová vlečka", desc: "Vlečky, rampy, posun" },
];

const COMPLEXITY_OPTIONS: { id: Complexity; label: string; desc: string }[] = [
  { id: "simple", label: "Jednoduchá", desc: "Základní ovál, pár výhybek" },
  { id: "medium", label: "Střední", desc: "Nádraží, vlečky, výhybny" },
  { id: "complex", label: "Složitá", desc: "Křížení, mosty, tunely, více tras" },
];

const FEATURE_OPTIONS: { id: FeatureKey; label: string; emoji: string }[] = [
  { id: "bridge", label: "Most (trať ve výšce)", emoji: "🌉" },
  { id: "tunnel", label: "Tunel", emoji: "🕳️" },
  { id: "turntable", label: "Točna", emoji: "🔄" },
  { id: "station", label: "Nádraží (více kolejí)", emoji: "🏛️" },
  { id: "sidings", label: "Odstavné koleje", emoji: "🛤️" },
  { id: "parallel", label: "Souběžné tratě", emoji: "⏸️" },
];

const L_CORNER_OPTIONS: { id: LCorner; label: string }[] = [
  { id: "top-left", label: "Levý horní" },
  { id: "top-right", label: "Pravý horní" },
  { id: "bottom-left", label: "Levý dolní" },
  { id: "bottom-right", label: "Pravý dolní" },
];

export default function AIDialog({
  open,
  onClose,
  onGenerate,
  scale,
  boardWidth,
  boardDepth,
  generating,
  error,
}: AIDialogProps) {
  const [boardShape, setBoardShape] = useState<BoardShape>("rectangle");
  const [lCorner, setLCorner] = useState<LCorner>("top-right");
  const [lArmWidth, setLArmWidth] = useState(60);
  const [lArmDepth, setLArmDepth] = useState(40);
  const [uArmDepth, setUArmDepth] = useState(40);
  const [character, setCharacter] = useState("diorama");
  const [complexity, setComplexity] = useState<Complexity>("medium");
  const [features, setFeatures] = useState<FeatureKey[]>([]);
  const [additionalPrompt, setAdditionalPrompt] = useState("");

  if (!open) return null;

  const toggleFeature = (f: FeatureKey) => {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const handleGenerate = () => {
    const formData: AIFormData = {
      scale,
      boardWidth,
      boardDepth,
      boardShape,
      character,
      complexity,
      features,
      additionalPrompt: additionalPrompt.trim() || undefined,
    };
    if (boardShape === "l-shape") {
      formData.lCorner = lCorner;
      formData.lArmWidth = lArmWidth;
      formData.lArmDepth = lArmDepth;
    }
    if (boardShape === "u-shape") {
      formData.uArmDepth = uArmDepth;
    }
    onGenerate(formData);
  };

  // Shared styles
  const sectionTitle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "8px",
    marginTop: "18px",
  };

  const shapeButtonBase: React.CSSProperties = {
    flex: 1,
    padding: "10px 6px",
    borderRadius: "8px",
    border: "2px solid var(--border)",
    background: "var(--bg-input, #1a1a2e)",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "center" as const,
    transition: "all 0.15s ease",
  };

  const activeShapeStyle: React.CSSProperties = {
    ...shapeButtonBase,
    border: "2px solid var(--accent, #f0a030)",
    color: "var(--accent, #f0a030)",
    background: "rgba(240, 160, 48, 0.08)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "28px",
          width: "90%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            🤖 AI Návrhář kolejiště
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginBottom: "6px",
            fontSize: "13px",
            color: "var(--text-muted)",
          }}
        >
          Nastavte parametry kolejiště a AI navrhne rozložení kolejí.
        </div>

        {/* Scale & board info */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "6px",
            fontSize: "12px",
            color: "var(--text-dim)",
          }}
        >
          <span
            style={{
              padding: "4px 10px",
              background: "var(--accent-bg, rgba(240,160,48,0.1))",
              borderRadius: "4px",
              color: "var(--accent, #f0a030)",
              fontWeight: 600,
            }}
          >
            {scale} (1:{scale === "TT" ? 120 : 87})
          </span>
          <span
            style={{
              padding: "4px 10px",
              background: "var(--bg-input, #1a1a2e)",
              borderRadius: "4px",
            }}
          >
            {boardWidth} × {boardDepth} cm
          </span>
        </div>

        {/* ===== 1. TVAR DESKY ===== */}
        <div style={sectionTitle}>📐 Tvar desky</div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
          <button
            onClick={() => setBoardShape("rectangle")}
            style={boardShape === "rectangle" ? activeShapeStyle : shapeButtonBase}
          >
            <div style={{ fontSize: "24px", marginBottom: "2px" }}>▬</div>
            Obdélník
          </button>
          <button
            onClick={() => setBoardShape("l-shape")}
            style={boardShape === "l-shape" ? activeShapeStyle : shapeButtonBase}
          >
            <div style={{ fontSize: "24px", marginBottom: "2px" }}>⌐</div>
            L-tvar
          </button>
          <button
            onClick={() => setBoardShape("u-shape")}
            style={boardShape === "u-shape" ? activeShapeStyle : shapeButtonBase}
          >
            <div style={{ fontSize: "24px", marginBottom: "2px" }}>⊔</div>
            U-tvar
          </button>
        </div>

        {/* L-shape extras */}
        {boardShape === "l-shape" && (
          <div
            style={{
              padding: "12px",
              background: "var(--bg-input, #1a1a2e)",
              borderRadius: "8px",
              marginTop: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  minWidth: "100px",
                }}
              >
                Pozice rohu:
              </label>
              <select
                value={lCorner}
                onChange={(e) => setLCorner(e.target.value as LCorner)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              >
                {L_CORNER_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "11px",
                    color: "var(--text-dim)",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Šířka ramene (cm)
                </label>
                <input
                  type="number"
                  value={lArmWidth}
                  onChange={(e) => setLArmWidth(Number(e.target.value))}
                  min={20}
                  max={boardWidth}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    boxSizing: "border-box" as const,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "11px",
                    color: "var(--text-dim)",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Hloubka ramene (cm)
                </label>
                <input
                  type="number"
                  value={lArmDepth}
                  onChange={(e) => setLArmDepth(Number(e.target.value))}
                  min={20}
                  max={boardDepth}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    boxSizing: "border-box" as const,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* U-shape extras */}
        {boardShape === "u-shape" && (
          <div
            style={{
              padding: "12px",
              background: "var(--bg-input, #1a1a2e)",
              borderRadius: "8px",
              marginTop: "8px",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Hloubka ramen (cm)
            </label>
            <input
              type="number"
              value={uArmDepth}
              onChange={(e) => setUArmDepth(Number(e.target.value))}
              min={20}
              max={boardDepth}
              style={{
                width: "120px",
                padding: "6px 8px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                fontSize: "12px",
              }}
            />
          </div>
        )}

        {/* ===== 2. CHARAKTER TRATI ===== */}
        <div style={sectionTitle}>🚂 Charakter trati</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          {CHARACTER_OPTIONS.map((ch) => {
            const isActive = character === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setCharacter(ch.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: isActive
                    ? "2px solid var(--accent, #f0a030)"
                    : "2px solid var(--border)",
                  background: isActive
                    ? "rgba(240, 160, 48, 0.08)"
                    : "var(--bg-input, #1a1a2e)",
                  cursor: "pointer",
                  textAlign: "left" as const,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    marginBottom: "2px",
                  }}
                >
                  {ch.emoji}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: isActive
                      ? "var(--accent, #f0a030)"
                      : "var(--text-primary)",
                    marginBottom: "2px",
                  }}
                >
                  {ch.label}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-dim)",
                    lineHeight: 1.3,
                  }}
                >
                  {ch.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* ===== 3. SLOŽITOST ===== */}
        <div style={sectionTitle}>⚙️ Složitost</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {COMPLEXITY_OPTIONS.map((c) => {
            const isActive = complexity === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setComplexity(c.id)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: "8px",
                  border: isActive
                    ? "2px solid var(--accent, #f0a030)"
                    : "2px solid var(--border)",
                  background: isActive
                    ? "rgba(240, 160, 48, 0.08)"
                    : "var(--bg-input, #1a1a2e)",
                  cursor: "pointer",
                  textAlign: "center" as const,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: isActive
                      ? "var(--accent, #f0a030)"
                      : "var(--text-primary)",
                    marginBottom: "2px",
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--text-dim)",
                    lineHeight: 1.3,
                  }}
                >
                  {c.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* ===== 4. SPECIÁLNÍ PRVKY ===== */}
        <div style={sectionTitle}>✨ Speciální prvky</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          {FEATURE_OPTIONS.map((f) => {
            const isChecked = features.includes(f.id);
            return (
              <label
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: isChecked
                    ? "1px solid var(--accent, #f0a030)"
                    : "1px solid var(--border)",
                  background: isChecked
                    ? "rgba(240, 160, 48, 0.06)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontSize: "12px",
                  color: isChecked
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleFeature(f.id)}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: isChecked
                      ? "2px solid var(--accent, #f0a030)"
                      : "2px solid var(--border)",
                    background: isChecked
                      ? "var(--accent, #f0a030)"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {isChecked ? "✓" : ""}
                </span>
                <span>
                  {f.emoji} {f.label}
                </span>
              </label>
            );
          })}
        </div>

        {/* ===== 5. TEXTAREA ===== */}
        <div style={sectionTitle}>📝 Další požadavky</div>
        <textarea
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          placeholder="Další specifické požadavky... (volitelné)"
          rows={3}
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "var(--bg-input, #1a1a2e)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-primary)",
            fontSize: "13px",
            outline: "none",
            resize: "vertical" as const,
            fontFamily: "inherit",
            marginBottom: "16px",
            boxSizing: "border-box" as const,
          }}
        />

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(244, 67, 54, 0.1)",
              border: "1px solid rgba(244, 67, 54, 0.3)",
              borderRadius: "8px",
              color: "#ff6b6b",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Zrušit
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              background: generating
                ? "var(--border-hover)"
                : "linear-gradient(135deg, #667eea, #764ba2)",
              color: generating ? "var(--text-dim)" : "#fff",
              cursor: generating ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {generating ? "⏳ Generuji..." : "🚀 Generovat"}
          </button>
        </div>
      </div>
    </div>
  );
}
