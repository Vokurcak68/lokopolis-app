"use client";

import { useEffect } from "react";
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

      if (e.key.toLowerCase() === "r" && planner.state.selectedTrackId) {
        e.preventDefault();
        const track = planner.state.tracks.find((t) => t.instanceId === planner.state.selectedTrackId);
        if (!track) return;
        planner.updateTrack(track.instanceId, {
          rotation: track.rotation + (15 * Math.PI) / 180,
        });
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && planner.state.selectedTrackId) {
        e.preventDefault();
        planner.removeTrack(planner.state.selectedTrackId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [planner]);

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
        onSave={planner.saveToLocalStorage}
        onToggleCatalogMobile={() => planner.setCatalogOpenMobile((v) => !v)}
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
          <TrackCanvas
            state={planner.state}
            catalog={planner.catalogMap}
            activePiece={planner.activePiece}
            transform={planner.transform}
            canvasRef={planner.canvasRef}
            onTransformChange={(fn) => planner.setTransform((prev) => fn(prev))}
            onSetSelectedTrack={planner.setSelectedTrack}
            onSetHoveredTrack={planner.setHoveredTrack}
            onPlaceTrack={planner.placeTrackAt}
            onUpdateTrack={planner.updateTrack}
            onSnapDraggedTrack={planner.snapDraggedTrack}
          />

          {planner.state.selectedTrackId && (() => {
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
