/**
 * Track Designer State — lightweight React-compatible store
 */

import type { TrackScale, TrackPieceDefinition, Vec3 } from "./track-library";

// ============================================================
// Types
// ============================================================

export interface PlacedTrack {
  /** Unique instance id */
  instanceId: string;
  /** Reference to catalog piece id */
  pieceId: string;
  /** World position (center of piece entry point A) */
  position: Vec3;
  /** Rotation in radians around Y axis */
  rotation: number;
  /** Height / elevation */
  elevation: number;
  /** Which connections are snapped (connectionId -> other instanceId:connectionId) */
  snappedConnections: Record<string, string>;
  /** Is this a ramp piece */
  isRamp?: boolean;
  /** Is this a bridge */
  isBridge?: boolean;
  /** Is this inside a tunnel */
  isTunnel?: boolean;
  /** Force this track to render on top in 2D canvas */
  alwaysOnTop?: boolean;
  /** Force this track to stay under tunnel-style overlay in 2D canvas */
  alwaysUnderTunnel?: boolean;
  /** Mirror the piece in Z axis (flips curves/turnouts to other direction) */
  flipZ?: boolean;
}

/** An elevation control point on a track */
export interface ElevationPoint {
  id: string;
  /** Which placed track this point is on */
  trackId: string;
  /** 0..1 position along the track's primary path */
  t: number;
  /** Height in mm — can be negative (underground) */
  elevation: number;
}

/** A point on the track layout, referenced by track instance + parameter t (0..1 along piece) */
export interface TrackPoint {
  /** Track instance id */
  trackId: string;
  /** Parameter along the piece's primary path (0 = connection A end, 1 = connection B end) */
  t: number;
  /** Cached world position at time of placement (for accurate rendering) */
  worldX?: number;
  worldZ?: number;
}

export type TerrainZoneKind = "tunnel" | "bridge";
export type PortalWidth = "single" | "double";

/** A portal (entry/exit point for a tunnel or bridge) placed on one or two tracks */
export interface Portal {
  id: string;
  kind: TerrainZoneKind;
  width: PortalWidth;
  /** Primary track point (always present) */
  track1: TrackPoint;
  /** Secondary track point (only for double portals) */
  track2?: TrackPoint;
  /** Paired portal id (null = unpaired) */
  pairedPortalId: string | null;
}

/** Legacy terrain zone — kept for migration, new code uses Portal[] */
export interface TerrainZone {
  id: string;
  kind: TerrainZoneKind;
  /** First portal */
  start: TrackPoint;
  /** Second portal */
  end: TrackPoint;
}

export type BoardShape = "rectangle" | "l-shape" | "u-shape";
export type LCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface BoardConfig {
  /** Width in cm */
  width: number;
  /** Depth in cm */
  depth: number;
  scale: TrackScale;
  /** Board shape (default: "rectangle") */
  shape: BoardShape;
  /** L-shape: which corner has the arm */
  lCorner?: LCorner;
  /** L-shape: arm width in cm (same unit as width/depth) */
  lArmWidth?: number;
  /** L-shape: arm depth in cm (same unit as width/depth) */
  lArmDepth?: number;
  /** U-shape: arm depth in cm (same unit as width/depth) */
  uArmDepth?: number;
  /** U-shape: side arm width in cm (same unit as width/depth) */
  uArmWidth?: number;
}

interface DesignerSnapshot {
  board: BoardConfig;
  tracks: PlacedTrack[];
  terrainZones: TerrainZone[];
  portals: Portal[];
  elevationPoints: ElevationPoint[];
  selectedTrackId: string | null;
  /** Multi-select: array of selected track IDs */
  selectedTrackIds: string[];
  hoveredTrackId: string | null;
  activePieceId: string | null;
  aiGenerating: boolean;
  aiError: string | null;
}

export interface DesignerState extends DesignerSnapshot {
  historyPast: DesignerSnapshot[];
  historyFuture: DesignerSnapshot[];
}

