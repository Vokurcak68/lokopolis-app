"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  canSnap,
  computeSnapPlacement,
  connectionToWorld,
  createInitialState,
  designerReducer,
  findFreeConnections,
  generateInstanceId,
  generateZoneId,
  generateElevationPointId,
  type DesignerState,
  type ElevationPoint,
  type PlacedTrack,
  type TerrainZoneKind,
  type TrackPoint,
  type Portal,
  type PortalWidth,
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
const CLOUD_CURRENT_PROJECT_KEY = "lokopolis-track-cloud-current-project";

const DEFAULT_TRANSFORM: ViewTransform = {
  zoom: 0.45,
  offsetX: 180,
  offsetY: 120,
};

/** Stripped-down version for storage (no history stacks) */
interface PersistedData {
  board: DesignerState["board"];
  tracks: DesignerState["tracks"];
  terrainZones: DesignerState["terrainZones"];
  portals?: DesignerState["portals"];
  elevationPoints?: DesignerState["elevationPoints"];
  transform: ViewTransform;
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  data: PersistedData;
}

interface CloudProjectRow {
  id: string;
  name: string;
  data: PersistedData;
  updated_at: string;
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

function getCloudCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLOUD_CURRENT_PROJECT_KEY);
}

function setCloudCurrentProjectId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    window.localStorage.setItem(CLOUD_CURRENT_PROJECT_KEY, id);
  } else {
    window.localStorage.removeItem(CLOUD_CURRENT_PROJECT_KEY);
  }
}

function dataToState(data: PersistedData): DesignerState {
  const portals = data.portals ?? [];
  const portalTrackIds = new Set<string>();
  for (const p of portals) {
    portalTrackIds.add(p.track1.trackId);
    if (p.track2) portalTrackIds.add(p.track2.trackId);
  }
  // Clean orphaned isTunnel/isBridge flags on tracks without portals
  const tracks = (data.tracks ?? []).map((t) => {
    if ((t.isTunnel || t.isBridge) && !portalTrackIds.has(t.instanceId)) {
      return { ...t, isTunnel: false, isBridge: false };
    }
    return t;
  });
  return {
    board: data.board,
    tracks,
    terrainZones: data.terrainZones ?? [],
    portals,
    elevationPoints: data.elevationPoints ?? [],
    selectedTrackId: null,
    selectedTrackIds: [],
    hoveredTrackId: null,
    activePieceId: null,
    aiGenerating: false,
    aiError: null,
    historyPast: [],
    historyFuture: [],
  };
}

/** Load current project, or migrate old single-save format */
function loadPersisted(allowLocalProjects: boolean): { state: DesignerState; transform: ViewTransform; projectId: string | null; projectName: string | null } | null {
  if (typeof window === "undefined" || !allowLocalProjects) return null;
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
      data = {
        board: s.board,
        tracks: s.tracks ?? [],
        terrainZones: s.terrainZones ?? [],
        portals: s.portals ?? [],
        elevationPoints: s.elevationPoints ?? [],
        transform: parsed.transform,
      };
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

/** BFS to find connected tracks between two track IDs (via snappedConnections) */
function findTracksBetween(startId: string, endId: string, tracks: PlacedTrack[]): string[] {
  if (startId === endId) return [startId];
  const trackMap = new Map(tracks.map((t) => [t.instanceId, t]));
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const track = trackMap.get(current);
    if (!track) continue;

    for (const conn of Object.values(track.snappedConnections)) {
      const neighborId = conn.split(":")[0];
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parent.set(neighborId, current);
      if (neighborId === endId) {
        // Reconstruct path
        const path: string[] = [];
        let node: string | undefined = endId;
        while (node && node !== startId) {
          path.push(node);
          node = parent.get(node);
        }
        path.push(startId);
        return path;
      }
      queue.push(neighborId);
    }
  }
  // Not connected — return just the endpoints
  return [startId, endId];
}

