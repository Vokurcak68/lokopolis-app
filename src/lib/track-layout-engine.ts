/**
 * Deterministic Track Layout Engine
 *
 * Takes a topology definition (sequence of piece IDs + branching info)
 * and computes exact world-space positions using geometry from track-library.
 *
 * AI generates ONLY the topology. This engine does ALL the math.
 */

import {
  type TrackScale,
  type TrackPieceDefinition,
  type Vec3,
  getTrackPiece,
  getCatalogByScale,
} from "./track-library";
import {
  type PlacedTrack,
  connectionToWorld,
  computeSnapPlacement,
} from "./track-designer-store";

// ============================================================
// Layout Definition Types
// ============================================================

export interface LayoutSegment {
  pieceId: string;
  /** For turnouts: which branch continues the main line
   *  "straight" = connection b (default), "diverge" = connection c */
  branch?: "straight" | "diverge";
  /** Mark as tunnel */
  isTunnel?: boolean;
  /** Mark as bridge */
  isBridge?: boolean;
  /** Mark as ramp (ascending/descending) */
  isRamp?: boolean;
  /** Elevation in mm */
  elevation?: number;
}

export interface LayoutBranch {
  /** Index of the turnout in mainLoop that this branch starts from */
  sourceSegmentIndex: number;
  /** Which connection of the turnout starts this branch (always "c") */
  sourceConnection: "c";
  /** Sequence of track pieces in this branch */
  segments: LayoutSegment[];
}

export interface LayoutDefinition {
  /** Main loop — must form a closed loop */
  mainLoop: LayoutSegment[];
  /** Side branches from turnouts */
  branches: LayoutBranch[];
  /** Starting position (in mm) — defaults to auto-center */
  startX?: number;
  startZ?: number;
  /** Starting rotation in degrees — defaults to 0 */
  startRotation?: number;
}

// ============================================================
// Computed Result Types
// ============================================================

export interface LayoutResult {
  tracks: PlacedTrack[];
  /** Distance between last track's exit and first track's entry (mm) */
  loopGapMm: number;
  /** Whether the loop closed within tolerance */
  loopClosed: boolean;
  /** Whether at least one closed loop exists (train can run continuously) */
  hasClosedLoop: boolean;
  /** Any warnings */
  warnings: string[];
  /** Description for debugging */
  debugInfo: string[];
}

// ============================================================
// Core Layout Engine
// ============================================================

/**
 * Compute exact positions for all tracks in a layout definition.
 *
 * @param definition - The topology (piece sequences + branches)
 * @param scale - Track scale (TT or H0)
 * @param boardWidth - Board width in cm
 * @param boardDepth - Board depth in cm
 * @returns LayoutResult with positioned tracks
 */