export type DesignerAction =
  | { type: "SET_BOARD"; board: BoardConfig }
  | { type: "ADD_TRACK"; track: PlacedTrack }
  | { type: "REMOVE_TRACK"; instanceId: string }
  | { type: "UPDATE_TRACK"; instanceId: string; updates: Partial<PlacedTrack> }
  | { type: "SELECT_TRACK"; instanceId: string | null }
  | { type: "TOGGLE_SELECT_TRACK"; instanceId: string }
  | { type: "SELECT_TRACKS"; instanceIds: string[] }
  | { type: "MOVE_SELECTED_TRACKS"; dx: number; dz: number }
  | { type: "HOVER_TRACK"; instanceId: string | null }
  | { type: "SET_ACTIVE_PIECE"; pieceId: string | null }
  | { type: "SET_TRACKS"; tracks: PlacedTrack[] }
  | { type: "CLEAR_TRACKS" }
  | { type: "AI_START" }
  | { type: "AI_SUCCESS"; tracks: PlacedTrack[] }
  | { type: "AI_ERROR"; error: string }
  | { type: "SNAP_CONNECTION"; fromInstanceId: string; fromConnId: string; toInstanceId: string; toConnId: string }
  | { type: "UNSNAP_TRACKS"; instanceIds: string[] }
  | { type: "ADD_TERRAIN_ZONE"; zone: TerrainZone }
  | { type: "REMOVE_TERRAIN_ZONE"; zoneId: string }
  | { type: "ADD_PORTAL"; portal: Portal }
  | { type: "REMOVE_PORTAL"; portalId: string }
  | { type: "PAIR_PORTALS"; portalId1: string; portalId2: string }
  | { type: "UNPAIR_PORTAL"; portalId: string }
  | { type: "ADD_ELEVATION_POINT"; point: ElevationPoint }
  | { type: "REMOVE_ELEVATION_POINT"; pointId: string }
  | { type: "UPDATE_ELEVATION_POINT"; pointId: string; updates: Partial<Omit<ElevationPoint, "id">> }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "LOAD_STATE"; state: DesignerState };

// ============================================================
// Initial state
// ============================================================