export function useTrackPlanner() {
  const { user, loading: authLoading } = useAuth();
  const persistedRef = useRef(loadPersisted(Boolean(user)));
  const [state, dispatch] = useReducer(
    designerReducer,
    persistedRef.current?.state ?? createInitialState(),
  );
  const [transform, setTransform] = useState<ViewTransform>(
    persistedRef.current?.transform ?? DEFAULT_TRANSFORM,
  );
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(persistedRef.current?.projectId ?? null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(persistedRef.current?.projectName ?? null);
  const [cloudProjects, setCloudProjects] = useState<SavedProject[]>([]);
  const [catalogOpenMobile, setCatalogOpenMobile] = useState(false);
  const hasHydratedCloudProjectRef = useRef(false);
  const cloudFetchedRef = useRef(false);

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
  const toggleSelectTrack = useCallback((instanceId: string) => dispatch({ type: "TOGGLE_SELECT_TRACK", instanceId }), []);
  const selectTracks = useCallback((instanceIds: string[]) => dispatch({ type: "SELECT_TRACKS", instanceIds }), []);
  const moveSelectedTracks = useCallback((dx: number, dz: number) => dispatch({ type: "MOVE_SELECTED_TRACKS", dx, dz }), []);
  const unsnapTracks = useCallback((instanceIds: string[]) => dispatch({ type: "UNSNAP_TRACKS", instanceIds }), []);
  const snapConnection = useCallback((fromInstanceId: string, fromConnId: string, toInstanceId: string, toConnId: string) => {
    dispatch({ type: "SNAP_CONNECTION", fromInstanceId, fromConnId, toInstanceId, toConnId });
  }, []);
  const setHoveredTrack = useCallback((instanceId: string | null) => dispatch({ type: "HOVER_TRACK", instanceId }), []);

  const serializeCurrentData = useCallback((): PersistedData => ({
    board: state.board,
    tracks: state.tracks,
    terrainZones: state.terrainZones,
    portals: state.portals,
    elevationPoints: state.elevationPoints,
    transform,
  }), [state.board, state.tracks, state.terrainZones, state.portals, state.elevationPoints, transform]);

  const fetchCloudProjects = useCallback(async () => {
    if (!user) {
      setCloudProjects([]);
      return;
    }

    const { data, error } = await supabase
      .from("track_planner_projects")
      .select("id,name,data,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Nepodařilo se načíst projekty:", error.message);
      return;
    }

    const mapped: SavedProject[] = ((data as CloudProjectRow[] | null) ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: new Date(p.updated_at).getTime(),
      data: p.data,
    }));
    setCloudProjects(mapped);
    cloudFetchedRef.current = true;
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCloudProjects([]);
      setCurrentProjectIdState(null);
      setCurrentProjectName(null);
      setCloudCurrentProjectId(null);
      hasHydratedCloudProjectRef.current = false;
      cloudFetchedRef.current = false;
      dispatch({ type: "CLEAR_TRACKS" });
      setTransform(DEFAULT_TRANSFORM);
      return;
    }
    void fetchCloudProjects();
  }, [authLoading, user, fetchCloudProjects]);

  // Hydrate last cloud project after refresh (logged-in users only)
  useEffect(() => {
    if (authLoading || !user || hasHydratedCloudProjectRef.current) return;
    // Don't mark as hydrated until we've actually received the cloud fetch result.
    // cloudProjects starts as [] and stays [] until fetchCloudProjects resolves.
    if (cloudProjects.length === 0 && !cloudFetchedRef.current) return;

    if (cloudProjects.length === 0) {
      // User is logged in but truly has no cloud projects — nothing to hydrate
      hasHydratedCloudProjectRef.current = true;
      return;
    }

    const preferredId = getCloudCurrentProjectId();
    const preferred = preferredId ? cloudProjects.find((p) => p.id === preferredId) : null;
    const projectToLoad = preferred ?? cloudProjects[0];

    dispatch({ type: "LOAD_STATE", state: dataToState(projectToLoad.data) });
    setTransform(projectToLoad.data.transform ?? DEFAULT_TRANSFORM);
    setCurrentProjectIdState(projectToLoad.id);
    setCurrentProjectName(projectToLoad.name);
    setCloudCurrentProjectId(projectToLoad.id);

    hasHydratedCloudProjectRef.current = true;
  }, [authLoading, user, cloudProjects]);

  /** Save current project (or create new if none) */
  const saveProject = useCallback(async (nameOverride?: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const data = serializeCurrentData();

      if (currentProjectId) {
        const { error } = await supabase
          .from("track_planner_projects")
          .update({ name: nameOverride?.trim() || currentProjectName || "Nový plán", data })
          .eq("id", currentProjectId)
          .eq("user_id", user.id);

        if (error) throw error;
        if (nameOverride?.trim()) setCurrentProjectName(nameOverride.trim());
        setCloudCurrentProjectId(currentProjectId);
        await fetchCloudProjects();
        return true;
      }

      const insertName = nameOverride?.trim() || "Nový plán";
      const { data: inserted, error } = await supabase
        .from("track_planner_projects")
        .insert({ user_id: user.id, name: insertName, data })
        .select("id,name")
        .single();

      if (error || !inserted) throw error || new Error("insert_failed");

      setCurrentProjectIdState(inserted.id);
      setCurrentProjectName(inserted.name);
      setCloudCurrentProjectId(inserted.id);
      await fetchCloudProjects();
      return true;
    } catch (e) {
      console.error("Nepodařilo se uložit:", e);
      return false;
    }
  }, [user, currentProjectId, currentProjectName, serializeCurrentData, fetchCloudProjects]);

  /** Save As */
  const saveProjectAs = useCallback(async (name: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const data = serializeCurrentData();
      const trimmed = name.trim();
      if (!trimmed) return false;

      const { data: inserted, error } = await supabase
        .from("track_planner_projects")
        .insert({ user_id: user.id, name: trimmed, data })
        .select("id,name")
        .single();

      if (error || !inserted) throw error || new Error("insert_failed");

      setCurrentProjectIdState(inserted.id);
      setCurrentProjectName(inserted.name);
      setCloudCurrentProjectId(inserted.id);
      await fetchCloudProjects();
      return true;
    } catch (e) {
      console.error("Nepodařilo se uložit:", e);
      return false;
    }
  }, [user, serializeCurrentData, fetchCloudProjects]);

  /** Load a saved project */
  const loadProject = useCallback(async (projectId: string) => {
    if (!user) return false;

    const { data, error } = await supabase
      .from("track_planner_projects")
      .select("id,name,data")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) return false;

    const projectData = (data as { id: string; name: string; data: PersistedData }).data;
    dispatch({ type: "LOAD_STATE", state: dataToState(projectData) });
    setTransform(projectData.transform ?? DEFAULT_TRANSFORM);
    setCurrentProjectIdState(projectId);
    setCurrentProjectName((data as { name: string }).name);
    setCloudCurrentProjectId(projectId);
    return true;
  }, [user]);

  /** Delete a saved project */
  const deleteProject = useCallback(async (projectId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("track_planner_projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Nepodařilo se smazat projekt:", error.message);
      return;
    }

    if (currentProjectId === projectId) {
      setCurrentProjectIdState(null);
      setCurrentProjectName(null);
      setCloudCurrentProjectId(null);
    }
    await fetchCloudProjects();
  }, [user, currentProjectId, fetchCloudProjects]);

  /** New empty project */
  const newProject = useCallback(() => {
    dispatch({ type: "CLEAR_TRACKS" });
    setCurrentProjectIdState(null);
    setCurrentProjectName(null);
  }, []);

  /** List all saved projects */
  const listProjects = useCallback((): SavedProject[] => {
    return cloudProjects;
  }, [cloudProjects]);

  // Auto-save debounced (2s after last change) — only for logged-in users with active project
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || !currentProjectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const data = serializeCurrentData();
          const { error } = await supabase
            .from("track_planner_projects")
            .update({ data })
            .eq("id", currentProjectId)
            .eq("user_id", user.id);
          if (!error) await fetchCloudProjects();
        } catch {
          // ignore auto-save errors
        }
      })();
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [user, currentProjectId, serializeCurrentData, fetchCloudProjects]);

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
    (track: PlacedTrack): PlacedTrack & { _snapInfo?: { fromConnId: string; toInstanceId: string; toConnId: string } } => {
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
            _snapInfo: {
              fromConnId: conn.id,
              toInstanceId: target.instanceId,
              toConnId: target.connId,
            },
          };
        }
      }

      return track;
    },
    [catalogMap, freeConnections],
  );

  /** Snap a group of tracks: find the best snap for any track in the group against external free connections, return {dx,dz} offset + snap info */
  const snapGroupDrag = useCallback(
    (trackIds: string[]): { dx: number; dz: number; snap?: { fromInstanceId: string; fromConnId: string; toInstanceId: string; toConnId: string } } | null => {
      const groupSet = new Set(trackIds);
      const freeOthers = freeConnections.filter((f) => !groupSet.has(f.instanceId));
      if (freeOthers.length === 0) return null;

      let bestDist = 8; // max snap distance in mm
      let bestResult: { dx: number; dz: number; snap?: { fromInstanceId: string; fromConnId: string; toInstanceId: string; toConnId: string } } | null = null;

      for (const id of trackIds) {
        const track = state.tracks.find((t) => t.instanceId === id);
        if (!track) continue;
        const piece = catalogMap[track.pieceId];
        if (!piece) continue;

        for (const conn of piece.connections) {
          const connWorld = connectionToWorld(conn, track.position, track.rotation, track.flipZ);
          for (const target of freeOthers) {
            const dist = Math.hypot(connWorld.position.x - target.worldPos.x, connWorld.position.z - target.worldPos.z);
            if (dist >= bestDist) continue;

            const placement = computeSnapPlacement(target.worldPos, target.worldAngle, piece, conn.id, track.flipZ);
            if (!placement) continue;

            const dx = placement.position.x - track.position.x;
            const dz = placement.position.z - track.position.z;
            bestDist = dist;
            bestResult = {
              dx, dz,
              snap: { fromInstanceId: id, fromConnId: conn.id, toInstanceId: target.instanceId, toConnId: target.connId },
            };
          }
        }
      }

      return bestResult;
    },
    [catalogMap, freeConnections, state.tracks],
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

    // For turnouts we also rotate 180° so mirrored piece can be used in opposite running direction.
    // This keeps placement/snapping usable when turnout is "reversed" on non-parallel geometry.
    const updates: Partial<PlacedTrack> = { flipZ: !track.flipZ };
    if (piece.type === "turnout") {
      updates.rotation = track.rotation + Math.PI;
    }

    dispatch({ type: "UPDATE_TRACK", instanceId: track.instanceId, updates });
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

  // ── Portals (new system) ──
  const [portalMode, setPortalMode] = useState<{ kind: TerrainZoneKind; width: PortalWidth } | null>(null);
  const [portalFirstTrack, setPortalFirstTrack] = useState<TrackPoint | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [pairingPortalId, setPairingPortalId] = useState<string | null>(null);

  let portalIdCounter = useRef(0);
  const generatePortalId = useCallback(() => `portal-${Date.now()}-${portalIdCounter.current++}`, []);

  /** Start portal placement mode */
  const startPortalMode = useCallback((kind: TerrainZoneKind, width: PortalWidth) => {
    setPortalMode({ kind, width });
    setPortalFirstTrack(null);
    setPortalSecondTrack(null);
    endFirstTrackRef.current = null;
    setPairingPortalId(null);
    dispatch({ type: "SET_ACTIVE_PIECE", pieceId: null });
    dispatch({ type: "SELECT_TRACK", instanceId: null });
  }, []);

  const cancelPortalMode = useCallback(() => {
    setPortalMode(null);
    setPortalFirstTrack(null);
    setPortalSecondTrack(null);
    endFirstTrackRef.current = null;
    setPairingPortalId(null);
  }, []);

  // For double portal, we collect tracks for each end (start portal + end portal)
  const [portalSecondTrack, setPortalSecondTrack] = useState<TrackPoint | null>(null);
  // Step: 0 = first click, 1 = second click (for double: first track of start), 2 = third (double: second track of start or first of end), etc.
  // Simplified: single = 2 clicks (start + end), double = 4 clicks (2 tracks start + 2 tracks end)
  // But let's keep it simple like terrain: 2 clicks for single, and for double we ask 2 tracks per portal end

  /** Place portal — works like terrain zones: click start, click end
   *  Single: 1st click = start portal, 2nd click = end portal (auto-paired)
   *  Double: 1st click = start track1, 2nd = start track2 (creates start portal),
   *          3rd = end track1, 4th = end track2 (creates end portal, auto-paired)
   */
  const placePortalPoint = useCallback(
    (worldX: number, worldZ: number) => {
      if (!portalMode) return false;

      const hit = closestPointOnAnyTrack({ x: worldX, z: worldZ }, state.tracks, catalogMap);
      if (!hit || hit.distance > 15) return false;

      const point: TrackPoint = { trackId: hit.trackId, t: hit.t, worldX: hit.worldPos.x, worldZ: hit.worldPos.z };

      if (portalMode.width === "single") {
        if (!portalFirstTrack) {
          // 1st click — start portal position
          setPortalFirstTrack(point);
          return true;
        }
        // 2nd click — end portal position → create pair
        const startId = generatePortalId();
        const endId = generatePortalId();
        const startPortal: Portal = {
          id: startId,
          kind: portalMode.kind,
          width: "single",
          track1: portalFirstTrack,
          pairedPortalId: endId,
        };
        const endPortal: Portal = {
          id: endId,
          kind: portalMode.kind,
          width: "single",
          track1: point,
          pairedPortalId: startId,
        };
        dispatch({ type: "ADD_PORTAL", portal: startPortal });
        dispatch({ type: "ADD_PORTAL", portal: endPortal });
        // Auto-flag tracks between portals as bridge/tunnel
        const flag = portalMode.kind === "bridge"
          ? { isBridge: true, isTunnel: false }
          : { isTunnel: true, isBridge: false };
        const flaggedIds = new Set([portalFirstTrack.trackId, point.trackId]);
        // Also flag connected tracks between the two portal tracks
        const between = findTracksBetween(portalFirstTrack.trackId, point.trackId, state.tracks);
        for (const tid of between) flaggedIds.add(tid);
        for (const tid of flaggedIds) {
          dispatch({ type: "UPDATE_TRACK", instanceId: tid, updates: flag });
        }
        setPortalMode(null);
        setPortalFirstTrack(null);
        return true;
      }

      // Double portal — need 4 clicks total (2 for start, 2 for end)
      if (!portalFirstTrack) {
        // 1st click — first track of start portal
        setPortalFirstTrack(point);
        return true;
      }
      if (!portalSecondTrack) {
        // 2nd click — second track of start portal
        if (portalFirstTrack.trackId === point.trackId) return false; // must be different track
        setPortalSecondTrack(point);
        return true;
      }

      // We have start portal tracks, now collecting end portal
      // Check if we're on 3rd click (first track of end) or 4th (second track of end)
      // Use a ref to track the end's first track
      if (!endFirstTrackRef.current) {
        // 3rd click — first track of end portal
        endFirstTrackRef.current = point;
        return true;
      }

      // 4th click — second track of end portal
      if (endFirstTrackRef.current.trackId === point.trackId) return false;

      const endFirstTrack = endFirstTrackRef.current;
      const startId = generatePortalId();
      const endId = generatePortalId();
      const startPortal: Portal = {
        id: startId,
        kind: portalMode.kind,
        width: "double",
        track1: portalFirstTrack,
        track2: portalSecondTrack,
        pairedPortalId: endId,
      };
      const endPortal: Portal = {
        id: endId,
        kind: portalMode.kind,
        width: "double",
        track1: endFirstTrack,
        track2: point,
        pairedPortalId: startId,
      };
      dispatch({ type: "ADD_PORTAL", portal: startPortal });
      dispatch({ type: "ADD_PORTAL", portal: endPortal });

      // Auto-flag tracks between paired double portals as bridge/tunnel (for 3D rendering too)
      const flag = portalMode.kind === "bridge"
        ? { isBridge: true, isTunnel: false }
        : { isTunnel: true, isBridge: false };

      const flaggedIds = new Set<string>([
        portalFirstTrack.trackId,
        portalSecondTrack.trackId,
        endFirstTrack.trackId,
        point.trackId,
      ]);

      // Double portal pairing can be crossed (start1↔end2, start2↔end1).
      // Pick the mapping that yields valid/shorter connected paths.
      const directA = findTracksBetween(portalFirstTrack.trackId, endFirstTrack.trackId, state.tracks);
      const directB = findTracksBetween(portalSecondTrack.trackId, point.trackId, state.tracks);
      const crossA = findTracksBetween(portalFirstTrack.trackId, point.trackId, state.tracks);
      const crossB = findTracksBetween(portalSecondTrack.trackId, endFirstTrack.trackId, state.tracks);

      const directValid = directA.length > 0 && directB.length > 0;
      const crossValid = crossA.length > 0 && crossB.length > 0;

      const directCost = directValid ? directA.length + directB.length : Number.POSITIVE_INFINITY;
      const crossCost = crossValid ? crossA.length + crossB.length : Number.POSITIVE_INFINITY;

      const chosen = crossCost < directCost ? [crossA, crossB] : [directA, directB];
      for (const list of chosen) {
        for (const tid of list) flaggedIds.add(tid);
      }

      for (const tid of flaggedIds) {
        dispatch({ type: "UPDATE_TRACK", instanceId: tid, updates: flag });
      }

      setPortalMode(null);
      setPortalFirstTrack(null);
      setPortalSecondTrack(null);
      endFirstTrackRef.current = null;
      return true;
    },
    [portalMode, portalFirstTrack, portalSecondTrack, state.tracks, catalogMap, generatePortalId],
  );

  const endFirstTrackRef = useRef<TrackPoint | null>(null);

  /** Start pairing mode — click on another portal to pair */
  const startPairing = useCallback((portalId: string) => {
    setPairingPortalId(portalId);
    setPortalMode(null);
    setPortalFirstTrack(null);
  }, []);

  /** Complete pairing — click on second portal */
  const pairWithPortal = useCallback(
    (targetPortalId: string) => {
      if (!pairingPortalId || pairingPortalId === targetPortalId) return false;
      const source = state.portals.find((p) => p.id === pairingPortalId);
      const target = state.portals.find((p) => p.id === targetPortalId);
      if (!source || !target) return false;
      // Must be same kind (tunnel↔tunnel, bridge↔bridge)
      if (source.kind !== target.kind) return false;
      // Unpair existing pairs first
      if (source.pairedPortalId) dispatch({ type: "UNPAIR_PORTAL", portalId: source.id });
      if (target.pairedPortalId) dispatch({ type: "UNPAIR_PORTAL", portalId: target.id });
      dispatch({ type: "PAIR_PORTALS", portalId1: pairingPortalId, portalId2: targetPortalId });
      setPairingPortalId(null);
      return true;
    },
    [pairingPortalId, state.portals],
  );

  const removePortal = useCallback((portalId: string) => {
    dispatch({ type: "REMOVE_PORTAL", portalId });
    if (selectedPortalId === portalId) setSelectedPortalId(null);
    if (pairingPortalId === portalId) setPairingPortalId(null);
  }, [selectedPortalId, pairingPortalId]);

  /** Hit-test portals */
  const hitTestPortal = useCallback(
    (worldX: number, worldZ: number): string | null => {
      for (const portal of state.portals) {
        const p1 = portal.track1;
        if (p1.worldX !== undefined && Math.hypot(worldX - p1.worldX, worldZ - p1.worldZ!) < 20) return portal.id;
        if (portal.track2) {
          const p2 = portal.track2;
          if (p2.worldX !== undefined && Math.hypot(worldX - p2.worldX, worldZ - p2.worldZ!) < 20) return portal.id;
        }
      }
      return null;
    },
    [state.portals],
  );

  // ── Elevation points ──
  const [elevationMode, setElevationMode] = useState(false);

  const addElevationPoint = useCallback(
    (trackId: string, t: number, elevation: number) => {
      const point: ElevationPoint = {
        id: generateElevationPointId(),
        trackId,
        t,
        elevation,
      };
      dispatch({ type: "ADD_ELEVATION_POINT", point });
      return point.id;
    },
    [],
  );

  const removeElevationPoint = useCallback((pointId: string) => {
    dispatch({ type: "REMOVE_ELEVATION_POINT", pointId });
  }, []);

  const updateElevationPoint = useCallback((pointId: string, updates: Partial<Omit<ElevationPoint, "id">>) => {
    dispatch({ type: "UPDATE_ELEVATION_POINT", pointId, updates });
  }, []);

  const startElevationMode = useCallback(() => {
    setElevationMode(true);
    dispatch({ type: "SET_ACTIVE_PIECE", pieceId: null });
    dispatch({ type: "SELECT_TRACK", instanceId: null });
    setTerrainMode(null);
    setTerrainFirstPoint(null);
  }, []);

  const cancelElevationMode = useCallback(() => {
    setElevationMode(false);
  }, []);

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

  const toggleSelectedAlwaysOnTop = useCallback(() => {
    if (!state.selectedTrackId) return;
    const track = state.tracks.find((t) => t.instanceId === state.selectedTrackId);
    if (!track) return;
    const next = !track.alwaysOnTop;
    dispatch({
      type: "UPDATE_TRACK",
      instanceId: track.instanceId,
      updates: { alwaysOnTop: next, alwaysUnderTunnel: next ? false : track.alwaysUnderTunnel },
    });
  }, [state.selectedTrackId, state.tracks]);

  const toggleSelectedAlwaysUnderTunnel = useCallback(() => {
    if (!state.selectedTrackId) return;
    const track = state.tracks.find((t) => t.instanceId === state.selectedTrackId);
    if (!track) return;
    const next = !track.alwaysUnderTunnel;
    dispatch({
      type: "UPDATE_TRACK",
      instanceId: track.instanceId,
      updates: { alwaysUnderTunnel: next, alwaysOnTop: next ? false : track.alwaysOnTop },
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
    toggleSelectTrack,
    selectTracks,
    moveSelectedTracks,
    snapGroupDrag,
    unsnapTracks,
    snapConnection,
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
    toggleSelectedAlwaysOnTop,
    toggleSelectedAlwaysUnderTunnel,
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
    // Elevation
    elevationMode,
    addElevationPoint,
    removeElevationPoint,
    updateElevationPoint,
    startElevationMode,
    cancelElevationMode,
    // Portals (new)
    portalMode,
    portalFirstTrack,
    portalSecondTrack,
    portalEndFirstTrack: endFirstTrackRef.current,
    selectedPortalId,
    setSelectedPortalId,
    pairingPortalId,
    startPortalMode,
    cancelPortalMode,
    placePortalPoint,
    startPairing,
    pairWithPortal,
    removePortal,
    hitTestPortal,
  };
}
