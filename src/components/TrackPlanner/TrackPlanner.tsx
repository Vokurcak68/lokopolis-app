"use client";

import { useCallback, useEffect, useState } from "react";
import { TrackCanvas } from "./TrackCanvas";
import { TrackCatalogPanel } from "./TrackCatalogPanel";
import { TrackStatsBar } from "./TrackStatsBar";
import { TrackTopBar } from "./TrackTopBar";
import { useTrackPlanner } from "./useTrackPlanner";

export default function TrackPlanner() {
  const planner = useTrackPlanner();

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

  const handleSave = useCallback(() => {
    const ok = planner.saveToLocalStorage();
    setSaveToast(ok ? "ok" : "fail");
    setTimeout(() => setSaveToast(null), 2000);
  }, [planner.saveToLocalStorage]);

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
        saveToast={saveToast}
        onToggleCatalogMobile={() => planner.setCatalogOpenMobile((v) => !v)}
        terrainMode={planner.terrainMode}
        onStartTunnel={() => planner.startTerrainMode("tunnel")}
        onStartBridge={() => planner.startTerrainMode("bridge")}
        onCancelTerrain={planner.cancelTerrainMode}
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
          <TrackCanvas
            state={planner.state}
            catalog={planner.catalogMap}
            activePiece={planner.activePiece}
            transform={planner.transform}
            canvasRef={planner.canvasRef}
            terrainMode={!!planner.terrainMode}
            selectedZoneId={planner.selectedZoneId}
            placementRotation={planner.placementRotation}
            onTransformChange={(fn) => planner.setTransform((prev) => fn(prev))}
            onSetSelectedTrack={planner.setSelectedTrack}
            onHitTestTerrainZone={planner.hitTestTerrainZone}
            onSetSelectedZone={planner.setSelectedZoneId}
            onSetHoveredTrack={planner.setHoveredTrack}
            onPlaceTrack={planner.placeTrackAt}
            onPlaceTerrainPoint={planner.placeTerrainPoint}
            onDeactivatePiece={() => planner.setActivePiece(null)}
            onUpdateTrack={planner.updateTrack}
            onSnapDraggedTrack={planner.snapDraggedTrack}
          />

          {planner.selectedZoneId && (() => {
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

          {planner.state.selectedTrackId && !planner.selectedZoneId && (() => {
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
    </div>
  );
}