export function createInitialState(): DesignerState {
  return {
    board: { width: 200, depth: 100, scale: "TT", shape: "rectangle" },
    tracks: [],
    terrainZones: [],
    portals: [],
    elevationPoints: [],
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

// ============================================================
// Reducer
// ============================================================

const HISTORY_LIMIT = 50;

function toSnapshot(state: DesignerState): DesignerSnapshot {
  return {
    board: state.board,
    tracks: state.tracks,
    terrainZones: state.terrainZones,
    portals: state.portals,
    elevationPoints: state.elevationPoints,
    selectedTrackId: state.selectedTrackId,
    selectedTrackIds: state.selectedTrackIds,
    hoveredTrackId: state.hoveredTrackId,
    activePieceId: state.activePieceId,
    aiGenerating: state.aiGenerating,
    aiError: state.aiError,
  };
}

function applySnapshot(state: DesignerState, snapshot: DesignerSnapshot): DesignerState {
  return {
    ...state,
    ...snapshot,
  };
}

function withPropagatedElevation(state: DesignerState): DesignerState {
  if (state.tracks.length === 0) return state;

  const byId = new Map(state.tracks.map((t) => [t.instanceId, t]));
  const neighbors = new Map<string, Set<string>>();
  for (const t of state.tracks) {
    if (!neighbors.has(t.instanceId)) neighbors.set(t.instanceId, new Set());
    for (const target of Object.values(t.snappedConnections)) {
      const [otherId] = target.split(":");
      if (!otherId || !byId.has(otherId)) continue;
      neighbors.get(t.instanceId)!.add(otherId);
      if (!neighbors.has(otherId)) neighbors.set(otherId, new Set());
      neighbors.get(otherId)!.add(t.instanceId);
    }
  }

  const solved = new Map<string, number>();
  for (const t of state.tracks) {
    const pts = state.elevationPoints.filter((p) => p.trackId === t.instanceId);
    if (pts.length > 0) {
      const avg = pts.reduce((sum, p) => sum + p.elevation, 0) / pts.length;
      solved.set(t.instanceId, avg);
    } else if (Math.abs(t.elevation) > 0.0001) {
      solved.set(t.instanceId, t.elevation);
    }
  }

  const queue = [...solved.keys()];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    const base = solved.get(id) ?? 0;
    for (const n of neighbors.get(id) ?? []) {
      if (!solved.has(n)) {
        solved.set(n, base);
        queue.push(n);
      }
    }
  }

  return {
    ...state,
    tracks: state.tracks.map((t) => ({ ...t, elevation: solved.get(t.instanceId) ?? 0 })),
  };
}

function pushHistory(state: DesignerState): DesignerState {
  const snap = toSnapshot(state);
  const nextPast = [...state.historyPast, snap];
  if (nextPast.length > HISTORY_LIMIT) {
    nextPast.splice(0, nextPast.length - HISTORY_LIMIT);
  }

  return {
    ...state,
    historyPast: nextPast,
    historyFuture: [],
  };
}

export function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case "UNDO": {
      const prev = state.historyPast[state.historyPast.length - 1];
      if (!prev) return state;
      const current = toSnapshot(state);
      return {
        ...applySnapshot(state, prev),
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [current, ...state.historyFuture].slice(0, HISTORY_LIMIT),
      };
    }

    case "REDO": {
      const next = state.historyFuture[0];
      if (!next) return state;
      const current = toSnapshot(state);
      const nextPast = [...state.historyPast, current].slice(-HISTORY_LIMIT);
      return {
        ...applySnapshot(state, next),
        historyPast: nextPast,
        historyFuture: state.historyFuture.slice(1),
      };
    }

    case "LOAD_STATE":
      return action.state;

    case "SET_BOARD": {
      const next = pushHistory(state);
      return { ...next, board: action.board };
    }

    case "ADD_TRACK": {
      const next = pushHistory(state);
      return withPropagatedElevation({ ...next, tracks: [...next.tracks, action.track] });
    }

    case "REMOVE_TRACK": {
      const next = pushHistory(state);
      return withPropagatedElevation({
        ...next,
        tracks: next.tracks
          .filter((t) => t.instanceId !== action.instanceId)
          .map((t) => ({
            ...t,
            snappedConnections: Object.fromEntries(
              Object.entries(t.snappedConnections).filter(([, v]) => !v.startsWith(action.instanceId + ":")),
            ),
          })),
        elevationPoints: next.elevationPoints.filter((p) => p.trackId !== action.instanceId),
        selectedTrackId: next.selectedTrackId === action.instanceId ? null : next.selectedTrackId,
      });
    }

    case "UPDATE_TRACK": {
      const next = pushHistory(state);
      return withPropagatedElevation({
        ...next,
        tracks: next.tracks.map((t) => (t.instanceId === action.instanceId ? { ...t, ...action.updates } : t)),
      });
    }

    case "SELECT_TRACK":
      return {
        ...state,
        selectedTrackId: action.instanceId,
        selectedTrackIds: action.instanceId ? [action.instanceId] : [],
      };

    case "TOGGLE_SELECT_TRACK": {
      const ids = state.selectedTrackIds;
      const has = ids.includes(action.instanceId);
      const next = has ? ids.filter((id) => id !== action.instanceId) : [...ids, action.instanceId];
      return {
        ...state,
        selectedTrackIds: next,
        selectedTrackId: next.length === 1 ? next[0] : next.length === 0 ? null : state.selectedTrackId,
      };
    }

    case "SELECT_TRACKS":
      return {
        ...state,
        selectedTrackIds: action.instanceIds,
        selectedTrackId: action.instanceIds.length === 1 ? action.instanceIds[0] : action.instanceIds.length === 0 ? null : state.selectedTrackId,
      };

    case "MOVE_SELECTED_TRACKS": {
      if (state.selectedTrackIds.length === 0) return state;
      const next = pushHistory(state);
      const movedIds = new Set(next.selectedTrackIds);
      return {
        ...next,
        tracks: next.tracks.map((t) =>
          movedIds.has(t.instanceId)
            ? { ...t, position: { ...t.position, x: t.position.x + action.dx, z: t.position.z + action.dz } }
            : t,
        ),
      };
    }

    case "HOVER_TRACK":
      return { ...state, hoveredTrackId: action.instanceId };

    case "SET_ACTIVE_PIECE":
      return { ...state, activePieceId: action.pieceId };

    case "SET_TRACKS": {
      const next = pushHistory(state);
      return { ...next, tracks: action.tracks };
    }

    case "CLEAR_TRACKS": {
      const next = pushHistory(state);
      return { ...next, tracks: [], terrainZones: [], portals: [], elevationPoints: [], selectedTrackId: null };
    }

    case "AI_START":
      return { ...state, aiGenerating: true, aiError: null };

    case "AI_SUCCESS": {
      const next = pushHistory(state);
      return { ...next, aiGenerating: false, tracks: action.tracks, aiError: null };
    }

    case "AI_ERROR":
      return { ...state, aiGenerating: false, aiError: action.error };

    case "ADD_TERRAIN_ZONE": {
      const next = pushHistory(state);
      return { ...next, terrainZones: [...next.terrainZones, action.zone] };
    }

    case "REMOVE_TERRAIN_ZONE": {
      const next = pushHistory(state);
      return { ...next, terrainZones: next.terrainZones.filter((z) => z.id !== action.zoneId) };
    }

    case "ADD_PORTAL": {
      const next = pushHistory(state);
      return { ...next, portals: [...next.portals, action.portal] };
    }

    case "REMOVE_PORTAL": {
      const next = pushHistory(state);
      const removing = next.portals.find((p) => p.id === action.portalId);
      let portals = next.portals.filter((p) => p.id !== action.portalId);
      if (removing?.pairedPortalId) {
        portals = portals.map((p) =>
          p.id === removing.pairedPortalId ? { ...p, pairedPortalId: null } : p,
        );
      }
      // Collect track IDs still referenced by remaining portals
      const portalTrackIds = new Set<string>();
      for (const p of portals) {
        portalTrackIds.add(p.track1.trackId);
        if (p.track2) portalTrackIds.add(p.track2.trackId);
      }
      // Clear isTunnel/isBridge on tracks that no longer have any portal
      const tracks = next.tracks.map((t) => {
        if ((t.isTunnel || t.isBridge) && !portalTrackIds.has(t.instanceId)) {
          return { ...t, isTunnel: false, isBridge: false };
        }
        return t;
      });
      return { ...next, portals, tracks };
    }

    case "PAIR_PORTALS": {
      const next = pushHistory(state);
      return {
        ...next,
        portals: next.portals.map((p) => {
          if (p.id === action.portalId1) return { ...p, pairedPortalId: action.portalId2 };
          if (p.id === action.portalId2) return { ...p, pairedPortalId: action.portalId1 };
          return p;
        }),
      };
    }

    case "UNPAIR_PORTAL": {
      const next = pushHistory(state);
      const portal = next.portals.find((p) => p.id === action.portalId);
      if (!portal?.pairedPortalId) return next;
      const partnerId = portal.pairedPortalId;
      return {
        ...next,
        portals: next.portals.map((p) => {
          if (p.id === action.portalId || p.id === partnerId) return { ...p, pairedPortalId: null };
          return p;
        }),
      };
    }

    case "ADD_ELEVATION_POINT": {
      const next = pushHistory(state);
      return withPropagatedElevation({ ...next, elevationPoints: [...next.elevationPoints, action.point] });
    }

    case "REMOVE_ELEVATION_POINT": {
      const next = pushHistory(state);
      return withPropagatedElevation({ ...next, elevationPoints: next.elevationPoints.filter((p) => p.id !== action.pointId) });
    }

    case "UPDATE_ELEVATION_POINT": {
      const next = pushHistory(state);
      return withPropagatedElevation({
        ...next,
        elevationPoints: next.elevationPoints.map((p) =>
          p.id === action.pointId ? { ...p, ...action.updates } : p,
        ),
      });
    }

    case "UNSNAP_TRACKS": {
      // Remove all snap connections involving the given tracks (both sides)
      const unsnapSet = new Set(action.instanceIds);
      const next = pushHistory(state);
      return withPropagatedElevation({
        ...next,
        tracks: next.tracks.map((t) => {
          if (unsnapSet.has(t.instanceId)) {
            // Clear all snaps on this track
            return { ...t, snappedConnections: {} };
          }
          // Remove references to unsnapped tracks from other tracks
          const filtered = Object.fromEntries(
            Object.entries(t.snappedConnections).filter(([, v]) => {
              const refId = v.split(":")[0];
              return !unsnapSet.has(refId);
            }),
          );
          if (Object.keys(filtered).length !== Object.keys(t.snappedConnections).length) {
            return { ...t, snappedConnections: filtered };
          }
          return t;
        }),
      });
    }

    case "SNAP_CONNECTION": {
      const next = pushHistory(state);
      const fromKey = `${action.toInstanceId}:${action.toConnId}`;
      const toKey = `${action.fromInstanceId}:${action.fromConnId}`;
      return withPropagatedElevation({
        ...next,
        tracks: next.tracks.map((t) => {
          if (t.instanceId === action.fromInstanceId) {
            return {
              ...t,
              snappedConnections: { ...t.snappedConnections, [action.fromConnId]: fromKey },
            };
          }
          if (t.instanceId === action.toInstanceId) {
            return {
              ...t,
              snappedConnections: { ...t.snappedConnections, [action.toConnId]: toKey },
            };
          }
          return t;
        }),
      });
    }

    default:
      return state;
  }
}

