/**
 * Deterministic Track Layout Engine v2
 *
 * Supports multi-loop topologies: multiple interconnected loops
 * connected via turnout connections. Backward compatible with
 * the old mainLoop/branches format.
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
// Layout Definition Types (v2 — multi-loop)
// ============================================================

export interface LayoutSegment {
  pieceId: string;
  /** For turnouts: which branch continues the loop
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

/** A single loop (closed or open) of track segments */
export interface LayoutLoop {
  id: string; // "main", "inner", "outer", "station-track-1" etc.
  segments: LayoutSegment[];
  /** If true, this is a dead-end spur (not a closed loop) */
  isOpenEnded?: boolean;
}

/** Connection between two loops via turnout "c" port */
export interface LoopConnection {
  fromLoop: string;
  fromSegmentIndex: number;
  fromConnection: "c";
  toLoop: string;
  toSegmentIndex: number;
  toConnection: "a";
}

/** Legacy branch format (v1 compat) */
export interface LayoutBranch {
  sourceSegmentIndex: number;
  sourceConnection: "c";
  segments: LayoutSegment[];
}

export interface LayoutDefinition {
  // === v2 format ===
  /** Multiple loops */
  loops?: LayoutLoop[];
  /** Connections between loops */
  connections?: LoopConnection[];

  // === v1 format (backward compat) ===
  /** Main loop — must form a closed loop */
  mainLoop?: LayoutSegment[];
  /** Side branches from turnouts */
  branches?: LayoutBranch[];

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
  /** Distance between last track's exit and first track's entry (mm) — for primary loop */
  loopGapMm: number;
  /** Whether the primary loop closed within tolerance */
  loopClosed: boolean;
  /** Whether at least one closed loop exists (train can run continuously) */
  hasClosedLoop: boolean;
  /** Any warnings */
  warnings: string[];
  /** Description for debugging */
  debugInfo: string[];
}

// ============================================================
// Internal: Normalize v1 → v2 format
// ============================================================

function normalizeDefinition(def: LayoutDefinition): {
  loops: LayoutLoop[];
  connections: LoopConnection[];
  startRotation: number;
  startX?: number;
  startZ?: number;
} {
  // Already v2 format
  if (def.loops && def.loops.length > 0) {
    return {
      loops: def.loops,
      connections: def.connections || [],
      startRotation: def.startRotation || 0,
      startX: def.startX,
      startZ: def.startZ,
    };
  }

  // v1 format → convert
  if (!def.mainLoop || def.mainLoop.length === 0) {
    return { loops: [], connections: [], startRotation: 0 };
  }

  const loops: LayoutLoop[] = [{ id: "main", segments: def.mainLoop }];
  const connections: LoopConnection[] = [];

  if (def.branches) {
    for (let i = 0; i < def.branches.length; i++) {
      const br = def.branches[i];
      const loopId = `branch-${i}`;
      loops.push({ id: loopId, segments: br.segments, isOpenEnded: true });
      connections.push({
        fromLoop: "main",
        fromSegmentIndex: br.sourceSegmentIndex,
        fromConnection: "c",
        toLoop: loopId,
        toSegmentIndex: 0,
        toConnection: "a",
      });
    }
  }

  return {
    loops,
    connections,
    startRotation: def.startRotation || 0,
    startX: def.startX,
    startZ: def.startZ,
  };
}

