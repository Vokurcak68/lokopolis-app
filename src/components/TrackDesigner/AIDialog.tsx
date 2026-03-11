"use client";

import React, { useState } from "react";
import type { TrackScale } from "@/lib/track-library";

interface AIDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  scale: TrackScale;
  boardWidth: number;
  boardDepth: number;
  generating: boolean;
  error: string | null;
}

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
  const [prompt, setPrompt] = useState("");

  if (!open) return null;

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "28px",
          width: "90%",
          maxWidth: "520px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
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

        <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
          Popište, jaké kolejiště chcete. AI navrhne rozložení kolejí pro vaši desku.
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "16px",
            fontSize: "12px",
            color: "var(--text-dim)",
          }}
        >
          <span style={{
            padding: "4px 10px",
            background: "var(--accent-bg)",
            borderRadius: "4px",
            color: "var(--accent)",
            fontWeight: 600,
          }}>
            {scale} (1:{scale === "TT" ? 120 : 87})
          </span>
          <span style={{
            padding: "4px 10px",
            background: "var(--bg-input)",
            borderRadius: "4px",
          }}>
            {boardWidth} × {boardDepth} cm
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Např.: ovál s výhybnou a jednou vlečkou, horská trať s tunelem, jednoduchý okruh s nádražím..."
          rows={4}
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-input)",
            borderRadius: "8px",
            color: "var(--text-body)",
            fontSize: "14px",
            outline: "none",
            resize: "vertical" as const,
            fontFamily: "inherit",
            marginBottom: "16px",
            boxSizing: "border-box" as const,
          }}
        />

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

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
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
            onClick={() => onGenerate(prompt)}
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