export function computeLayout(
  definition: LayoutDefinition,
  scale: TrackScale,
  boardWidth: number,
  boardDepth: number,
): LayoutResult {
  const warnings: string[] = [];
  const debugInfo: string[] = [];
  const allTracks: PlacedTrack[] = [];

  const boardWmm = boardWidth * 10;
  const boardDmm = boardDepth * 10;

  // --- Phase 1: Validate all piece IDs ---
  for (let i = 0; i < definition.mainLoop.length; i++) {
    const seg = definition.mainLoop[i];
    const piece = getTrackPiece(seg.pieceId);
    if (!piece) {
      warnings.push(`mainLoop[${i}]: unknown pieceId "${seg.pieceId}"`);
    } else if (piece.scale !== scale) {
      warnings.push(`mainLoop[${i}]: piece "${seg.pieceId}" is ${piece.scale}, expected ${scale}`);
    }
  }

  for (let bi = 0; bi < definition.branches.length; bi++) {
    const branch = definition.branches[bi];
    for (let si = 0; si < branch.segments.length; si++) {
      const seg = branch.segments[si];
      const piece = getTrackPiece(seg.pieceId);
      if (!piece) {
        warnings.push(`branch[${bi}].segments[${si}]: unknown pieceId "${seg.pieceId}"`);
      } else if (piece.scale !== scale) {
        warnings.push(`branch[${bi}].segments[${si}]: piece "${seg.pieceId}" is ${piece.scale}, expected ${scale}`);
      }
    }
  }

  // --- Phase 2: Place main loop ---
  // First pass: compute raw positions starting from origin
  const rawMainTracks = placeSequence(
    definition.mainLoop,
    { x: 0, y: 0, z: 0 },
    definition.startRotation ? (definition.startRotation * Math.PI) / 180 : 0,
    "main",
    0,
    debugInfo,
    warnings,
  );

  if (rawMainTracks.length === 0) {
    return {
      tracks: [],
      loopGapMm: Infinity,
      loopClosed: false,
      hasClosedLoop: false,
      warnings: [...warnings, "No valid tracks in mainLoop"],
      debugInfo,
    };
  }

  // --- Phase 3: Check loop closure ---
  const lastTrack = rawMainTracks[rawMainTracks.length - 1];
  const lastPiece = getTrackPiece(lastTrack.pieceId);
  let loopGapMm = Infinity;

  if (lastPiece) {
    // Find the exit connection of the last piece (connection "b" for most pieces)
    const exitConn = lastPiece.connections.find((c) => c.id === "b");
    if (exitConn) {
      const exitWorld = connectionToWorld(exitConn, lastTrack.position, lastTrack.rotation);
      // First track's entry point is its position (connection "a" is at origin)
      const firstTrack = rawMainTracks[0];
      const firstPiece = getTrackPiece(firstTrack.pieceId);
      if (firstPiece) {
        const entryConn = firstPiece.connections.find((c) => c.id === "a");
        if (entryConn) {
          const entryWorld = connectionToWorld(entryConn, firstTrack.position, firstTrack.rotation);
          const dx = exitWorld.position.x - entryWorld.position.x;
          const dz = exitWorld.position.z - entryWorld.position.z;
          loopGapMm = Math.sqrt(dx * dx + dz * dz);
        }
      }
    }
  }

  const loopClosed = loopGapMm < 2.0; // 2mm tolerance

  debugInfo.push(`Loop gap: ${loopGapMm.toFixed(2)}mm (${loopClosed ? "CLOSED" : "OPEN"})`);

  // --- Phase 4: Center on board ---
  // Find bounding box of all raw tracks
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const t of rawMainTracks) {
    const piece = getTrackPiece(t.pieceId);
    if (!piece) continue;
    // Check all connection points to find true bounds
    for (const conn of piece.connections) {
      const w = connectionToWorld(conn, t.position, t.rotation);
      minX = Math.min(minX, w.position.x);
      maxX = Math.max(maxX, w.position.x);
      minZ = Math.min(minZ, w.position.z);
      maxZ = Math.max(maxZ, w.position.z);
    }
  }

  const layoutW = maxX - minX;
  const layoutD = maxZ - minZ;
  debugInfo.push(`Layout bounds: ${layoutW.toFixed(1)}mm × ${layoutD.toFixed(1)}mm`);

  // Compute offset to center on board (or use explicit start position)
  let offsetX: number;
  let offsetZ: number;
  if (definition.startX !== undefined && definition.startZ !== undefined) {
    // Use explicit start — the raw tracks already start from origin,
    // so offset = explicit start
    offsetX = definition.startX;
    offsetZ = definition.startZ;
  } else {
    // Auto-center
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    offsetX = boardWmm / 2 - centerX;
    offsetZ = boardDmm / 2 - centerZ;
  }

  // Apply offset to all main tracks
  for (const t of rawMainTracks) {
    t.position = {
      x: t.position.x + offsetX,
      y: t.position.y,
      z: t.position.z + offsetZ,
    };
  }
  allTracks.push(...rawMainTracks);

  // --- Phase 5: Place branches ---
  for (let bi = 0; bi < definition.branches.length; bi++) {
    const branch = definition.branches[bi];
    const srcIdx = branch.sourceSegmentIndex;

    if (srcIdx < 0 || srcIdx >= rawMainTracks.length) {
      warnings.push(`branch[${bi}]: sourceSegmentIndex ${srcIdx} out of range`);
      continue;
    }

    const srcTrack = rawMainTracks[srcIdx];
    const srcPiece = getTrackPiece(srcTrack.pieceId);
    if (!srcPiece) {
      warnings.push(`branch[${bi}]: source track has unknown piece`);
      continue;
    }

    if (srcPiece.type !== "turnout") {
      warnings.push(`branch[${bi}]: source track "${srcTrack.pieceId}" is not a turnout`);
      continue;
    }

    // Find connection "c" on the turnout
    const connC = srcPiece.connections.find((c) => c.id === "c");
    if (!connC) {
      warnings.push(`branch[${bi}]: turnout "${srcTrack.pieceId}" has no connection "c"`);
      continue;
    }

    // Get world position of connection "c"
    const connCWorld = connectionToWorld(connC, srcTrack.position, srcTrack.rotation);

    // Place branch sequence starting from connection "c"
    // The first piece of the branch connects its "a" end to the turnout's "c"
    const branchTracks = placeSequenceFromConnection(
      branch.segments,
      connCWorld.position,
      connCWorld.angle,
      `branch-${bi}`,
      allTracks.length,
      debugInfo,
      warnings,
    );

    // Set up snap connections between turnout and first branch piece
    if (branchTracks.length > 0) {
      const firstBranch = branchTracks[0];
      srcTrack.snappedConnections["c"] = `${firstBranch.instanceId}:a`;
      firstBranch.snappedConnections["a"] = `${srcTrack.instanceId}:c`;
    }

    allTracks.push(...branchTracks);
  }

  // --- Phase 5b: Re-center including branches ---
  // Branches may extend beyond the main loop bounds, so recalculate
  {
    let allMinX = Infinity, allMaxX = -Infinity, allMinZ = Infinity, allMaxZ = -Infinity;
    for (const t of allTracks) {
      const piece = getTrackPiece(t.pieceId);
      if (!piece) continue;
      for (const conn of piece.connections) {
        const w = connectionToWorld(conn, t.position, t.rotation);
        allMinX = Math.min(allMinX, w.position.x);
        allMaxX = Math.max(allMaxX, w.position.x);
        allMinZ = Math.min(allMinZ, w.position.z);
        allMaxZ = Math.max(allMaxZ, w.position.z);
      }
    }
    const totalW = allMaxX - allMinX;
    const totalD = allMaxZ - allMinZ;
    const newCenterX = (allMinX + allMaxX) / 2;
    const newCenterZ = (allMinZ + allMaxZ) / 2;
    const targetCenterX = boardWmm / 2;
    const targetCenterZ = boardDmm / 2;
    const shiftX = targetCenterX - newCenterX;
    const shiftZ = targetCenterZ - newCenterZ;

    // Only shift if branches actually moved the center
    if (Math.abs(shiftX) > 0.1 || Math.abs(shiftZ) > 0.1) {
      for (const t of allTracks) {
        t.position = {
          x: t.position.x + shiftX,
          y: t.position.y,
          z: t.position.z + shiftZ,
        };
      }
      debugInfo.push(`Re-centered with branches: shift (${shiftX.toFixed(1)}, ${shiftZ.toFixed(1)})mm, total ${totalW.toFixed(0)}×${totalD.toFixed(0)}mm`);
    }
  }

  // --- Phase 6: Set up snap connections for main loop ---
  for (let i = 0; i < rawMainTracks.length; i++) {
    const curr = rawMainTracks[i];
    const next = rawMainTracks[(i + 1) % rawMainTracks.length];

    // Determine which connection the main line uses as exit
    const currPiece = getTrackPiece(curr.pieceId);
    const currSeg = definition.mainLoop[i];
    let exitConnId = "b"; // default
    if (currPiece?.type === "turnout" && currSeg?.branch === "diverge") {
      exitConnId = "c";
    }

    // Set snapped connections
    if (i < rawMainTracks.length - 1 || loopClosed) {
      curr.snappedConnections[exitConnId] = `${next.instanceId}:a`;
      next.snappedConnections["a"] = `${curr.instanceId}:${exitConnId}`;
    }
  }

  // --- Phase 7: Validate traversability (at least 1 closed loop) ---
  const hasClosedLoop = validateClosedLoop(allTracks, loopClosed);
  if (!hasClosedLoop) {
    warnings.push("WARN: No closed loop detected — train cannot run continuously!");
  }
  debugInfo.push(`Closed loop: ${hasClosedLoop ? "YES" : "NO"}`);

  return {
    tracks: allTracks,
    loopGapMm,
    loopClosed,
    hasClosedLoop,
    warnings,
    debugInfo,
  };
}