// ============================================================
// Helpers
// ============================================================

let _idCounter = 0;
export function generateInstanceId(): string {
  _idCounter++;
  return `track-${Date.now()}-${_idCounter}`;
}

export function generateZoneId(): string {
  _idCounter++;
  return `zone-${Date.now()}-${_idCounter}`;
}

export function generateElevationPointId(): string {
  _idCounter++;
  return `elev-${Date.now()}-${_idCounter}`;
}

/** Convert connection point from local to world space */
export function connectionToWorld(
  conn: { position: Vec3; angle: number },
  trackPos: Vec3,
  trackRotation: number,
  flipZ?: boolean,
): { position: Vec3; angle: number } {
  // If flipped, mirror Z coordinate and negate angle
  const localZ = flipZ ? -conn.position.z : conn.position.z;
  const localAngle = flipZ ? -conn.angle : conn.angle;
  const cos = Math.cos(trackRotation);
  const sin = Math.sin(trackRotation);
  return {
    position: {
      x: trackPos.x + conn.position.x * cos - localZ * sin,
      y: trackPos.y + conn.position.y,
      z: trackPos.z + conn.position.x * sin + localZ * cos,
    },
    angle: trackRotation + localAngle,
  };
}

/** Check if two world-space connection points can snap (facing each other, within tolerance) */
export function canSnap(
  a: { position: Vec3; angle: number },
  b: { position: Vec3; angle: number },
  toleranceMm: number = 2,
): boolean {
  const dx = a.position.x - b.position.x;
  const dz = a.position.z - b.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > toleranceMm) return false;

  // Angles should be opposite (facing each other)
  let angleDiff = Math.abs(a.angle - b.angle);
  // Normalize to [0, 2PI]
  angleDiff = angleDiff % (2 * Math.PI);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
  // Should be close to PI (opposite directions)
  return Math.abs(angleDiff - Math.PI) < 0.1; // ~5.7° tolerance
}