// ============================================================
// Core Layout Engine (v2)
// ============================================================

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

  const norm = normalizeDefinition(definition);

  if (norm.loops.length === 0) {
    return {
      tracks: [],
      loopGapMm: Infinity,
      loopClosed: false,
      hasClosedLoop: false,
      warnings: ["No loops defined"],
      debugInfo,
    };
  }

  // --- Phase 1: Validate all piece IDs ---
  for (const loop of norm.loops) {
    for (let i = 0; i < loop.segments.length; i++) {
      const seg = loop.segments[i];
      const piece = getTrackPiece(seg.pieceId);
      if (!piece) {
        warnings.push(`${loop.id}[${i}]: unknown pieceId "${seg.pieceId}"`);
      } else if (piece.scale !== scale) {
        warnings.push(`${loop.id}[${i}]: piece "${seg.pieceId}" is ${piece.scale}, expected ${scale}`);
      }
    }
  }

  // --- Phase 2: Place loops ---
  // Map of loopId → placed tracks array
  const placedLoops = new Map<string, PlacedTrack[]>();
  // Track which loops have been placed
  const placedSet = new Set<string>();

  // Place first loop from origin
  const firstLoop = norm.loops[0];
  const startRad = (norm.startRotation * Math.PI) / 180;
  const firstTracks = placeSequence(
    firstLoop.segments,
    { x: 0, y: 0, z: 0 },
    startRad,
    firstLoop.id,
    0,
    debugInfo,
    warnings,
  );
  placedLoops.set(firstLoop.id, firstTracks);
  placedSet.add(firstLoop.id);
  allTracks.push(...firstTracks);

  // --- Phase 3: Place connected loops ---
  // Process connections — BFS style: as we place loops, check for more connections
  let changed = true;
  while (changed) {
    changed = false;
    for (const conn of norm.connections) {
      // Need source loop placed, target not yet placed
      if (!placedSet.has(conn.fromLoop) || placedSet.has(conn.toLoop)) continue;

      const srcTracks = placedLoops.get(conn.fromLoop)!;
      if (conn.fromSegmentIndex < 0 || conn.fromSegmentIndex >= srcTracks.length) {
        warnings.push(`connection ${conn.fromLoop}→${conn.toLoop}: fromSegmentIndex ${conn.fromSegmentIndex} out of range (0..${srcTracks.length - 1})`);
        continue;
      }

      const srcTrack = srcTracks[conn.fromSegmentIndex];
      const srcPiece = getTrackPiece(srcTrack.pieceId);
      if (!srcPiece) {
        warnings.push(`connection ${conn.fromLoop}→${conn.toLoop}: source piece unknown`);
        continue;
      }

      // Find the "c" connection on the source turnout
      const connC = srcPiece.connections.find((c) => c.id === conn.fromConnection);
      if (!connC) {
        warnings.push(`connection ${conn.fromLoop}→${conn.toLoop}: source piece "${srcTrack.pieceId}" has no connection "${conn.fromConnection}"`);
        continue;
      }

      const connCWorld = connectionToWorld(connC, srcTrack.position, srcTrack.rotation);

      // Find the target loop
      const targetLoop = norm.loops.find((l) => l.id === conn.toLoop);
      if (!targetLoop) {
        warnings.push(`connection ${conn.fromLoop}→${conn.toLoop}: target loop "${conn.toLoop}" not found`);
        continue;
      }

      // Place target loop so that segment[toSegmentIndex] connection "a" aligns
      // with the source's "c" world position.
      //
      // Strategy: place the full loop from origin, then compute offset/rotation
      // so that the target segment's "a" connection matches connCWorld.
      const targetTracks = placeSequenceWithAlignment(
        targetLoop.segments,
        conn.toSegmentIndex,
        conn.toConnection,
        connCWorld.position,
        connCWorld.angle,
        targetLoop.id,
        allTracks.length,
        debugInfo,
        warnings,
      );

      if (targetTracks.length > 0) {
        placedLoops.set(conn.toLoop, targetTracks);
        placedSet.add(conn.toLoop);
        allTracks.push(...targetTracks);

        // Set up snap connections
        const targetTrack = targetTracks[conn.toSegmentIndex];
        if (targetTrack) {
          srcTrack.snappedConnections[conn.fromConnection] = `${targetTrack.instanceId}:${conn.toConnection}`;
          targetTrack.snappedConnections[conn.toConnection] = `${srcTrack.instanceId}:${conn.fromConnection}`;
        }

        changed = true;
      }
    }
  }

  // Warn about unplaced loops
  for (const loop of norm.loops) {
    if (!placedSet.has(loop.id)) {
      warnings.push(`loop "${loop.id}" could not be placed (no connection to placed loops)`);
    }
  }

  // --- Phase 4: Check loop closure for each closed loop ---
  let primaryGap = Infinity;
  let primaryClosed = false;
  let anyLoopClosed = false;

  for (const loop of norm.loops) {
    if (loop.isOpenEnded) continue;
    const loopTracks = placedLoops.get(loop.id);
    if (!loopTracks || loopTracks.length === 0) continue;

    const gap = measureLoopGap(loopTracks, loop.segments);
    const closed = gap < 2.0;

    if (loop.id === firstLoop.id) {
      primaryGap = gap;
      primaryClosed = closed;
    }

    if (closed) anyLoopClosed = true;

    debugInfo.push(`Loop "${loop.id}": gap=${gap.toFixed(2)}mm (${closed ? "CLOSED" : "OPEN"}), tracks=${loopTracks.length}`);

    // Set up snap connections within loop
    if (closed) {
      setupLoopSnaps(loopTracks, loop.segments);
    } else {
      // Still set up sequential snaps for open loops
      setupSequentialSnaps(loopTracks, loop.segments);
    }
  }

  // Also set up snaps for open-ended loops
  for (const loop of norm.loops) {
    if (!loop.isOpenEnded) continue;
    const loopTracks = placedLoops.get(loop.id);
    if (!loopTracks || loopTracks.length === 0) continue;
    setupSequentialSnaps(loopTracks, loop.segments);
  }

  // --- Phase 5: Center on board ---
  centerOnBoard(allTracks, boardWmm, boardDmm, norm.startX, norm.startZ, debugInfo);

  // --- Phase 6: Validate traversability ---
  const hasClosedLoop = anyLoopClosed || validateClosedLoop(allTracks, primaryClosed);
  if (!hasClosedLoop) {
    warnings.push("WARN: No closed loop detected — train cannot run continuously!");
  }
  debugInfo.push(`Closed loop: ${hasClosedLoop ? "YES" : "NO"}`);

  return {
    tracks: allTracks,
    loopGapMm: primaryGap,
    loopClosed: primaryClosed,
    hasClosedLoop,
    warnings,
    debugInfo,
  };
}