// ============================================================
// Traversability validation — find at least 1 closed loop via DFS
// ============================================================

/**
 * Check if there's at least one closed loop in the layout.
 * Uses snappedConnections graph to find cycles.
 */
function validateClosedLoop(tracks: PlacedTrack[], mainLoopClosed: boolean): boolean {
  // If main loop is closed, we already have a loop
  if (mainLoopClosed) return true;

  // Build adjacency graph from snappedConnections
  // Node = "instanceId:connId", edges connect snapped pairs
  const adj = new Map<string, string[]>();

  for (const track of tracks) {
    const piece = getTrackPiece(track.pieceId);
    if (!piece) continue;

    // Add edges for connections within the same piece (A↔B, A↔C for turnouts, etc.)
    const connIds = piece.connections.map(c => c.id);
    for (let i = 0; i < connIds.length; i++) {
      for (let j = i + 1; j < connIds.length; j++) {
        const nodeA = `${track.instanceId}:${connIds[i]}`;
        const nodeB = `${track.instanceId}:${connIds[j]}`;
        if (!adj.has(nodeA)) adj.set(nodeA, []);
        if (!adj.has(nodeB)) adj.set(nodeB, []);
        adj.get(nodeA)!.push(nodeB);
        adj.get(nodeB)!.push(nodeA);
      }
    }

    // Add edges for snapped connections (between different pieces)
    for (const [connId, targetStr] of Object.entries(track.snappedConnections)) {
      const nodeA = `${track.instanceId}:${connId}`;
      const nodeB = targetStr;
      if (!adj.has(nodeA)) adj.set(nodeA, []);
      if (!adj.has(nodeB)) adj.set(nodeB, []);
      adj.get(nodeA)!.push(nodeB);
      adj.get(nodeB)!.push(nodeA);
    }
  }

  // DFS to find any cycle
  const visited = new Set<string>();
  for (const startNode of adj.keys()) {
    if (visited.has(startNode)) continue;
    // BFS/DFS with parent tracking to detect back edges
    const stack: Array<{ node: string; parent: string | null }> = [{ node: startNode, parent: null }];
    const localVisited = new Set<string>();

    while (stack.length > 0) {
      const { node, parent } = stack.pop()!;
      if (localVisited.has(node)) {
        return true; // cycle found
      }
      localVisited.add(node);
      visited.add(node);

      for (const neighbor of (adj.get(node) || [])) {
        if (neighbor === parent) continue;
        if (localVisited.has(neighbor)) return true; // cycle found
        stack.push({ node: neighbor, parent: node });
      }
    }
  }

  return false;
}