/** Find all unsnapped connection points in the layout */
export function findFreeConnections(
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
): Array<{ instanceId: string; connId: string; worldPos: Vec3; worldAngle: number }> {
  const free: Array<{ instanceId: string; connId: string; worldPos: Vec3; worldAngle: number }> = [];

  for (const track of tracks) {
    const piece = catalog[track.pieceId];
    if (!piece) continue;

    for (const conn of piece.connections) {
      if (!track.snappedConnections[conn.id]) {
        const world = connectionToWorld(conn, track.position, track.rotation, track.flipZ);
        free.push({
          instanceId: track.instanceId,
          connId: conn.id,
          worldPos: world.position,
          worldAngle: world.angle,
        });
      }
    }
  }

  return free;
}

/** Compute snap position: given a free connection to snap TO, compute the position/rotation
 * for a new piece so its connection `fromConnId` aligns with the target */
export function computeSnapPlacement(
  targetWorldPos: Vec3,
  targetWorldAngle: number,
  newPiece: TrackPieceDefinition,
  fromConnId: string,
  flipZ?: boolean,
): { position: Vec3; rotation: number } | null {
  const conn = newPiece.connections.find((c) => c.id === fromConnId);
  if (!conn) return null;

  // If flipped, mirror Z coordinate and negate angle
  const localZ = flipZ ? -conn.position.z : conn.position.z;
  const localAngle = flipZ ? -conn.angle : conn.angle;

  // The new piece's connection should face opposite to the target
  // targetWorldAngle points OUTWARD from target, new piece's connection also points OUTWARD
  // They should face each other: new_conn_world_angle = targetWorldAngle + PI
  const desiredConnWorldAngle = targetWorldAngle + Math.PI;
  // rotation + localAngle = desiredConnWorldAngle
  const rotation = desiredConnWorldAngle - localAngle;

  // Position: target world pos minus rotated conn local offset
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const position: Vec3 = {
    x: targetWorldPos.x - (conn.position.x * cos - localZ * sin),
    y: targetWorldPos.y - conn.position.y,
    z: targetWorldPos.z - (conn.position.x * sin + localZ * cos),
  };

  return { position, rotation };
}
