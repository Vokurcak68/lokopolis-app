"use client";

import { useState } from "react";
import type { BoardShape, LCorner } from "@/lib/track-designer-store";
import type { TrackScale } from "@/lib/track-library";
import { getManufacturer } from "@/lib/track-library";
import type { SavedProject } from "./useTrackPlanner";

interface TrackTopBarProps {
  scale: TrackScale;
  boardWidth: number;
  boardDepth: number;
  boardShape: BoardShape;
  lCorner: LCorner;
  lArmWidth: number;
  lArmDepth: number;
  uArmDepth: number;
  uArmWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  onScaleChange: (scale: TrackScale) => void;
  onBoardWidthChange: (value: number) => void;
  onBoardDepthChange: (value: number) => void;
  onBoardShapeChange: (shape: BoardShape) => void;
  onLCornerChange: (corner: LCorner) => void;
  onLArmWidthChange: (value: number) => void;
  onLArmDepthChange: (value: number) => void;
  onUArmDepthChange: (value: number) => void;
  onUArmWidthChange: (value: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => void;
  listProjects: () => SavedProject[];
  currentProjectName: string | null;
  saveToast?: "ok" | "fail" | null;
  onExportList: () => void;
  onToggleCatalogMobile: () => void;
  terrainMode: "tunnel" | "bridge" | null;
  onStartTunnel: () => void;
  onStartBridge: () => void;
  onCancelTerrain: () => void;
  viewMode: "2d" | "3d";
  onToggleViewMode: () => void;
  elevationMode: boolean;
  onStartElevation: () => void;
  onCancelElevation: () => void;
  // Portal system (new)
  portalMode: { kind: "tunnel" | "bridge"; width: "single" | "double" } | null;
  onStartPortal: (kind: "tunnel" | "bridge", width: "single" | "double") => void;
  onCancelPortal: () => void;
}

export function TrackTopBar(props: TrackTopBarProps) {
  const {
    scale,
    boardWidth,
    boardDepth,
    boardShape,
    lCorner,
    lArmWidth,
    lArmDepth,
    uArmDepth,
    uArmWidth,
    canUndo,
    canRedo,
    onScaleChange,
    onBoardWidthChange,
    onBoardDepthChange,
    onBoardShapeChange,
    onLCornerChange,
    onLArmWidthChange,
    onLArmDepthChange,
    onUArmDepthChange,
    onUArmWidthChange,
    onUndo,
    onRedo,
    onClear,
    onExportPng,
    onSave,
    onSaveAs,
    onLoadProject,
    onDeleteProject,
    onNewProject,
    listProjects,
    currentProjectName,
    saveToast,
    onExportList,
    onToggleCatalogMobile,
    terrainMode,
    onStartTunnel,
    onStartBridge,
    onCancelTerrain,
    viewMode,
    onToggleViewMode,
    elevationMode,
    onStartElevation,
    onCancelElevation,
    portalMode,
    onStartPortal,
    onCancelPortal,
  } = props;

  const [portalDropdown, setPortalDropdown] = useState(false);

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

        <span className="text-sm font-medium" style={{ color: "var(--text-dim)" }}>
          {scale} — {getManufacturer(scale)}
        </span>

        <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
          {([
            ["rectangle", "Obdélník"],
            ["l-shape", "L"],
            ["u-shape", "U"],
          ] as const).map(([shape, label]) => (
            <button
              key={shape}
              onClick={() => onBoardShapeChange(shape)}
              className="h-8 rounded-md px-3 text-sm font-semibold"
              style={{
                background: boardShape === shape ? "var(--accent)" : "transparent",
                color: boardShape === shape ? "#111" : "var(--text-body)",
              }}
            >
              {label}
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

        {boardShape === "l-shape" && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>L ramena</span>
            <input
              type="number"
              value={lArmWidth}
              onChange={(e) => onLArmWidthChange(Number(e.target.value || 0))}
              min={10}
              max={boardWidth - 1}
              className="h-7 w-16 rounded border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", background: "var(--bg-input)", color: "var(--text-body)" }}
              title="Šířka ramene (cm)"
            />
            <input
              type="number"
              value={lArmDepth}
              onChange={(e) => onLArmDepthChange(Number(e.target.value || 0))}
              min={10}
              max={boardDepth - 1}
              className="h-7 w-16 rounded border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", background: "var(--bg-input)", color: "var(--text-body)" }}
              title="Hloubka ramene (cm)"
            />
            <div className="flex items-center gap-1">
              {([
                ["top-left", "↖"],
                ["top-right", "↗"],
                ["bottom-left", "↙"],
                ["bottom-right", "↘"],
              ] as const).map(([corner, icon]) => (
                <button
                  key={corner}
                  onClick={() => onLCornerChange(corner)}
                  className="h-7 w-7 rounded border text-sm"
                  style={{
                    borderColor: lCorner === corner ? "var(--accent)" : "var(--border)",
                    color: lCorner === corner ? "var(--accent)" : "var(--text-body)",
                    background: "transparent",
                  }}
                  title={corner}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {boardShape === "u-shape" && (
          <div className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>U ramena</span>
            <input
              type="number"
              value={uArmDepth}
              onChange={(e) => onUArmDepthChange(Number(e.target.value || 0))}
              min={10}
              max={boardDepth - 1}
              className="h-7 w-16 rounded border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", background: "var(--bg-input)", color: "var(--text-body)" }}
              title="Hloubka ramene (cm)"
            />
            <input
              type="number"
              value={uArmWidth}
              onChange={(e) => onUArmWidthChange(Number(e.target.value || 0))}
              min={5}
              max={Math.max(5, Math.floor(boardWidth / 2) - 1)}
              className="h-7 w-16 rounded border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", background: "var(--bg-input)", color: "var(--text-body)" }}
              title="Šířka bočních ramen (cm)"
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleViewMode}
            className={btnBase}
            style={{
              borderColor: viewMode === "3d" ? "#10b981" : "var(--border)",
              color: viewMode === "3d" ? "#fff" : "var(--text-body)",
              background: viewMode === "3d" ? "#10b981" : "transparent",
            }}
            title={viewMode === "2d" ? "Přepnout na 3D pohled" : "Přepnout na 2D pohled"}
          >
            {viewMode === "2d" ? "🏔️ 3D" : "🗺️ 2D"}
          </button>
          <button
            onClick={elevationMode ? onCancelElevation : onStartElevation}
            className={btnBase}
            style={{
              borderColor: elevationMode ? "#8b5cf6" : "var(--border)",
              color: elevationMode ? "#fff" : "var(--text-body)",
              background: elevationMode ? "#8b5cf6" : "transparent",
            }}
            title="Nastavit výšky"
          >
            📐 Výšky
          </button>
          <button
            onClick={terrainMode === "tunnel" ? onCancelTerrain : onStartTunnel}
            className={btnBase}
            style={{
              borderColor: terrainMode === "tunnel" ? "#6366f1" : "var(--border)",
              color: terrainMode === "tunnel" ? "#fff" : "var(--text-body)",
              background: terrainMode === "tunnel" ? "#6366f1" : "transparent",
            }}
            title="Vložit tunel"
          >
            🏔️ Tunel
          </button>
          <button
            onClick={terrainMode === "bridge" ? onCancelTerrain : onStartBridge}
            className={btnBase}
            style={{
              borderColor: terrainMode === "bridge" ? "#f59e0b" : "var(--border)",
              color: terrainMode === "bridge" ? "#fff" : "var(--text-body)",
              background: terrainMode === "bridge" ? "#f59e0b" : "transparent",
            }}
            title="Vložit most"
          >
            🌉 Most
          </button>
          {/* New portal buttons */}
          <div className="relative" style={{ display: "inline-block" }}>
            <button
              onClick={() => {
                if (portalMode) { onCancelPortal(); } else { setPortalDropdown((v) => !v); }
              }}
              className={btnBase}
              style={{
                borderColor: portalMode ? "#10b981" : "var(--border)",
                color: portalMode ? "#fff" : "var(--text-body)",
                background: portalMode ? "#10b981" : "transparent",
              }}
              title="Vložit portál (tunel/most)"
            >
              🚪 Portál ▾
            </button>
            {portalDropdown && !portalMode && (
              <div
                className="absolute left-0 top-full z-30 mt-1 rounded-lg border shadow-lg"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", minWidth: 180 }}
              >
                <button
                  onClick={() => { onStartPortal("tunnel", "single"); setPortalDropdown(false); }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                  style={{ color: "var(--text-body)" }}
                >
                  🏔️ Tunel — jednokolejný
                </button>
                <button
                  onClick={() => { onStartPortal("tunnel", "double"); setPortalDropdown(false); }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                  style={{ color: "var(--text-body)" }}
                >
                  🏔️🏔️ Tunel — dvojkolejný
                </button>
                <hr style={{ borderColor: "var(--border)" }} />
                <button
                  onClick={() => { onStartPortal("bridge", "single"); setPortalDropdown(false); }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                  style={{ color: "var(--text-body)" }}
                >
                  🌉 Most — jednokolejný
                </button>
                <button
                  onClick={() => { onStartPortal("bridge", "double"); setPortalDropdown(false); }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                  style={{ color: "var(--text-body)" }}
                >
                  🌉🌉 Most — dvojkolejný
                </button>
              </div>
            )}
          </div>
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
          <ProjectMenu
            onSave={onSave}
            onSaveAs={onSaveAs}
            onLoadProject={onLoadProject}
            onDeleteProject={onDeleteProject}
            onNewProject={onNewProject}
            listProjects={listProjects}
            currentProjectName={currentProjectName}
            saveToast={saveToast}
            btnBase={btnBase}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Project dropdown menu ─── */
function ProjectMenu({
  onSave,
  onSaveAs,
  onLoadProject,
  onDeleteProject,
  onNewProject,
  listProjects,
  currentProjectName,
  saveToast,
  btnBase,
}: {
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => void;
  listProjects: () => SavedProject[];
  currentProjectName: string | null;
  saveToast?: "ok" | "fail" | null;
  btnBase: string;
}) {
  const [open, setOpen] = useState(false);

  const handleSaveAs = () => {
    const name = prompt("Název projektu:", currentProjectName || "Nový plán");
    if (!name?.trim()) return;
    onSaveAs(name.trim());
    setOpen(false);
  };

  const handleNew = () => {
    if (!confirm("Opravdu vytvořit nový prázdný projekt?")) return;
    onNewProject();
    setOpen(false);
  };

  const handleLoad = (id: string) => {
    onLoadProject(id);
    setOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Smazat projekt "${name}"?`)) return;
    onDeleteProject(id);
  };

  const projects = open ? listProjects() : [];

  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={onSave}
          className={`${btnBase} rounded-r-none border-0 transition-all`}
          style={{
            background: saveToast === "ok" ? "#22c55e" : saveToast === "fail" ? "#ef4444" : "var(--accent)",
            color: "#111",
          }}
        >
          {saveToast === "ok" ? "✓ Uloženo" : saveToast === "fail" ? "✗ Chyba" : "💾 Uložit"}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`${btnBase} rounded-l-none border-0 border-l px-1.5`}
          style={{ background: "var(--accent)", color: "#111", borderColor: "rgba(0,0,0,0.2)" }}
          title="Projekty"
        >
          ▾
        </button>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border shadow-xl"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {/* Current project header */}
            <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs opacity-60">Aktuální projekt:</div>
              <div className="truncate text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                {currentProjectName || "Neuložený"}
              </div>
            </div>

            {/* Actions */}
            <div className="border-b p-2" style={{ borderColor: "var(--border)" }}>
              <button onClick={handleSaveAs} className="w-full rounded px-3 py-1.5 text-left text-sm hover:opacity-80" style={{ color: "var(--text-body)" }}>
                📋 Uložit jako…
              </button>
              <button onClick={handleNew} className="w-full rounded px-3 py-1.5 text-left text-sm hover:opacity-80" style={{ color: "var(--text-body)" }}>
                ✨ Nový prázdný projekt
              </button>
            </div>

            {/* Project list */}
            <div className="max-h-48 overflow-y-auto p-2">
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-center text-sm opacity-50">Žádné uložené projekty</div>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5">
                    <button
                      onClick={() => handleLoad(p.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium" style={{ color: "var(--text-heading)" }}>{p.name}</div>
                      <div className="text-xs opacity-50">
                        {p.data.tracks.length} kolejí · {new Date(p.updatedAt).toLocaleDateString("cs")}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="shrink-0 rounded p-1 text-xs opacity-0 transition-opacity hover:bg-red-500/20 group-hover:opacity-100"
                      title="Smazat"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