// ============================================================
// Internal: Place a sequence of track pieces
// ============================================================

/**
 * Place a sequence starting from a given position and rotation.
 * The rotation is the DIRECTION of travel (not a connection angle).
 */
function placeSequence(
  segments: LayoutSegment[],
  startPos: Vec3,
  startRotation: number,
  label: string,
  instanceOffset: number,
  debugInfo: string[],
  warnings: string[],
): PlacedTrack[] {
  const tracks: PlacedTrack[] = [];

  // Current "cursor" — the world-space exit point of the previous piece
  // For the first piece, we treat this as the entry point (connection "a" faces backward)
  let cursorX = startPos.x;
  let cursorZ = startPos.z;
  let cursorY = startPos.y;
  // The cursor angle is the OUTWARD direction from the previous piece's exit connection.
  // For the first piece, we pretend there's a virtual connection pointing in startRotation direction.
  let cursorAngle = startRotation;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const piece = getTrackPiece(seg.pieceId);
    if (!piece) {
      warnings.push(`${label}[${i}]: skipping unknown piece "${seg.pieceId}"`);
      continue;
    }

    // We want to connect the new piece's "a" connection to the cursor.
    // The cursor represents the outward direction of the PREVIOUS piece's exit.
    // Connection "a" on the new piece faces OUTWARD from the piece (toward -X in local space).
    // To snap, the new piece's "a" world angle must face OPPOSITE to the cursor.
    const placement = computeSnapPlacement(
      { x: cursorX, y: cursorY, z: cursorZ },
      cursorAngle,
      piece,
      "a",
    );

    if (!placement) {
      warnings.push(`${label}[${i}]: could not compute placement for "${seg.pieceId}"`);
      continue;
    }

    const instanceId = `layout-${label}-${instanceOffset + tracks.length}`;
    const placedTrack: PlacedTrack = {
      instanceId,
      pieceId: seg.pieceId,
      position: placement.position,
      rotation: placement.rotation,
      elevation: seg.elevation ?? 0,
      snappedConnections: {},
      isRamp: seg.isRamp,
      isTunnel: seg.isTunnel,
      isBridge: seg.isBridge,
    };
    tracks.push(placedTrack);

    // Advance cursor to this piece's exit connection
    // For turnouts: main line continues through "b" (straight) or "c" (diverge)
    let exitConnId = "b";
    if (piece.type === "turnout" && seg.branch === "diverge") {
      exitConnId = "c";
    }

    const exitConn = piece.connections.find((c) => c.id === exitConnId);
    if (!exitConn) {
      warnings.push(`${label}[${i}]: piece "${seg.pieceId}" has no connection "${exitConnId}"`);
      break;
    }

    const exitWorld = connectionToWorld(exitConn, placement.position, placement.rotation);
    cursorX = exitWorld.position.x;
    cursorY = exitWorld.position.y;
    cursorZ = exitWorld.position.z;
    cursorAngle = exitWorld.angle;

    if (i === 0 || i === segments.length - 1) {
      debugInfo.push(
        `${label}[${i}] ${seg.pieceId}: pos=(${placement.position.x.toFixed(1)}, ${placement.position.z.toFixed(1)}) rot=${((placement.rotation * 180) / Math.PI).toFixed(1)}° → exit=(${cursorX.toFixed(1)}, ${cursorZ.toFixed(1)})`
      );
    }
  }

  return tracks;
}

