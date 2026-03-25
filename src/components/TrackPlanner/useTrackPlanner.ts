"use client";

import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import {
  canSnap,
  computeSnapPlacement,
  connectionToWorld,
  createInitialState,
  designerReducer,
  findFreeConnections,
  generateInstanceId,
  type DesignerState,
  type PlacedTrack,
} from "@/lib/track-designer-store";
import {
  getCatalogByScale,
  getCatalogGrouped,
  getTrackPiece,
  type TrackPieceDefinition,
  type TrackScale,
} from "@/lib/track-library";
import { getBoardPathMm, isPointInsidePolygon, type ViewTransform } from "@/lib/track-canvas-renderer";

const STORAGE_KEY = "lokopolis-track-planner-v1";

interface PersistedPlanner {
  state: DesignerState;
  transform: ViewTransform;
}

function loadPersisted(): PersistedPlanner | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPlanner;
    if (!parsed?.state?.board) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useTrackPlanner() {
  const persisted = loadPersisted();
  const [state, dispatch] = useReducer(designerReducer, persisted?.state ?? undefined, createInitialState);
  const [transform, setTransform] = useState<ViewTransform>(
    persisted?.transform ?? {
      zoom: 0.45,
      offsetX: 180,
      offsetY: 120,
    },
  );
  const [catalogOpenMobile, setCatalogOpenMobile] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const catalogGrouped = useMemo(() => getCatalogGrouped(state.board.scale), [state.board.scale]);

  const catalogMap = useMemo(() => {
    const entries = getCatalogByScale(state.board.scale);
    const map: Record<string, TrackPieceDefinition> = {};
    for (const p of entries) map[p.id] = p;
    return map;
  }, [state.board.scale]);

  const freeConnections = useMemo(() => findFreeConnections(state.tracks, catalogMap), [state.tracks, catalogMap]);

  const activePiece = useMemo(
    () => (state.activePieceId ? getTrackPiece(state.activePieceId) ?? null : null),
    [state.activePieceId],
  );

  const setScale = useCallback(
    (scale: TrackScale) => {
      dispatch({ type: "SET_BOARD", board: { ...state.board, scale } });
      dispatch({ type: "SET_ACTIVE_PIECE", pieceId: null });
      dispatch({ type: "CLEAR_TRACKS" });
    },
    [state.board],
  );

  const setBoardSize = useCallback(
    (next: {
      width?: number;
      depth?: number;
      shape?: "rectangle" | "l-shape" | "u-shape";
      lCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
      lArmWidth?: number;
      lArmDepth?: number;
      uArmDepth?: number;
      uArmWidth?: number;
    }) => {
      const width = next.width ?? state.board.width;
      const depth = next.depth ?? state.board.depth;
      const shape = next.shape ?? state.board.shape;
      dispatch({
        type: "SET_BOARD",
        board: {
          ...state.board,
          width,
          depth,
          shape,
          lCorner: next.lCorner ?? state.board.lCorner ?? "bottom-right",
          lArmWidth: next.lArmWidth ?? state.board.lArmWidth ?? width / 2,
          lArmDepth: next.lArmDepth ?? state.board.lArmDepth ?? depth / 2,
          uArmDepth: next.uArmDepth ?? state.board.uArmDepth ?? depth / 2,
          uArmWidth: next.uArmWidth ?? state.board.uArmWidth ?? width / 4,
        },
      });
    },
    [state.board],
  );

  const setActivePiece = useCallback((pieceId: string | null) => dispatch({ type: "SET_ACTIVE_PIECE", pieceId }), []);

  const setSelectedTrack = useCallback((instanceId: string | null) => dispatch({ type: "SELECT_TRACK", instanceId }), []);
  const setHoveredTrack = useCallback((instanceId: string | null) => dispatch({ type: "HOVER_TRACK", instanceId }), []);

  const saveToLocalStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    const payload: PersistedPlanner = { state, transform };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [state, transform]);

  const clearAll = useCallback(() => dispatch({ type: "CLEAR_TRACKS" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const updateTrack = useCallback((instanceId: string, updates: Partial<PlacedTrack>) => {
    dispatch({ type: "UPDATE_TRACK", instanceId, updates });
  }, []);

  const removeTrack = useCallback((instanceId: string) => dispatch({ type: "REMOVE_TRACK", instanceId }), []);

  const placeTrackAt = useCallback(
    (piece: TrackPieceDefinition, worldX: number, worldZ: number, preferredRotation = 0) => {
      let position = { x: worldX, y: 0, z: worldZ };
      let rotation = preferredRotation;
      let snapMatch: { targetInstanceId: string; targetConnId: string; fromConnId: string } | null = null;

      for (const fromConn of piece.connections) {
        for (const free of freeConnections) {
          const placement = computeSnapPlacement(free.worldPos, free.worldAngle, piece, fromConn.id);
          if (!placement) continue;

          const fromWorld = connectionToWorld(fromConn, placement.position, placement.rotation);
          if (
            canSnap(fromWorld, { position: free.worldPos, angle: free.worldAngle }, 6)
          ) {
            position = placement.position;
            rotation = placement.rotation;
            snapMatch = {
              targetInstanceId: free.instanceId,
              targetConnId: free.connId,
              fromConnId: fromConn.id,
            };
            break;
          }
        }
        if (snapMatch) break;
      }

      if (!snapMatch) {
        const boardPath = getBoardPathMm(state.board);
        const insideBoard = isPointInsidePolygon({ x: worldX, z: worldZ }, boardPath);
        if (!insideBoard) return null;
      }

      const instanceId = generateInstanceId();
      dispatch({
        type: "ADD_TRACK",
        track: {
          instanceId,
          pieceId: piece.id,
          position,
          rotation,
          elevation: 0,
          snappedConnections: {},
        },
      });

      if (snapMatch) {
        dispatch({
          type: "SNAP_CONNECTION",
          fromInstanceId: instanceId,
          fromConnId: snapMatch.fromConnId,
          toInstanceId: snapMatch.targetInstanceId,
          toConnId: snapMatch.targetConnId,
        });
      }

      dispatch({ type: "SELECT_TRACK", instanceId });
      return instanceId;
    },
    [freeConnections],
  );

  const snapDraggedTrack = useCallback(
    (track: PlacedTrack): PlacedTrack => {
      const piece = catalogMap[track.pieceId];
      if (!piece) return track;

      const freeOthers = freeConnections.filter((f) => f.instanceId !== track.instanceId);
      for (const conn of piece.connections) {
        const connWorld = connectionToWorld(conn, track.position, track.rotation);
        for (const target of freeOthers) {
          if (!canSnap(connWorld, { position: target.worldPos, angle: target.worldAngle }, 8)) continue;

          const placement = computeSnapPlacement(target.worldPos, target.worldAngle, piece, conn.id);
          if (!placement) continue;

          return {
            ...track,
            position: placement.position,
            rotation: placement.rotation,
          };
        }
      }

      return track;
    },
    [catalogMap, freeConnections],
  );

  const exportShoppingList = useCallback(() => {
    const counts = new Map<string, { piece: TrackPieceDefinition; count: number }>();
    for (const t of state.tracks) {
      const piece = catalogMap[t.pieceId];
      if (!piece) continue;
      const prev = counts.get(piece.id);
      if (prev) prev.count += 1;
      else counts.set(piece.id, { piece, count: 1 });
    }

    const rows = [
      `Nákupní seznam (${state.board.scale})`,
      `Kusů celkem: ${state.tracks.length}`,
      "",
      "Počet | Katalog | Název",
      "----- | ------- | -----",
    ];

    for (const { piece, count } of [...counts.values()].sort((a, b) => a.piece.name.localeCompare(b.piece.name, "cs"))) {
      rows.push(`${count}x | ${piece.catalogNumber ?? "-"} | ${piece.name}`);
    }

    return rows.join("\n");
  }, [catalogMap, state.board.scale, state.tracks]);

  const stats = useMemo(() => {
    let totalLengthMm = 0;
    let turnouts = 0;

    for (const track of state.tracks) {
      const piece = catalogMap[track.pieceId];
      if (!piece) continue;

      if (piece.type === "turnout") turnouts += 1;
      if (piece.type === "curve" && piece.radius && piece.angle) {
        totalLengthMm += (piece.radius * piece.angle * Math.PI) / 180;
      } else {
        totalLengthMm += piece.length ?? 0;
      }
    }

    return {
      pieceCount: state.tracks.length,
      totalLengthM: totalLengthMm / 1000,
      freeConnections: freeConnections.length,
      turnouts,
    };
  }, [catalogMap, freeConnections.length, state.tracks]);

  return {
    state,
    dispatch,
    transform,
    setTransform,
    canvasRef,
    catalogMap,
    catalogGrouped,
    freeConnections,
    activePiece,
    stats,
    catalogOpenMobile,
    setCatalogOpenMobile,
    setScale,
    setBoardSize,
    setActivePiece,
    setSelectedTrack,
    setHoveredTrack,
    saveToLocalStorage,
    clearAll,
    undo,
    redo,
    updateTrack,
    removeTrack,
    placeTrackAt,
    snapDraggedTrack,
    exportShoppingList,
    canUndo: state.historyPast.length > 0,
    canRedo: state.historyFuture.length > 0,
  };
}
