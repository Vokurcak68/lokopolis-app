"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  canSnap,
  computeSnapPlacement,
  connectionToWorld,
  createInitialState,
  designerReducer,
  findFreeConnections,
  generateInstanceId,
  generateZoneId,
  type DesignerState,
  type PlacedTrack,
  type TerrainZoneKind,
  type TrackPoint,
} from "@/lib/track-designer-store";
import {
  getCatalogByScale,
  getCatalogGrouped,
  getTrackPiece,
  type TrackPieceDefinition,
  type TrackScale,
} from "@/lib/track-library";
import { getBoardPathMm, isPointInsidePolygon, closestPointOnAnyTrack, type ViewTransform } from "@/lib/track-canvas-renderer";

const STORAGE_KEY = "lokopolis-track-planner-v1";
const PROJECTS_KEY = "lokopolis-track-projects";
const CURRENT_PROJECT_KEY = "lokopolis-track-current-project";

/** Stripped-down version for storage (no history stacks) */
interface PersistedData {
  board: DesignerState["board"];
  tracks: DesignerState["tracks"];
  terrainZones: DesignerState["terrainZones"];
  transform: ViewTransform;
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  data: PersistedData;
}

function generateProjectId(): string {
  return `prj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getAllProjects(): SavedProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedProject[];
  } catch {
    return [];
  }
}

function saveAllProjects(projects: SavedProject[]) {
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function getCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CURRENT_PROJECT_KEY);
}

function setCurrentProjectId(id: string | null) {
  if (id) {
    window.localStorage.setItem(CURRENT_PROJECT_KEY, id);
  } else {
    window.localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

function dataToState(data: PersistedData): DesignerState {
  return {
    board: data.board,
    tracks: data.tracks ?? [],
    terrainZones: data.terrainZones ?? [],
    selectedTrackId: null,
    hoveredTrackId: null,
    activePieceId: null,
    aiGenerating: false,
    aiError: null,
    historyPast: [],
    historyFuture: [],
  };
}

/** Load current project, or migrate old single-save format */
function loadPersisted(): { state: DesignerState; transform: ViewTransform; projectId: string | null; projectName: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    // Try loading current project
    const currentId = getCurrentProjectId();
    if (currentId) {
      const projects = getAllProjects();
      const project = projects.find((p) => p.id === currentId);
      if (project) {
        return {
          state: dataToState(project.data),
          transform: project.data.transform,
          projectId: project.id,
          projectName: project.name,
        };
      }
    }

    // Migrate old format
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    let data: PersistedData | null = null;
    if (parsed?.board && parsed?.tracks) {
      data = parsed as PersistedData;
    } else if (parsed?.state?.board) {
      const s = parsed.state;
      data = { board: s.board, tracks: s.tracks ?? [], terrainZones: s.terrainZones ?? [], transform: parsed.transform };
    }
    if (!data) return null;

    // Migrate to named project
    const id = generateProjectId();
    const project: SavedProject = { id, name: "Můj první plán", updatedAt: Date.now(), data };
    saveAllProjects([project]);
    setCurrentProjectId(id);
    window.localStorage.removeItem(STORAGE_KEY);

    return { state: dataToState(data), transform: data.transform, projectId: id, projectName: project.name };
  } catch {
    return null;
  }
}

export function useTrackPlanner() {
  const persistedRef = useRef(loadPersisted());
  const [state, dispatch] = useReducer(
    designerReducer,
    persistedRef.current?.state ?? createInitialState(),
  );
  const [transform, setTransform] = useState<ViewTransform>(
    persistedRef.current?.transform ?? {
      zoom: 0.45,
      offsetX: 180,
      offsetY: 120,
    },
  );
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(persistedRef.current?.projectId ?? null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(persistedRef.current?.projectName ?? null);
  const [catalogOpenMobile, setCatalogOpenMobile] = useState(false);

  // Placement rotation for free-placement (no snap) — persists between placements
  const [placementRotation, setPlacementRotation] = useState(0);

  // Terrain zone placement mode
  const [terrainMode, setTerrainMode] = useState<TerrainZoneKind | null>(null);
  const [terrainFirstPoint, setTerrainFirstPoint] = useState<TrackPoint | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

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

  /** Save current project (or create new if none) */
  const saveProject = useCallback((nameOverride?: string): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const data: PersistedData = {
        board: state.board,
        tracks: state.tracks,
        terrainZones: state.terrainZones,
        transform,
      };
      const projects = getAllProjects();

      if (currentProjectId) {
        // Update existing
        const idx = projects.findIndex((p) => p.id === currentProjectId);
        if (idx >= 0) {
          projects[idx].data = data;
          projects[idx].updatedAt = Date.now();
          if (nameOverride) projects[idx].name = nameOverride;
          saveAllProjects(projects);
          if (nameOverride) setCurrentProjectName(nameOverride);
          return true;
        }
      }

      // Create new
      const name = nameOverride || "Nový plán";
      const id = generateProjectId();
      projects.push({ id, name, updatedAt: Date.now(), data });
      saveAllProjects(projects);
      setCurrentProjectId(id);
      setCurrentProjectIdState(id);
      setCurrentProjectName(name);
      return true;
    } catch (e) {
      console.error("Nepodařilo se uložit:", e);
      return false;
    }
  }, [state.board, state.tracks, state.terrainZones, transform, currentProjectId]);

  /** Save As — prompt for name */
  const saveProjectAs = useCallback((name: string): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const data: PersistedData = {
        board: state.board,
        tracks: state.tracks,
        terrainZones: state.terrainZones,
        transform,
      };
      const id = generateProjectId();
      const projects = getAllProjects();
      projects.push({ id, name, updatedAt: Date.now(), data });
      saveAllProjects(projects);
      setCurrentProjectId(id);
      setCurrentProjectIdState(id);
      setCurrentProjectName(name);
      return true;
    } catch (e) {
      console.error("Nepodařilo se uložit:", e);
      return false;
    }
  }, [state.board, state.tracks, state.terrainZones, transform]);

  /** Load a saved project */
  const loadProject = useCallback((projectId: string) => {
    const projects = getAllProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return false;
    dispatch({ type: "LOAD_STATE", state: dataToState(project.data) });
    setTransform(project.data.transform);
    setCurrentProjectId(projectId);
    setCurrentProjectIdState(projectId);
    setCurrentProjectName(project.name);
    return true;
  }, []);

  /** Delete a saved project */
  const deleteProject = useCallback((projectId: string) => {
    const projects = getAllProjects().filter((p) => p.id !== projectId);
    saveAllProjects(projects);
    if (currentProjectId === projectId) {
      setCurrentProjectIdState(null);
      setCurrentProjectName(null);
      setCurrentProjectId(null);
    }
  }, [currentProjectId]);

  /** New empty project */
  const newProject = useCallback(() => {
    dispatch({ type: "CLEAR_TRACKS" });
    setCurrentProjectIdState(null);
    setCurrentProjectName(null);
    setCurrentProjectId(null);
  }, []);

  /** List all saved projects */
  const listProjects = useCallback((): SavedProject[] => {
    return getAllProjects().sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  // Auto-save debounced (2s after last change) — only if project exists
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !currentProjectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        const data: PersistedData = { board: state.board, tracks: state.tracks, terrainZones: state.terrainZones, transform };
        const projects = getAllProjects();
        const idx = projects.findIndex((p) => p.id === currentProjectId);
        if (idx >= 0) {
          projects[idx].data = data;
          projects[idx].updatedAt = Date.now();
          saveAllProjects(projects);
        }
      } catch { /* ignore auto-save errors */ }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [state.board, state.tracks, state.terrainZones, transform, currentProjectId]);

  const clearAll = useCallback(() => dispatch({ type: "CLEAR_TRACKS" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const updateTrack = useCallback((instanceId: string, updates: Partial<PlacedTrack>) => {
    dispatch({ type: "UPDATE_TRACK", instanceId, updates });
  }, []);

  const removeTrack = useCallback((instanceId: string) => dispatch({ type: "REMOVE_TRACK", instanceId }), []);

  const placeTrackAt = useCallback(
    (piece: TrackPieceDefinition, worldX: number, worldZ: number, preferredRotation?: number) => {
      let position = { x: worldX, y: 0, z: worldZ };
      let rotation = preferredRotation ?? placementRotation;
      let snapMatch: { targetInstanceId: string; targetConnId: string; fromConnId: string } | null = null;

      // Find the nearest free connection to the click point (max 60mm)
      let bestFree: (typeof freeConnections)[number] | null = null;
      let bestDist = 60; // max snap distance in mm
      for (const free of freeConnections) {
        const dist = Math.hypot(free.worldPos.x - worldX, free.worldPos.z - worldZ);
        if (dist < bestDist) {
          bestDist = dist;
          bestFree = free;
        }
      }

      if (bestFree) {
        // Try snap only to this nearest free connection
        for (const fromConn of piece.connections) {
          const placement = computeSnapPlacement(bestFree.worldPos, bestFree.worldAngle, piece, fromConn.id);
          if (!placement) continue;

          const fromWorld = connectionToWorld(fromConn, placement.position, placement.rotation);
          if (
            canSnap(fromWorld, { position: bestFree.worldPos, angle: bestFree.worldAngle }, 6)
          ) {
            position = placement.position;
            rotation = placement.rotation;
            snapMatch = {
              targetInstanceId: bestFree.instanceId,
              targetConnId: bestFree.connId,
              fromConnId: fromConn.id,
            };
            break;
          }
        }
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

      // Remember rotation for next free placement
      setPlacementRotation(rotation);

      dispatch({ type: "SELECT_TRACK", instanceId });
      return instanceId;
    },
    [freeConnections, placementRotation],
  );

  const snapDraggedTrack = useCallback(
    (track: PlacedTrack): PlacedTrack => {
      const piece = catalogMap[track.pieceId];
      if (!piece) return track;

      const freeOthers = freeConnections.filter((f) => f.instanceId !== track.instanceId);
      for (const conn of piece.connections) {
        const connWorld = connectionToWorld(conn, track.position, track.rotation, track.flipZ);
        for (const target of freeOthers) {
          if (!canSnap(connWorld, { position: target.worldPos, angle: target.worldAngle }, 8)) continue;

          const placement = computeSnapPlacement(target.worldPos, target.worldAngle, piece, conn.id, track.flipZ);
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

  const flipSelectedTrack = useCallback(() => {
    if (!state.selectedTrackId) return;
    const track = state.tracks.find((t) => t.instanceId === state.selectedTrackId);
    if (!track) return;
    const piece = catalogMap[track.pieceId];
    if (!piece) return;
    // Only flip non-straight pieces (curves, turnouts, crossings)
    if (piece.type === "straight") return;
    dispatch({ type: "UPDATE_TRACK", instanceId: track.instanceId, updates: { flipZ: !track.flipZ } });
  }, [state.selectedTrackId, state.tracks, catalogMap]);

  const toggleSelectedTunnel = useCallback(() => {
    if (!state.selectedTrackId) return;
    const track = state.tracks.find((t) => t.instanceId === state.selectedTrackId);
    if (!track) return;
    // Tunnel and bridge are mutually exclusive
    dispatch({
      type: "UPDATE_TRACK",
      instanceId: track.instanceId,
      updates: { isTunnel: !track.isTunnel, isBridge: track.isTunnel ? track.isBridge : false },
    });
  }, [state.selectedTrackId, state.tracks]);

  const startTerrainMode = useCallback((kind: TerrainZoneKind) => {
    setTerrainMode(kind);
    setTerrainFirstPoint(null);
    // Deselect current piece/track so clicks go to terrain placement
    dispatch({ type: "SET_ACTIVE_PIECE", pieceId: null });
    dispatch({ type: "SELECT_TRACK", instanceId: null });
  }, []);

  const cancelTerrainMode = useCallback(() => {
    setTerrainMode(null);
    setTerrainFirstPoint(null);
  }, []);

  const placeTerrainPoint = useCallback(
    (worldX: number, worldZ: number) => {
      if (!terrainMode) return false;

      const hit = closestPointOnAnyTrack({ x: worldX, z: worldZ }, state.tracks, catalogMap);
      if (!hit || hit.distance > 15) return false; // must click near a track (15mm tolerance)

      const point: TrackPoint = { trackId: hit.trackId, t: hit.t, worldX: hit.worldPos.x, worldZ: hit.worldPos.z };

      if (!terrainFirstPoint) {
        // First click — set start portal
        setTerrainFirstPoint(point);
        return true;
      }

      // Second click — create zone
      const zone = {
        id: generateZoneId(),
        kind: terrainMode,
        start: terrainFirstPoint,
        end: point,
      };
      dispatch({ type: "ADD_TERRAIN_ZONE", zone });
      setTerrainMode(null);
      setTerrainFirstPoint(null);
      return true;
    },
    [terrainMode, terrainFirstPoint, state.tracks, catalogMap],
  );

  const removeTerrainZone = useCallback((zoneId: string) => {
    dispatch({ type: "REMOVE_TERRAIN_ZONE", zoneId });
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
  }, [selectedZoneId]);

  /** Check if a world point is near any terrain zone path, return zone id */
  const hitTestTerrainZone = useCallback(
    (worldX: number, worldZ: number): string | null => {
      for (const zone of state.terrainZones) {
        // Check proximity to start/end portals
        const startPos = zone.start.worldX !== undefined ? { x: zone.start.worldX, z: zone.start.worldZ! } : null;
        const endPos = zone.end.worldX !== undefined ? { x: zone.end.worldX, z: zone.end.worldZ! } : null;
        if (startPos && Math.hypot(worldX - startPos.x, worldZ - startPos.z) < 20) return zone.id;
        if (endPos && Math.hypot(worldX - endPos.x, worldZ - endPos.z) < 20) return zone.id;
      }
      return null;
    },
    [state.terrainZones],
  );

  const deleteSelectedZone = useCallback(() => {
    if (selectedZoneId) {
      removeTerrainZone(selectedZoneId);
      setSelectedZoneId(null);
    }
  }, [selectedZoneId, removeTerrainZone]);

  const toggleSelectedBridge = useCallback(() => {
    if (!state.selectedTrackId) return;
    const track = state.tracks.find((t) => t.instanceId === state.selectedTrackId);
    if (!track) return;
    // Bridge and tunnel are mutually exclusive
    dispatch({
      type: "UPDATE_TRACK",
      instanceId: track.instanceId,
      updates: { isBridge: !track.isBridge, isTunnel: track.isBridge ? track.isTunnel : false },
    });
  }, [state.selectedTrackId, state.tracks]);

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
    saveToLocalStorage: saveProject,
    saveProjectAs,
    loadProject,
    deleteProject,
    newProject,
    listProjects,
    currentProjectId,
    currentProjectName,
    clearAll,
    undo,
    redo,
    updateTrack,
    removeTrack,
    placeTrackAt,
    snapDraggedTrack,
    flipSelectedTrack,
    toggleSelectedTunnel,
    toggleSelectedBridge,
    terrainMode,
    terrainFirstPoint,
    startTerrainMode,
    cancelTerrainMode,
    placeTerrainPoint,
    removeTerrainZone,
    selectedZoneId,
    setSelectedZoneId,
    hitTestTerrainZone,
    deleteSelectedZone,
    placementRotation,
    rotatePlacement: useCallback((delta: number) => {
      setPlacementRotation((prev) => prev + delta);
    }, []),
    exportShoppingList,
    canUndo: state.historyPast.length > 0,
    canRedo: state.historyFuture.length > 0,
  };
}
