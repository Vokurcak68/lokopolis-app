"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { TrackCanvas } from "./TrackCanvas";
import { TrackCatalogPanel } from "./TrackCatalogPanel";
import { TrackHelpModal } from "./TrackHelpModal";
import { TrackStatsBar } from "./TrackStatsBar";
import { TrackTopBar } from "./TrackTopBar";
import { useTrackPlanner } from "./useTrackPlanner";
import { useAuth } from "@/components/Auth/AuthProvider";

const TrackViewer3D = dynamic(() => import("./TrackViewer3D"), { ssr: false });

export default function TrackPlanner() {
  const { user } = useAuth();
  const planner = useTrackPlanner();
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [showHelp, setShowHelp] = useState(false);
  const [elevationPopup, setElevationPopup] = useState<{
    trackId: string; t: number; worldX: number; worldZ: number; screenX: number; screenY: number;
    existingPointId?: string; existingElevation?: number;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) planner.redo();
        else planner.undo();
        return;
      }

      if (e.key.toLowerCase() === "f" && planner.state.selectedTrackId) {
        e.preventDefault();
        planner.flipSelectedTrack();
        return;
      }

      if (e.key === "Escape" && planner.terrainMode) {
        e.preventDefault();
        planner.cancelTerrainMode();
        return;
      }

      if (e.key === "Escape" && planner.elevationMode) {
        e.preventDefault();
        planner.cancelElevationMode();
        setElevationPopup(null);
        return;
      }

      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        const step = e.shiftKey ? -(15 * Math.PI) / 180 : (15 * Math.PI) / 180;
        if (planner.state.selectedTrackId) {
          const track = planner.state.tracks.find((t) => t.instanceId === planner.state.selectedTrackId);
          if (!track) return;
          // Only rotate if track has NO snapped connections
          if (Object.keys(track.snappedConnections).length === 0) {
            planner.updateTrack(track.instanceId, {
              rotation: track.rotation + step,
            });
          }
        } else if (planner.state.activePieceId) {
          // Rotate ghost/placement angle
          planner.rotatePlacement(step);
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && planner.selectedPortalId) {
        e.preventDefault();
        planner.removePortal(planner.selectedPortalId);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && planner.selectedZoneId) {
        e.preventDefault();
        planner.deleteSelectedZone();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && planner.state.selectedTrackId) {
        e.preventDefault();
        planner.removeTrack(planner.state.selectedTrackId);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (planner.state.activePieceId) {
          planner.setActivePiece(null);
        } else if (planner.state.selectedTrackId) {
          planner.setSelectedTrack(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [planner]);

  const [saveToast, setSaveToast] = useState<"ok" | "fail" | null>(null);

  const handleSave = useCallback(async () => {
    if (!user) {
      alert("Pro ukládání projektů se přihlas do Lokopolis.");
      return;
    }

    let ok = false;
    if (!planner.currentProjectId) {
      // First save — ask for name
      const name = prompt("Název projektu:", "Nový plán");
      if (!name?.trim()) return;
      ok = await planner.saveToLocalStorage(name.trim());
    } else {
      ok = await planner.saveToLocalStorage();
    }

    setSaveToast(ok ? "ok" : "fail");
    setTimeout(() => setSaveToast(null), 2000);
  }, [planner.saveToLocalStorage, planner.currentProjectId, user]);

  const handleExportPng = () => {
    const canvas = planner.canvasRef.current;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `lokopolis-plan-${planner.state.board.scale}.png`;
    a.click();
  };

  const handleExportList = async () => {
    const text = planner.exportShoppingList();
    try {
      await navigator.clipboard.writeText(text);
      alert("Nákupní seznam zkopírován do schránky.");
    } catch {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nakupni-seznam-${planner.state.board.scale}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col" style={{ background: "var(--bg-page)" }}>
      <TrackTopBar
        scale={planner.state.board.scale}
        boardWidth={planner.state.board.width}
        boardDepth={planner.state.board.depth}
        boardShape={planner.state.board.shape}
        lCorner={planner.state.board.lCorner ?? "bottom-right"}
        lArmWidth={Math.round(planner.state.board.lArmWidth ?? planner.state.board.width / 2)}
        lArmDepth={Math.round(planner.state.board.lArmDepth ?? planner.state.board.depth / 2)}
        uArmDepth={Math.round(planner.state.board.uArmDepth ?? planner.state.board.depth / 2)}
        uArmWidth={Math.round(planner.state.board.uArmWidth ?? planner.state.board.width / 4)}
        canUndo={planner.canUndo}
        canRedo={planner.canRedo}
        onScaleChange={planner.setScale}
        onBoardWidthChange={(width) => planner.setBoardSize({ width })}
        onBoardDepthChange={(depth) => planner.setBoardSize({ depth })}
        onBoardShapeChange={(shape) => planner.setBoardSize({ shape })}
        onLCornerChange={(lCorner) => planner.setBoardSize({ lCorner })}
        onLArmWidthChange={(lArmWidth) => planner.setBoardSize({ lArmWidth })}
        onLArmDepthChange={(lArmDepth) => planner.setBoardSize({ lArmDepth })}
        onUArmDepthChange={(uArmDepth) => planner.setBoardSize({ uArmDepth })}
        onUArmWidthChange={(uArmWidth) => planner.setBoardSize({ uArmWidth })}
        onUndo={planner.undo}
        onRedo={planner.redo}
        onClear={planner.clearAll}
        onExportPng={handleExportPng}
        onExportList={handleExportList}
        onSave={handleSave}
        onSaveAs={(name) => {
          if (!user) {
            alert("Pro ukládání projektů se přihlas do Lokopolis.");
            return;
          }
          void (async () => {
            const ok = await planner.saveProjectAs(name);
            setSaveToast(ok ? "ok" : "fail");
            setTimeout(() => setSaveToast(null), 2000);
          })();
        }}
        onLoadProject={(id) => {
          void planner.loadProject(id);
        }}
        onDeleteProject={(id) => {
          void planner.deleteProject(id);
        }}
        onNewProject={planner.newProject}
        listProjects={planner.listProjects}
        currentProjectName={planner.currentProjectName}
        canSaveProjects={Boolean(user)}
        onRequireLoginForSave={() => {
          alert("Pro ukládání projektů se přihlas do Lokopolis.");
        }}
        saveToast={saveToast}
        onToggleCatalogMobile={() => planner.setCatalogOpenMobile((v) => !v)}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((v) => (v === "2d" ? "3d" : "2d"))}
        elevationMode={planner.elevationMode}
        onStartElevation={planner.startElevationMode}
        onCancelElevation={() => { planner.cancelElevationMode(); setElevationPopup(null); }}
        portalMode={planner.portalMode}
        onStartPortal={planner.startPortalMode}
        onCancelPortal={planner.cancelPortalMode}
      />

      <div className="relative flex min-h-0 flex-1">
        <TrackCatalogPanel
          grouped={planner.catalogGrouped}
          activePieceId={planner.state.activePieceId}
          scale={planner.state.board.scale}
          openMobile={planner.catalogOpenMobile}
          onCloseMobile={() => planner.setCatalogOpenMobile(false)}
          onTogglePiece={(pieceId) => planner.setActivePiece(planner.state.activePieceId === pieceId ? null : pieceId)}
        />

        <div className="relative min-w-0 flex-1">
          {planner.activePiece && (
            <div
              className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-3 py-2"
              style={{ background: "var(--accent)", borderColor: "var(--border)" }}
            >
              <span className="text-sm font-medium text-white">
                🛤️ Vkládání: {planner.activePiece.name}
                {planner.activePiece.catalogNumber && (
                  <span className="ml-1 opacity-75">({planner.activePiece.catalogNumber})</span>
                )}
                <span className="ml-2 opacity-60">(R = otočit {Math.round((planner.placementRotation * 180) / Math.PI) % 360}°)</span>
              </span>
              <button
                onClick={() => planner.setActivePiece(null)}
                className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/30"
              >
                ✕ Ukončit vkládání
              </button>
            </div>
          )}
          {planner.portalMode && (
            <div
              className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-3 py-2"
              style={{
                background: planner.portalMode.kind === "tunnel" ? "#6366f1" : "#f59e0b",
                borderColor: "var(--border)",
              }}
            >
              <span className="text-sm font-medium text-white">
                {planner.portalMode.kind === "tunnel" ? "🏔️" : "🌉"}{" "}
                {planner.portalMode.width === "single"
                  ? planner.portalFirstTrack
                    ? "Klikni na trať — konec tunelu/mostu"
                    : "Klikni na trať — začátek tunelu/mostu"
                  : !planner.portalFirstTrack
                    ? "Klikni na 1. kolej (začátek — dvojkolejný)"
                    : !planner.portalSecondTrack
                      ? "Klikni na 2. kolej (začátek — dvojkolejný)"
                      : !planner.portalEndFirstTrack
                        ? "Klikni na 1. kolej (konec — dvojkolejný)"
                        : "Klikni na 2. kolej (konec — dvojkolejný)"}
              </span>
              <button
                onClick={planner.cancelPortalMode}
                className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/30"
              >
                ✕ Zrušit
              </button>
            </div>
          )}
          {planner.pairingPortalId && (
            <div
              className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-3 py-2"
              style={{ background: "#10b981", borderColor: "var(--border)" }}
            >
              <span className="text-sm font-medium text-white">
                🔗 Klikni na druhý portál pro spárování
              </span>
              <button
                onClick={() => planner.cancelPortalMode()}
                className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/30"
              >
                ✕ Zrušit
              </button>
            </div>
          )}
          {planner.terrainMode && (
            <div
              className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-3 py-2"
              style={{
                background: planner.terrainMode === "tunnel" ? "#6366f1" : "#f59e0b",
                borderColor: "var(--border)",
              }}
            >
              <span className="text-sm font-medium text-white">
                {planner.terrainMode === "tunnel" ? "🏔️" : "🌉"}{" "}
                {planner.terrainFirstPoint
                  ? "Klikni na trať — druhý portál (konec)"
                  : "Klikni na trať — první portál (začátek)"}
              </span>
              <button
                onClick={planner.cancelTerrainMode}
                className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/30"
              >
                ✕ Zrušit
              </button>
            </div>
          )}
          {planner.elevationMode && !planner.terrainMode && (
            <div
              className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-3 py-2"
              style={{ background: "#8b5cf6", borderColor: "var(--border)" }}
            >
              <span className="text-sm font-medium text-white">
                📐 Klikni na trať pro přidání výškového bodu
              </span>
              <button
                onClick={() => { planner.cancelElevationMode(); setElevationPopup(null); }}
                className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/30"
              >
                ✕ Zrušit
              </button>
            </div>
          )}
          {viewMode === "3d" ? (
            <TrackViewer3D
              tracks={planner.state.tracks}
              catalog={planner.catalogMap}
              board={planner.state.board}
              elevationPoints={planner.state.elevationPoints}
              terrainZones={planner.state.terrainZones}
            />
          ) : (
            <TrackCanvas
              state={planner.state}
              catalog={planner.catalogMap}
              activePiece={planner.activePiece}
              transform={planner.transform}
              canvasRef={planner.canvasRef}
              terrainMode={!!planner.terrainMode}
              elevationMode={planner.elevationMode}
              selectedZoneId={planner.selectedZoneId}
              placementRotation={planner.placementRotation}
              onTransformChange={(fn) => planner.setTransform((prev) => fn(prev))}
              onSetSelectedTrack={planner.setSelectedTrack}
              onToggleSelectTrack={planner.toggleSelectTrack}
              onSelectTracks={planner.selectTracks}
              onMoveSelectedTracks={planner.moveSelectedTracks}
              onSnapGroupDrag={planner.snapGroupDrag}
              onUnsnapTracks={planner.unsnapTracks}
              onSnapConnection={planner.snapConnection}
              onHitTestTerrainZone={planner.hitTestTerrainZone}
              onSetSelectedZone={planner.setSelectedZoneId}
              onSetHoveredTrack={planner.setHoveredTrack}
              onPlaceTrack={planner.placeTrackAt}
              onPlaceTerrainPoint={planner.placeTerrainPoint}
              onDeactivatePiece={() => planner.setActivePiece(null)}
              onUpdateTrack={planner.updateTrack}
              onSnapDraggedTrack={planner.snapDraggedTrack}
              onElevationClick={(trackId, t, worldX, worldZ, screenX, screenY) => {
                // Check if clicking near an existing elevation point
                const existing = planner.state.elevationPoints.find((ep) => {
                  if (ep.trackId !== trackId) return false;
                  return Math.abs(ep.t - t) < 0.05; // within 5% of track length
                });
                if (existing) {
                  setElevationPopup({ trackId, t: existing.t, worldX, worldZ, screenX, screenY, existingPointId: existing.id, existingElevation: existing.elevation });
                } else {
                  setElevationPopup({ trackId, t, worldX, worldZ, screenX, screenY });
                }
              }}
              portalMode={!!planner.portalMode}
              pairingMode={!!planner.pairingPortalId}
              onPlacePortalPoint={planner.placePortalPoint}
              onHitTestPortal={planner.hitTestPortal}
              onSetSelectedPortal={planner.setSelectedPortalId}
              onPairWithPortal={planner.pairWithPortal}
            />
          )}


          {/* Elevation point popup */}
          {elevationPopup && (
            <div
              className="absolute z-30 flex flex-col gap-2 rounded-lg border p-3 shadow-lg"
              style={{
                left: elevationPopup.screenX + 10,
                top: elevationPopup.screenY - 40,
                background: "var(--bg-card)",
                borderColor: "var(--border)",
              }}
            >
              <label className="text-xs font-medium" style={{ color: "var(--text-body)" }}>
                {elevationPopup.existingPointId ? "Upravit výšku (mm):" : "Výška (mm):"}
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const val = parseFloat(formData.get("elevation") as string);
                  if (!isNaN(val)) {
                    if (elevationPopup.existingPointId) {
                      planner.updateElevationPoint(elevationPopup.existingPointId, { elevation: val });
                    } else {
                      planner.addElevationPoint(elevationPopup.trackId, elevationPopup.t, val);
                    }
                  }
                  setElevationPopup(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    name="elevation"
                    type="number"
                    step="any"
                    defaultValue={elevationPopup.existingElevation ?? 0}
                    autoFocus
                    className="w-20 rounded border px-2 py-1 text-sm"
                    style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-body)" }}
                  />
                  <button
                    type="submit"
                    className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    OK
                  </button>
                  {elevationPopup.existingPointId && (
                    <button
                      type="button"
                      onClick={() => {
                        planner.removeElevationPoint(elevationPopup.existingPointId!);
                        setElevationPopup(null);
                      }}
                      className="rounded bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-700"
                    >
                      🗑
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setElevationPopup(null)}
                    className="rounded px-2 py-1 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ✕
                  </button>
                </div>
              </form>
            </div>
          )}

          {planner.selectedPortalId && (() => {
            const portal = planner.state.portals.find((p) => p.id === planner.selectedPortalId);
            if (!portal) return null;
            return (
              <div
                className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-body)" }}>
                  {portal.kind === "tunnel" ? "🏔️ Tunel" : "🌉 Most"} — {portal.width === "single" ? "jednokolejný" : "dvojkolejný"} portál
                </span>
                <button
                  onClick={() => planner.removePortal(portal.id)}
                  className="h-8 rounded-md border px-3 text-sm font-medium transition"
                  style={{ borderColor: "var(--border)", color: "#ef4444" }}
                  title="Smazat portál (Delete)"
                >
                  🗑 Smazat
                </button>
              </div>
            );
          })()}

          {planner.selectedZoneId && !planner.selectedPortalId && (() => {
            const zone = planner.state.terrainZones.find((z) => z.id === planner.selectedZoneId);
            if (!zone) return null;
            return (
              <div
                className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-body)" }}>
                  {zone.kind === "tunnel" ? "🏔️ Tunel" : "🌉 Most"}
                </span>
                <button
                  onClick={planner.deleteSelectedZone}
                  className="h-8 rounded-md border px-3 text-sm font-medium transition"
                  style={{ borderColor: "var(--border)", color: "#ef4444" }}
                  title="Smazat (Delete)"
                >
                  🗑 Smazat
                </button>
              </div>
            );
          })()}

          {planner.state.selectedTrackId && !planner.selectedZoneId && !planner.selectedPortalId && (() => {
            const selTrack = planner.state.tracks.find((t) => t.instanceId === planner.state.selectedTrackId);
            const selPiece = selTrack ? planner.catalogMap[selTrack.pieceId] : null;
            const canFlip = selPiece && selPiece.type !== "straight";
            return (
              <div
                className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                {canFlip && (
                  <button
                    onClick={planner.flipSelectedTrack}
                    className="h-8 rounded-md border px-3 text-sm font-medium transition"
                    style={{
                      borderColor: selTrack?.flipZ ? "var(--accent)" : "var(--border)",
                      color: selTrack?.flipZ ? "var(--accent)" : "var(--text-body)",
                      background: selTrack?.flipZ ? "var(--accent-bg)" : "transparent",
                    }}
                    title="Zrcadlit oblouk (F)"
                  >
                    ↔ Zrcadlit
                  </button>
                )}

                <button
                  onClick={planner.toggleSelectedAlwaysOnTop}
                  className="h-8 rounded-md border px-3 text-sm font-medium transition"
                  style={{
                    borderColor: selTrack?.alwaysOnTop ? "var(--accent)" : "var(--border)",
                    color: selTrack?.alwaysOnTop ? "var(--accent)" : "var(--text-body)",
                    background: selTrack?.alwaysOnTop ? "var(--accent-bg)" : "transparent",
                  }}
                  title="Vždy navrch"
                >
                  ⤴️ Vždy navrch
                </button>

                <button
                  onClick={planner.toggleSelectedAlwaysUnderTunnel}
                  className="h-8 rounded-md border px-3 text-sm font-medium transition"
                  style={{
                    borderColor: selTrack?.alwaysUnderTunnel ? "#4d7d41" : "var(--border)",
                    color: selTrack?.alwaysUnderTunnel ? "#4d7d41" : "var(--text-body)",
                    background: selTrack?.alwaysUnderTunnel ? "rgba(77,125,65,0.15)" : "transparent",
                  }}
                  title="Vždy pod tunelem"
                >
                  🟢 Vždy pod tunelem
                </button>

                <button
                  onClick={() => planner.removeTrack(planner.state.selectedTrackId!)}
                  className="h-8 rounded-md border px-3 text-sm font-medium transition"
                  style={{ borderColor: "var(--border)", color: "#ef4444" }}
                  title="Smazat (Delete)"
                >
                  🗑 Smazat
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      <TrackStatsBar
        pieceCount={planner.stats.pieceCount}
        totalLengthM={planner.stats.totalLengthM}
        freeConnections={planner.stats.freeConnections}
        turnouts={planner.stats.turnouts}
      />

      {/* Help button — fixed bottom-right corner */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed right-4 bottom-4 z-40 flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-lg transition-transform hover:scale-110"
        style={{ background: "var(--accent)", color: "#111" }}
        title="Nápověda"
      >
        ?
      </button>

      {showHelp && <TrackHelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