// ============================================================
// Measure loop gap
// ============================================================

function measureLoopGap(tracks: PlacedTrack[], segments: LayoutSegment[]): number {
  if (tracks.length === 0) return Infinity;

  const lastTrack = tracks[tracks.length - 1];
  const lastPiece = getTrackPiece(lastTrack.pieceId);
  if (!lastPiece) return Infinity;

  // Find exit connection of last piece
  const lastSeg = segments[segments.length - 1];
  let exitConnId = "b";
  if (lastPiece.type === "turnout" && lastSeg?.branch === "diverge") {
    exitConnId = "c";
  }

  const exitConn = lastPiece.connections.find((c) => c.id === exitConnId);
  if (!exitConn) return Infinity;

  const exitWorld = connectionToWorld(exitConn, lastTrack.position, lastTrack.rotation);

  // First track's entry
  const firstTrack = tracks[0];
  const firstPiece = getTrackPiece(firstTrack.pieceId);
  if (!firstPiece) return Infinity;

  const entryConn = firstPiece.connections.find((c) => c.id === "a");
  if (!entryConn) return Infinity;

  const entryWorld = connectionToWorld(entryConn, firstTrack.position, firstTrack.rotation);

  const dx = exitWorld.position.x - entryWorld.position.x;
  const dz = exitWorld.position.z - entryWorld.position.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// ============================================================
// Set up snap connections
// ============================================================

function setupLoopSnaps(tracks: PlacedTrack[], segments: LayoutSegment[]): void {
  for (let i = 0; i < tracks.length; i++) {
    const curr = tracks[i];
    const next = tracks[(i + 1) % tracks.length];
    const currPiece = getTrackPiece(curr.pieceId);
    const currSeg = segments[i];

    let exitConnId = "b";
    if (currPiece?.type === "turnout" && currSeg?.branch === "diverge") {
      exitConnId = "c";
    }

    curr.snappedConnections[exitConnId] = `${next.instanceId}:a`;
    next.snappedConnections["a"] = `${curr.instanceId}:${exitConnId}`;
  }
}

function setupSequentialSnaps(tracks: PlacedTrack[], segments: LayoutSegment[]): void {
  for (let i = 0; i < tracks.length - 1; i++) {
    const curr = tracks[i];
    const next = tracks[i + 1];
    const currPiece = getTrackPiece(curr.pieceId);
    const currSeg = segments[i];

    let exitConnId = "b";
    if (currPiece?.type === "turnout" && currSeg?.branch === "diverge") {
      exitConnId = "c";
    }

    curr.snappedConnections[exitConnId] = `${next.instanceId}:a`;
    next.snappedConnections["a"] = `${curr.instanceId}:${exitConnId}`;
  }
}

// ============================================================
// Center layout on board
// ============================================================

function centerOnBoard(
  tracks: PlacedTrack[],
  boardWmm: number,
  boardDmm: number,
  explicitX: number | undefined,
  explicitZ: number | undefined,
  debugInfo: string[],
): void {
  if (tracks.length === 0) return;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const t of tracks) {
    const piece = getTrackPiece(t.pieceId);
    if (!piece) continue;
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

  let offsetX: number;
  let offsetZ: number;
  if (explicitX !== undefined && explicitZ !== undefined) {
    offsetX = explicitX;
    offsetZ = explicitZ;
  } else {
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    offsetX = boardWmm / 2 - centerX;
    offsetZ = boardDmm / 2 - centerZ;
  }

  for (const t of tracks) {
    t.position = {
      x: t.position.x + offsetX,
      y: t.position.y,
      z: t.position.z + offsetZ,
    };
  }
}

// ============================================================
// Traversability validation — find at least 1 closed loop via DFS
// ============================================================

function validateClosedLoop(tracks: PlacedTrack[], mainLoopClosed: boolean): boolean {
  if (mainLoopClosed) return true;

  const adj = new Map<string, string[]>();

  for (const track of tracks) {
    const piece = getTrackPiece(track.pieceId);
    if (!piece) continue;

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

    for (const [connId, targetStr] of Object.entries(track.snappedConnections)) {
      const nodeA = `${track.instanceId}:${connId}`;
      const nodeB = targetStr;
      if (!adj.has(nodeA)) adj.set(nodeA, []);
      if (!adj.has(nodeB)) adj.set(nodeB, []);
      adj.get(nodeA)!.push(nodeB);
      adj.get(nodeB)!.push(nodeA);
    }
  }

  const visited = new Set<string>();
  for (const startNode of adj.keys()) {
    if (visited.has(startNode)) continue;
    const stack: Array<{ node: string; parent: string | null }> = [{ node: startNode, parent: null }];
    const localVisited = new Set<string>();

    while (stack.length > 0) {
      const { node, parent } = stack.pop()!;
      if (localVisited.has(node)) return true;
      localVisited.add(node);
      visited.add(node);

      for (const neighbor of (adj.get(node) || [])) {
        if (neighbor === parent) continue;
        if (localVisited.has(neighbor)) return true;
        stack.push({ node: neighbor, parent: node });
      }
    }
  }

  return false;
}

// ============================================================
// Internal: Place a sequence of track pieces
// ============================================================

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

  let cursorX = startPos.x;
  let cursorZ = startPos.z;
  let cursorY = startPos.y;
  let cursorAngle = startRotation;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const piece = getTrackPiece(seg.pieceId);
    if (!piece) {
      warnings.push(`${label}[${i}]: skipping unknown piece "${seg.pieceId}"`);
      continue;
    }

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

    // Advance cursor to exit
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

// ============================================================
// Internal: Place sequence with alignment to a specific segment
// ============================================================

/**
 * Place a loop so that segment[alignIndex] connection alignConnId
 * aligns with the given world position and angle.
 *
 * Strategy:
 * 1. Place the full sequence from origin
 * 2. Find where segment[alignIndex] "a" ended up
 * 3. Compute transform to move it to target
 * 4. Apply transform to all tracks
 */
function placeSequenceWithAlignment(
  segments: LayoutSegment[],
  alignIndex: number,
  alignConnId: string,
  targetPos: Vec3,
  targetAngle: number,
  label: string,
  instanceOffset: number,
  debugInfo: string[],
  warnings: string[],
): PlacedTrack[] {
  // Place from origin first
  const rawTracks = placeSequence(
    segments,
    { x: 0, y: 0, z: 0 },
    0,
    label,
    instanceOffset,
    debugInfo,
    warnings,
  );

  if (rawTracks.length === 0 || alignIndex >= rawTracks.length) {
    if (alignIndex >= rawTracks.length) {
      warnings.push(`${label}: alignIndex ${alignIndex} >= track count ${rawTracks.length}`);
    }
    return rawTracks;
  }

  // Find where the target segment's "a" connection ended up
  const alignTrack = rawTracks[alignIndex];
  const alignPiece = getTrackPiece(alignTrack.pieceId);
  if (!alignPiece) return rawTracks;

  const alignConn = alignPiece.connections.find((c) => c.id === alignConnId);
  if (!alignConn) return rawTracks;

  const currentWorld = connectionToWorld(alignConn, alignTrack.position, alignTrack.rotation);

  // We need to transform all tracks so that currentWorld matches target
  // The target angle (outward from source "c") should meet the aligned "a" (outward).
  // They should face each other: aligned "a" world angle = targetAngle + PI
  const desiredAngle = targetAngle + Math.PI;
  const rotationDelta = desiredAngle - currentWorld.angle;

  // Apply rotation around origin first, then translate
  const cosR = Math.cos(rotationDelta);
  const sinR = Math.sin(rotationDelta);

  for (const t of rawTracks) {
    // Rotate position around origin
    const rx = t.position.x * cosR - t.position.z * sinR;
    const rz = t.position.x * sinR + t.position.z * cosR;
    t.position = {
      x: rx,
      y: t.position.y,
      z: rz,
    };
    t.rotation = t.rotation + rotationDelta;
  }

  // Now find where the aligned connection ended up after rotation
  const afterRotWorld = connectionToWorld(alignConn, rawTracks[alignIndex].position, rawTracks[alignIndex].rotation);

  // Translate so it matches target
  const dx = targetPos.x - afterRotWorld.position.x;
  const dz = targetPos.z - afterRotWorld.position.z;

  for (const t of rawTracks) {
    t.position = {
      x: t.position.x + dx,
      y: t.position.y,
      z: t.position.z + dz,
    };
  }

  return rawTracks;
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

  // Try v2 format first (loops + connections)
  if (Array.isArray(obj.loops)) {
    const loops: LayoutLoop[] = [];
    for (const item of obj.loops) {
      if (!item || typeof item !== "object") continue;
      const loopObj = item as Record<string, unknown>;
      if (typeof loopObj.id !== "string" || !Array.isArray(loopObj.segments)) continue;
      const segments = parseSegments(loopObj.segments);
      if (segments.length === 0) continue;
      loops.push({
        id: loopObj.id,
        segments,
        isOpenEnded: loopObj.isOpenEnded === true,
      });
    }

    if (loops.length === 0) return null;

    const connections: LoopConnection[] = [];
    if (Array.isArray(obj.connections)) {
      for (const item of obj.connections) {
        if (!item || typeof item !== "object") continue;
        const c = item as Record<string, unknown>;
        if (typeof c.fromLoop !== "string" || typeof c.toLoop !== "string") continue;
        connections.push({
          fromLoop: c.fromLoop,
          fromSegmentIndex: typeof c.fromSegmentIndex === "number" ? c.fromSegmentIndex : 0,
          fromConnection: "c",
          toLoop: c.toLoop,
          toSegmentIndex: typeof c.toSegmentIndex === "number" ? c.toSegmentIndex : 0,
          toConnection: "a",
        });
      }
    }

    return {
      loops,
      connections,
      startRotation: typeof obj.startRotation === "number" ? obj.startRotation : undefined,
    };
  }

  // v1 format (mainLoop + branches)
  if (!Array.isArray(obj.mainLoop)) return null;

  const mainLoop = parseSegments(obj.mainLoop);
  if (mainLoop.length === 0) return null;

  const branches: LayoutBranch[] = [];
  if (Array.isArray(obj.branches)) {
    for (const item of obj.branches) {
      if (!item || typeof item !== "object") continue;
      const br = item as Record<string, unknown>;
      if (typeof br.sourceSegmentIndex !== "number") continue;
      if (!Array.isArray(br.segments)) continue;
      const segs = parseSegments(br.segments);
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

function parseSegments(arr: unknown[]): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const seg = item as Record<string, unknown>;
    if (typeof seg.pieceId !== "string") continue;
    segments.push({
      pieceId: seg.pieceId,
      branch: seg.branch === "diverge" ? "diverge" : seg.branch === "straight" ? "straight" : undefined,
      isTunnel: seg.isTunnel === true,
      isBridge: seg.isBridge === true,
      isRamp: seg.isRamp === true,
      elevation: typeof seg.elevation === "number" ? seg.elevation : 0,
    });
  }
  return segments;
}
