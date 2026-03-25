"use client";

import type { TrackScale } from "@/lib/track-library";

interface TrackTopBarProps {
  scale: TrackScale;
  boardWidth: number;
  boardDepth: number;
  canUndo: boolean;
  canRedo: boolean;
  onScaleChange: (scale: TrackScale) => void;
  onBoardWidthChange: (value: number) => void;
  onBoardDepthChange: (value: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onSave: () => void;
  onExportList: () => void;
  onToggleCatalogMobile: () => void;
}

export function TrackTopBar(props: TrackTopBarProps) {
  const {
    scale,
    boardWidth,
    boardDepth,
    canUndo,
    canRedo,
    onScaleChange,
    onBoardWidthChange,
    onBoardDepthChange,
    onUndo,
    onRedo,
    onClear,
    onExportPng,
    onSave,
    onExportList,
    onToggleCatalogMobile,
  } = props;

  const btnBase =
    "h-9 rounded-md border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <div className="border-b px-3 py-2 md:px-4" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onToggleCatalogMobile}
          className="md:hidden h-9 rounded-md border px-3 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-body)" }}
        >
          ☰ Katalog
        </button>

        <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
          {(["TT", "H0"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onScaleChange(s)}
              className="h-8 rounded-md px-3 text-sm font-semibold"
              style={{
                background: scale === s ? "var(--accent)" : "transparent",
                color: scale === s ? "#111" : "var(--text-body)",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            Deska
          </span>
          <input
            type="number"
            value={boardWidth}
            onChange={(e) => onBoardWidthChange(Number(e.target.value || 0))}
            min={40}
            max={1000}
            className="h-7 w-18 rounded border px-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--bg-input)", color: "var(--text-body)" }}
          />
          <span style={{ color: "var(--text-dim)" }}>×</span>
          <input
            type="number"
            value={boardDepth}
            onChange={(e) => onBoardDepthChange(Number(e.target.value || 0))}
            min={40}
            max={1000}
            className="h-7 w-18 rounded border px-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--bg-input)", color: "var(--text-body)" }}
          />
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            cm
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={onUndo} disabled={!canUndo} className={btnBase} style={{ borderColor: "var(--border)", color: "var(--text-body)" }}>
            Undo
          </button>
          <button onClick={onRedo} disabled={!canRedo} className={btnBase} style={{ borderColor: "var(--border)", color: "var(--text-body)" }}>
            Redo
          </button>
          <button onClick={onClear} className={btnBase} style={{ borderColor: "var(--border)", color: "var(--text-body)" }}>
            Vyčistit
          </button>
          <button onClick={onExportPng} className={btnBase} style={{ borderColor: "var(--border)", color: "var(--text-body)" }}>
            Export PNG
          </button>
          <button onClick={onExportList} className={btnBase} style={{ borderColor: "var(--border)", color: "var(--text-body)" }}>
            Nákupní seznam
          </button>
          <button
            onClick={onSave}
            className={`${btnBase} border-0`}
            style={{ background: "var(--accent)", color: "#111" }}
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