/**
 * Place a sequence starting from a connection point (used for branches).
 * The connection angle is the OUTWARD angle of the source connection.
 */
function placeSequenceFromConnection(
  segments: LayoutSegment[],
  connPos: Vec3,
  connAngle: number,
  label: string,
  instanceOffset: number,
  debugInfo: string[],
  warnings: string[],
): PlacedTrack[] {
  // The connAngle is the outward angle of the source connection (e.g., turnout's "c").
  // The first piece's "a" should face opposite to this.
  // computeSnapPlacement already handles this correctly — it expects the target's outward angle.
  return placeSequence(
    segments,
    connPos,
    connAngle, // This is the outward angle — placeSequence's cursor will use it to snap "a"
    label,
    instanceOffset,
    debugInfo,
    warnings,
  );
}

// ============================================================
// Utility: Convert LayoutResult to the API response format
// ============================================================

export interface TrackAPIResponse {
  pieceId: string;
  x: number;
  z: number;
  rotation: number;
  elevation?: number;
  isRamp?: boolean;
  isTunnel?: boolean;
  isBridge?: boolean;
  connectedTo?: Record<string, string>;
}

export function layoutResultToAPIResponse(result: LayoutResult): TrackAPIResponse[] {
  return result.tracks.map((t) => ({
    pieceId: t.pieceId,
    x: t.position.x,
    z: t.position.z,
    rotation: t.rotation,
    elevation: t.elevation || undefined,
    isRamp: t.isRamp || undefined,
    isTunnel: t.isTunnel || undefined,
    isBridge: t.isBridge || undefined,
    connectedTo: Object.keys(t.snappedConnections).length > 0
      ? t.snappedConnections
      : undefined,
  }));
}

// ============================================================
// Utility: Parse AI response into LayoutDefinition
// ============================================================

export function parseAILayoutResponse(raw: unknown): LayoutDefinition | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;

  // Must have mainLoop array
  if (!Array.isArray(obj.mainLoop)) return null;

  const mainLoop: LayoutSegment[] = [];
  for (const item of obj.mainLoop) {
    if (!item || typeof item !== "object") continue;
    const seg = item as Record<string, unknown>;
    if (typeof seg.pieceId !== "string") continue;
    mainLoop.push({
      pieceId: seg.pieceId,
      branch: seg.branch === "diverge" ? "diverge" : seg.branch === "straight" ? "straight" : undefined,
      isTunnel: seg.isTunnel === true,
      isBridge: seg.isBridge === true,
      isRamp: seg.isRamp === true,
      elevation: typeof seg.elevation === "number" ? seg.elevation : 0,
    });
  }

  if (mainLoop.length === 0) return null;

  const branches: LayoutBranch[] = [];
  if (Array.isArray(obj.branches)) {
    for (const item of obj.branches) {
      if (!item || typeof item !== "object") continue;
      const br = item as Record<string, unknown>;
      if (typeof br.sourceSegmentIndex !== "number") continue;
      if (!Array.isArray(br.segments)) continue;

      const segs: LayoutSegment[] = [];
      for (const s of br.segments) {
        if (!s || typeof s !== "object") continue;
        const seg = s as Record<string, unknown>;
        if (typeof seg.pieceId !== "string") continue;
        segs.push({
          pieceId: seg.pieceId,
          branch: seg.branch === "diverge" ? "diverge" : seg.branch === "straight" ? "straight" : undefined,
          isTunnel: seg.isTunnel === true,
          isBridge: seg.isBridge === true,
          isRamp: seg.isRamp === true,
          elevation: typeof seg.elevation === "number" ? seg.elevation : 0,
        });
      }

      branches.push({
        sourceSegmentIndex: br.sourceSegmentIndex,
        sourceConnection: "c",
        segments: segs,
      });
    }
  }

  return {
    mainLoop,
    branches,
    startX: typeof obj.startX === "number" ? obj.startX : undefined,
    startZ: typeof obj.startZ === "number" ? obj.startZ : undefined,
    startRotation: typeof obj.startRotation === "number" ? obj.startRotation : undefined,
  };
}
