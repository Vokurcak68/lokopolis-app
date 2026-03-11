"use client";

import React, { useReducer, useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import TopBar from "./TopBar";
import CatalogPanel from "./CatalogPanel";
import StatsBar, { type LayoutSource } from "./StatsBar";
import AIDialog, { type AIFormData } from "./AIDialog";
import {
  designerReducer,
  createInitialState,
  generateInstanceId,
  type DesignerAction,
  type PlacedTrack,
} from "@/lib/track-designer-store";
import {
  getCatalogByScale,
  getTrackPiece,
  type TrackScale,
  type TrackPieceDefinition,
} from "@/lib/track-library";

// Dynamic import for Three.js scene (client-only, no SSR)
const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

export default function TrackDesigner() {
  const [state, dispatch] = useReducer(designerReducer, undefined, createInitialState);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [layoutSource, setLayoutSource] = useState<LayoutSource>(null);
  const [layoutWarning, setLayoutWarning] = useState<string | null>(null);

  // Build catalog lookup
  const catalog = useMemo(() => {
    const pieces = getCatalogByScale(state.board.scale);
    const map: Record<string, TrackPieceDefinition> = {};
    for (const p of pieces) map[p.id] = p;
    return map;
  }, [state.board.scale]);

  // Active piece for placement
  const activePiece = useMemo(
    () => (state.activePieceId ? catalog[state.activePieceId] || null : null),
    [state.activePieceId, catalog]
  );

  const handleScaleChange = useCallback(
    (scale: TrackScale) => {
      dispatch({ type: "SET_BOARD", board: { ...state.board, scale, shape: "rectangle" } });
      dispatch({ type: "CLEAR_TRACKS" });
      dispatch({ type: "SET_ACTIVE_PIECE", pieceId: null });
    },
    [state.board]
  );

  const handleBoardWidthChange = useCallback(
    (w: number) => dispatch({ type: "SET_BOARD", board: { ...state.board, width: w } }),
    [state.board]
  );

  const handleBoardDepthChange = useCallback(
    (d: number) => dispatch({ type: "SET_BOARD", board: { ...state.board, depth: d } }),
    [state.board]
  );

  const handleSelectPiece = useCallback(
    (piece: TrackPieceDefinition | null) => {
      dispatch({ type: "SET_ACTIVE_PIECE", pieceId: piece?.id || null });
    },
    []
  );

  const handleClear = useCallback(() => {
    dispatch({ type: "CLEAR_TRACKS" });
    dispatch({ type: "SET_ACTIVE_PIECE", pieceId: null });
    setLayoutSource(null);
    setLayoutWarning(null);
  }, []);

  // AI Generation
  const handleAIGenerate = useCallback(
    async (formData: AIFormData) => {
      dispatch({ type: "AI_START" });

      try {
        const res = await fetch("/api/generate-track-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const json = await res.json();

        if (!res.ok || json.error) {
          dispatch({ type: "AI_ERROR", error: json.error || `Chyba serveru (${res.status})` });
          return;
        }

        // Convert AI response to PlacedTrack[]
        const tracks: PlacedTrack[] = [];
        if (json.tracks && Array.isArray(json.tracks)) {
          for (const t of json.tracks) {
            const piece = getTrackPiece(t.pieceId);
            if (!piece) continue;
            tracks.push({
              instanceId: generateInstanceId(),
              pieceId: t.pieceId,
              position: { x: t.x || 0, y: 0, z: t.z || 0 },
              rotation: t.rotation || 0,
              elevation: t.elevation || 0,
              snappedConnections: t.connectedTo || t.snappedConnections || {},
              isTunnel: t.isTunnel || false,
              isBridge: t.isBridge || false,
              isRamp: t.isRamp || false,
            });
          }
        }

        // Update board config with shape from formData (all dimensions in cm)
        dispatch({
          type: "SET_BOARD",
          board: {
            ...state.board,
            shape: formData.boardShape,
            lCorner: formData.lCorner,
            lArmWidth: formData.lArmWidth,
            lArmDepth: formData.lArmDepth,
            uArmDepth: formData.uArmDepth,
          },
        });
        dispatch({ type: "AI_SUCCESS", tracks });
        setLayoutSource((json.source as LayoutSource) || "ai");
        setLayoutWarning(json.warning || null);
        setAiDialogOpen(false);
      } catch (err) {
        dispatch({
          type: "AI_ERROR",
          error: "Chyba při komunikaci se serverem: " + (err instanceof Error ? err.message : String(err)),
        });
      }
    },
    [state.board]
  );

  // Board dimensions in mm
  const boardWidthMm = state.board.width * 10;
  const boardDepthMm = state.board.depth * 10;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        background: "var(--bg-page)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <TopBar
        scale={state.board.scale}
        boardWidth={state.board.width}
        boardDepth={state.board.depth}
        boardShape={state.board.shape}
        onScaleChange={handleScaleChange}
        onBoardWidthChange={handleBoardWidthChange}
        onBoardDepthChange={handleBoardDepthChange}
        onOpenAI={() => setAiDialogOpen(true)}
        onClear={handleClear}
        aiGenerating={state.aiGenerating}
      />

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left catalog panel */}
        <CatalogPanel
          scale={state.board.scale}
          activePieceId={state.activePieceId}
          onSelectPiece={handleSelectPiece}
        />

        {/* 3D Viewport */}
        <div style={{ flex: 1, position: "relative" }}>
          <Scene3D
            boardWidth={boardWidthMm}
            boardDepth={boardDepthMm}
            boardShape={state.board.shape}
            lCorner={state.board.lCorner}
            lArmWidth={state.board.lArmWidth ? state.board.lArmWidth * 10 : undefined}
            lArmDepth={state.board.lArmDepth ? state.board.lArmDepth * 10 : undefined}
            uArmDepth={state.board.uArmDepth ? state.board.uArmDepth * 10 : undefined}
            tracks={state.tracks}
            catalog={catalog}
            selectedTrackId={state.selectedTrackId}
            hoveredTrackId={state.hoveredTrackId}
            activePiece={activePiece}
            dispatch={dispatch}
          />

          {/* Empty state overlay */}
          {state.tracks.length === 0 && !state.aiGenerating && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🛤️</div>
              <div style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: 600 }}>
                Vyberte kolej z katalogu vlevo
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-dim)", marginTop: "4px" }}>
                nebo použijte AI generátor
              </div>
            </div>
          )}

          {/* Generating overlay */}
          {state.aiGenerating && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "12px", animation: "spin 2s linear infinite" }}>🚂</div>
              <div style={{ fontSize: "16px", color: "var(--accent)", fontWeight: 700 }}>
                AI navrhuje kolejiště...
              </div>
              <style>{`@keyframes spin { 0% { transform: translateX(-20px); } 50% { transform: translateX(20px); } 100% { transform: translateX(-20px); } }`}</style>
            </div>
          )}

          {/* Selected track info */}
          {state.selectedTrackId && (() => {
            const track = state.tracks.find(t => t.instanceId === state.selectedTrackId);
            const piece = track ? catalog[track.pieceId] : null;
            if (!track || !piece) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: "50px",
                  right: "16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "10px",
                  padding: "14px 18px",
                  fontSize: "13px",
                  color: "var(--text-body)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                  maxWidth: "250px",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: "6px" }}>
                  {piece.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-dim)", lineHeight: 1.6 }}>
                  Pozice: [{Math.round(track.position.x)}, {Math.round(track.position.z)}]<br />
                  Rotace: {Math.round((track.rotation * 180) / Math.PI)}°<br />
                  Výška: {track.elevation}mm
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                  <button
                    onClick={() => {
                      dispatch({
                        type: "UPDATE_TRACK",
                        instanceId: track.instanceId,
                        updates: { elevation: track.elevation + 10 },
                      });
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-input)",
                      color: "var(--text-body)",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    ↑ Výš
                  </button>
                  <button
                    onClick={() => {
                      dispatch({
                        type: "UPDATE_TRACK",
                        instanceId: track.instanceId,
                        updates: { elevation: Math.max(0, track.elevation - 10) },
                      });
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-input)",
                      color: "var(--text-body)",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    ↓ Níž
                  </button>
                  <button
                    onClick={() => {
                      dispatch({
                        type: "UPDATE_TRACK",
                        instanceId: track.instanceId,
                        updates: { isTunnel: !track.isTunnel },
                      });
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: `1px solid ${track.isTunnel ? "var(--accent)" : "var(--border)"}`,
                      background: track.isTunnel ? "var(--accent-bg)" : "var(--bg-input)",
                      color: track.isTunnel ? "var(--accent)" : "var(--text-body)",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    🕳️
                  </button>
                  <button
                    onClick={() => {
                      dispatch({
                        type: "UPDATE_TRACK",
                        instanceId: track.instanceId,
                        updates: { isBridge: !track.isBridge },
                      });
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: `1px solid ${track.isBridge ? "var(--accent)" : "var(--border)"}`,
                      background: track.isBridge ? "var(--accent-bg)" : "var(--bg-input)",
                      color: track.isBridge ? "var(--accent)" : "var(--text-body)",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    🌉
                  </button>
                  <button
                    onClick={() => dispatch({ type: "REMOVE_TRACK", instanceId: track.instanceId })}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid rgba(244, 67, 54, 0.3)",
                      background: "rgba(244, 67, 54, 0.1)",
                      color: "#ff6b6b",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bottom stats bar */}
      <StatsBar tracks={state.tracks} catalog={catalog} layoutSource={layoutSource} layoutWarning={layoutWarning} />

      {/* AI Dialog */}
      <AIDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onGenerate={handleAIGenerate}
        scale={state.board.scale}
        boardWidth={state.board.width}
        boardDepth={state.board.depth}
        generating={state.aiGenerating}
        error={state.aiError}
      />
    </div>
  );
}
