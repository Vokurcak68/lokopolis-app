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
}

export interface DesignerState {
  board: BoardConfig;
  tracks: PlacedTrack[];
  selectedTrackId: string | null;
  hoveredTrackId: string | null;
  /** Currently selected catalog piece for placement */
  activePieceId: string | null;
  /** AI generation loading state */
  aiGenerating: boolean;
  /** AI generation error */
  aiError: string | null;
}

export type DesignerAction =
  | { type: "SET_BOARD"; board: BoardConfig }
  | { type: "ADD_TRACK"; track: PlacedTrack }
  | { type: "REMOVE_TRACK"; instanceId: string }
  | { type: "UPDATE_TRACK"; instanceId: string; updates: Partial<PlacedTrack> }
  | { type: "SELECT_TRACK"; instanceId: string | null }
  | { type: "HOVER_TRACK"; instanceId: string | null }
  | { type: "SET_ACTIVE_PIECE"; pieceId: string | null }
  | { type: "SET_TRACKS"; tracks: PlacedTrack[] }
  | { type: "CLEAR_TRACKS" }
  | { type: "AI_START" }
  | { type: "AI_SUCCESS"; tracks: PlacedTrack[] }
  | { type: "AI_ERROR"; error: string }
  | { type: "SNAP_CONNECTION"; fromInstanceId: string; fromConnId: string; toInstanceId: string; toConnId: string };

// ============================================================
// Initial state
// ============================================================

export function createInitialState(): DesignerState {
  return {
    board: { width: 200, depth: 100, scale: "TT", shape: "rectangle" },
    tracks: [],
    selectedTrackId: null,
    hoveredTrackId: null,
    activePieceId: null,
    aiGenerating: false,
    aiError: null,
  };
}

// ============================================================
// Reducer
// ============================================================

export function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case "SET_BOARD":
      return { ...state, board: action.board };

    case "ADD_TRACK":
      return { ...state, tracks: [...state.tracks, action.track] };

    case "REMOVE_TRACK":
      return {
        ...state,
        tracks: state.tracks
          .filter((t) => t.instanceId !== action.instanceId)
          .map((t) => ({
            ...t,
            snappedConnections: Object.fromEntries(
              Object.entries(t.snappedConnections).filter(
                ([, v]) => !v.startsWith(action.instanceId + ":")
              )
            ),
          })),
        selectedTrackId: state.selectedTrackId === action.instanceId ? null : state.selectedTrackId,
      };

    case "UPDATE_TRACK":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.instanceId === action.instanceId ? { ...t, ...action.updates } : t
        ),
      };

    case "SELECT_TRACK":
      return { ...state, selectedTrackId: action.instanceId };

    case "HOVER_TRACK":
      return { ...state, hoveredTrackId: action.instanceId };

    case "SET_ACTIVE_PIECE":
      return { ...state, activePieceId: action.pieceId };

    case "SET_TRACKS":
      return { ...state, tracks: action.tracks };

    case "CLEAR_TRACKS":
      return { ...state, tracks: [], selectedTrackId: null };

    case "AI_START":
      return { ...state, aiGenerating: true, aiError: null };

    case "AI_SUCCESS":
      return { ...state, aiGenerating: false, tracks: action.tracks, aiError: null };

    case "AI_ERROR":
      return { ...state, aiGenerating: false, aiError: action.error };

    case "SNAP_CONNECTION": {
      const fromKey = `${action.toInstanceId}:${action.toConnId}`;
      const toKey = `${action.fromInstanceId}:${action.fromConnId}`;
      return {
        ...state,
        tracks: state.tracks.map((t) => {
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

/** Convert connection point from local to world space */
export function connectionToWorld(
  conn: { position: Vec3; angle: number },
  trackPos: Vec3,
  trackRotation: number,
): { position: Vec3; angle: number } {
  const cos = Math.cos(trackRotation);
  const sin = Math.sin(trackRotation);
  return {
    position: {
      x: trackPos.x + conn.position.x * cos - conn.position.z * sin,
      y: trackPos.y + conn.position.y,
      z: trackPos.z + conn.position.x * sin + conn.position.z * cos,
    },
    angle: trackRotation + conn.angle,
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
        const world = connectionToWorld(conn, track.position, track.rotation);
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
): { position: Vec3; rotation: number } | null {
  const conn = newPiece.connections.find((c) => c.id === fromConnId);
  if (!conn) return null;

  // The new piece's connection should face opposite to the target
  // targetWorldAngle points OUTWARD from target, new piece's connection also points OUTWARD
  // They should face each other: new_conn_world_angle = targetWorldAngle + PI
  const desiredConnWorldAngle = targetWorldAngle + Math.PI;
  // rotation + conn.angle = desiredConnWorldAngle
  const rotation = desiredConnWorldAngle - conn.angle;

  // Position: target world pos minus rotated conn local offset
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const position: Vec3 = {
    x: targetWorldPos.x - (conn.position.x * cos - conn.position.z * sin),
    y: targetWorldPos.y - conn.position.y,
    z: targetWorldPos.z - (conn.position.x * sin + conn.position.z * cos),
  };

  return { position, rotation };
}
