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
  /** Mirror the piece in Z axis (flips curves/turnouts to other direction) */
  flipZ?: boolean;
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

/** A terrain zone (tunnel or bridge) defined by two portal points on the track */
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
  | { type: "ADD_TERRAIN_ZONE"; zone: TerrainZone }
  | { type: "REMOVE_TERRAIN_ZONE"; zoneId: string }
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
      return { ...next, tracks: [...next.tracks, action.track] };
    }

    case "REMOVE_TRACK": {
      const next = pushHistory(state);
      return {
        ...next,
        tracks: next.tracks
          .filter((t) => t.instanceId !== action.instanceId)
          .map((t) => ({
            ...t,
            snappedConnections: Object.fromEntries(
              Object.entries(t.snappedConnections).filter(([, v]) => !v.startsWith(action.instanceId + ":")),
            ),
          })),
        selectedTrackId: next.selectedTrackId === action.instanceId ? null : next.selectedTrackId,
      };
    }

    case "UPDATE_TRACK": {
      const next = pushHistory(state);
      return {
        ...next,
        tracks: next.tracks.map((t) => (t.instanceId === action.instanceId ? { ...t, ...action.updates } : t)),
      };
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
      return { ...next, tracks: [], terrainZones: [], selectedTrackId: null };
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

    case "SNAP_CONNECTION": {
      const next = pushHistory(state);
      const fromKey = `${action.toInstanceId}:${action.toConnId}`;
      const toKey = `${action.fromInstanceId}:${action.fromConnId}`;
      return {
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
      };
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
