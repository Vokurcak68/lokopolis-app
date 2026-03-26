"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { PlacedTrack, BoardConfig, ElevationPoint, TerrainZone } from "@/lib/track-designer-store";
import type { TrackPieceDefinition } from "@/lib/track-library";
import { getPieceSegmentsLocal, pointAndTangentAt, localToWorld, getGaugeMm, getBoardPathMm, type PathSegment, type LocalPoint } from "@/lib/track-canvas-renderer";

// ── Types ──

interface TrackViewer3DProps {
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
  board: BoardConfig;
  elevationPoints: ElevationPoint[];
  terrainZones: TerrainZone[];
}

// ── Constants ──
// All dimensions in mm. Exaggerated for TT-scale 3D visibility.

const SLEEPER_SPACING_MM = 10; // distance between sleepers along track
const RAIL_WIDTH_MM = 1.2; // rail profile width (cross-section)
const RAIL_HEIGHT_MM = 1.5; // rail profile height
const SLEEPER_THICKNESS_MM = 1.2; // sleeper height (Y)
const SLEEPER_WIDTH_MM = 2; // sleeper extent along track direction
const SLEEPER_LENGTH_FACTOR = 1.8; // sleeper length = gauge * factor (perpendicular to track)
const BALLAST_WIDTH_FACTOR = 2.2; // ballast ribbon width = gauge * factor (wider than sleepers)
const BALLAST_HEIGHT_MM = 1.5; // ballast ribbon thickness

// ── Elevation graph solver ──
// Walks the connected track graph, finds elevation points, and computes
// the elevation at any (trackId, t) by interpolating along cumulative distance.

interface TrackLengthInfo {
  trackId: string;
  length: number; // mm
}

/**
 * Compute the length of a placed track's primary path in mm.
 */
function getTrackLengthMm(track: PlacedTrack, catalog: Record<string, TrackPieceDefinition>): number {
  const piece = catalog[track.pieceId];
  if (!piece) return 0;
  const segs = getPieceSegmentsLocal(piece);
  let total = 0;
  for (const seg of segs) {
    if (seg.kind === "line") {
      total += Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z);
    } else {
      total += seg.radius * Math.abs(seg.endAngle - seg.startAngle);
    }
  }
  // For multi-segment pieces (turnouts), use first segment as primary
  if (segs.length > 1 && (piece.type === "turnout" || piece.type === "crossing")) {
    const s = segs[0];
    if (s.kind === "line") return Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z);
    return s.radius * Math.abs(s.endAngle - s.startAngle);
  }
  return total || 1;
}

/**
 * Build a map: trackId → elevation (mm) for each track's start (t=0) and end (t=1).
 * Walks the graph of connected tracks starting from elevation points,
 * propagating elevation along cumulative distance.
 */
function buildElevationMap(
  tracks: PlacedTrack[],
  elevationPoints: ElevationPoint[],
  catalog: Record<string, TrackPieceDefinition>,
): Map<string, { startElev: number; endElev: number }> {
  const result = new Map<string, { startElev: number; endElev: number }>();
  if (elevationPoints.length === 0) return result;

  const trackMap = new Map(tracks.map((t) => [t.instanceId, t]));

  // Build adjacency: for each track, which tracks connect at t=0 (connection "a") and t=1 (connection "b")
  // snappedConnections: { connId: "otherInstanceId:otherConnId" }
  type Neighbor = { trackId: string; atMyEnd: "start" | "end"; atTheirEnd: "start" | "end" };
  const adjacency = new Map<string, Neighbor[]>();

  for (const track of tracks) {
    const neighbors: Neighbor[] = [];
    const piece = catalog[track.pieceId];
    if (!piece) continue;
    const connIds = piece.connections.map((c) => c.id);
    // "a" = t=0 end, "b" = t=1 end (for primary path)
    for (const [myConnId, snapVal] of Object.entries(track.snappedConnections)) {
      const [otherTrackId, otherConnId] = snapVal.split(":");
      const myEnd = myConnId === "a" ? "start" : "end";
      const otherPiece = catalog[trackMap.get(otherTrackId)?.pieceId ?? ""];
      const theirEnd = otherConnId === "a" ? "start" : "end";
      neighbors.push({ trackId: otherTrackId, atMyEnd: myEnd, atTheirEnd: theirEnd });
    }
    adjacency.set(track.instanceId, neighbors);
  }

  // Collect all elevation anchors: (trackId, t, elevation, distanceAlongTrack)
  type Anchor = { trackId: string; t: number; elevation: number; globalDist: number };

  // For each connected component that has elevation points, walk the graph
  // and assign elevations by interpolating between anchors along cumulative distance
  const visited = new Set<string>();

  // Walk from each elevation point's track, BFS to discover the connected component
  for (const ep of elevationPoints) {
    if (visited.has(ep.trackId)) continue;

    // BFS to find connected component
    const component: string[] = [];
    const queue = [ep.trackId];
    const seen = new Set<string>();
    seen.add(ep.trackId);
    while (queue.length > 0) {
      const tid = queue.shift()!;
      component.push(tid);
      visited.add(tid);
      for (const n of adjacency.get(tid) ?? []) {
        if (!seen.has(n.trackId)) {
          seen.add(n.trackId);
          queue.push(n.trackId);
        }
      }
    }

    // Build a linear chain through this component (simplified: BFS order with cumulative distance)
    // Find chain endpoints (tracks with only one connection in component)
    const inComponent = new Set(component);
    const componentNeighbors = (tid: string) =>
      (adjacency.get(tid) ?? []).filter((n) => inComponent.has(n.trackId));

    // Find a chain start: prefer track with 0 or 1 in-component neighbors
    let chainStart = component[0];
    for (const tid of component) {
      const cn = componentNeighbors(tid);
      if (cn.length <= 1) { chainStart = tid; break; }
    }

    // Walk chain from chainStart
    const chain: { trackId: string; cumDist: number; length: number; reversed: boolean }[] = [];
    const chainVisited = new Set<string>();
    let current = chainStart;
    let cumDist = 0;
    let prevEnd: "start" | "end" | null = null;

    while (current && !chainVisited.has(current)) {
      chainVisited.add(current);
      const track = trackMap.get(current);
      if (!track) break;
      const len = getTrackLengthMm(track, catalog);

      // Determine if this track is reversed in the chain
      // If we entered from the "end" side, the track runs backwards
      const neighbors = componentNeighbors(current);
      let enteredFrom: "start" | "end" = "start";
      if (prevEnd !== null) {
        // Find which neighbor connection leads back to previous track
        for (const n of adjacency.get(current) ?? []) {
          if (chainVisited.has(n.trackId) && n.trackId !== current) {
            enteredFrom = n.atMyEnd;
            break;
          }
        }
      }
      const reversed = enteredFrom === "end";

      chain.push({ trackId: current, cumDist, length: len, reversed });
      cumDist += len;

      // Find next unvisited neighbor
      let next: string | null = null;
      let nextEnd: "start" | "end" | null = null;
      for (const n of neighbors) {
        if (!chainVisited.has(n.trackId)) {
          next = n.trackId;
          nextEnd = n.atTheirEnd;
          break;
        }
      }
      prevEnd = nextEnd;
      current = next!;
    }

    // Now place elevation anchors on the chain
    const anchors: Anchor[] = [];
    for (const ep2 of elevationPoints) {
      const ci = chain.findIndex((c) => c.trackId === ep2.trackId);
      if (ci === -1) continue;
      const c = chain[ci];
      const effectiveT = c.reversed ? 1 - ep2.t : ep2.t;
      anchors.push({
        trackId: ep2.trackId,
        t: ep2.t,
        elevation: ep2.elevation,
        globalDist: c.cumDist + effectiveT * c.length,
      });
    }
    anchors.sort((a, b) => a.globalDist - b.globalDist);

    if (anchors.length === 0) continue;

    // For each track in chain, compute start and end elevation by interpolating
    for (const c of chain) {
      const startDist = c.cumDist;
      const endDist = c.cumDist + c.length;

      const startElev = interpolateElevation(startDist, anchors);
      const endElev = interpolateElevation(endDist, anchors);

      if (c.reversed) {
        result.set(c.trackId, { startElev: endElev, endElev: startElev });
      } else {
        result.set(c.trackId, { startElev, endElev });
      }
    }
  }

  return result;
}

/** Interpolate elevation at a given cumulative distance using sorted anchors */
function interpolateElevation(dist: number, anchors: { globalDist: number; elevation: number }[]): number {
  if (anchors.length === 0) return 0;
  if (anchors.length === 1) return anchors[0].elevation;
  if (dist <= anchors[0].globalDist) return anchors[0].elevation;
  if (dist >= anchors[anchors.length - 1].globalDist) return anchors[anchors.length - 1].elevation;

  for (let i = 0; i < anchors.length - 1; i++) {
    if (dist >= anchors[i].globalDist && dist <= anchors[i + 1].globalDist) {
      const range = anchors[i + 1].globalDist - anchors[i].globalDist;
      if (range < 0.001) return anchors[i].elevation;
      const frac = (dist - anchors[i].globalDist) / range;
      return anchors[i].elevation + frac * (anchors[i + 1].elevation - anchors[i].elevation);
    }
  }
  return anchors[anchors.length - 1].elevation;
}

/** Get elevation at (trackId, t) from the precomputed elevation map */
function getElevationFromMap(
  trackId: string,
  t: number,
  elevMap: Map<string, { startElev: number; endElev: number }>,
): number {
  const entry = elevMap.get(trackId);
  if (!entry) return 0;
  return entry.startElev + t * (entry.endElev - entry.startElev);
}

/** Sample a segment in world space with elevation from the graph-based map */
function sampleSegmentWorld3D(
  seg: PathSegment,
  track: PlacedTrack,
  elevMap: Map<string, { startElev: number; endElev: number }>,
  stepMm: number,
): Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }> {
  const len = seg.kind === "line"
    ? Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z)
    : seg.radius * Math.abs(seg.endAngle - seg.startAngle);
  const samples = Math.max(2, Math.ceil(len / Math.max(stepMm, 1)));
  const out: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }> = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const { point: local, tangent: localTan } = pointAndTangentAt(seg, t);
    const world = localToWorld(local, track);
    const worldTan = localToWorld(
      { x: local.x + localTan.x, z: local.z + localTan.z },
      track,
    );
    const tanX = worldTan.x - world.x;
    const tanZ = worldTan.z - world.z;
    const tanLen = Math.hypot(tanX, tanZ) || 1;

    const elev = getElevationFromMap(track.instanceId, t, elevMap);

    out.push({
      x: world.x,
      y: elev,
      z: world.z,
      tangentX: tanX / tanLen,
      tangentZ: tanZ / tanLen,
    });
  }

  return out;
}

// ── Board mesh ──

function BoardMesh({ board }: { board: BoardConfig }) {
  const geometry = useMemo(() => {
    const boardPath = getBoardPathMm(board);
    if (boardPath.length < 3) return null;

    // Use THREE.Shape for proper triangulation of concave polygons (L-shapes etc.)
    // Shape works in XY plane, so we map our x→X, z→Y
    const shape = new THREE.Shape();
    shape.moveTo(boardPath[0].x, boardPath[0].z);
    for (let i = 1; i < boardPath.length; i++) {
      shape.lineTo(boardPath[i].x, boardPath[i].z);
    }
    shape.closePath();

    const shapeGeom = new THREE.ShapeGeometry(shape);

    // ShapeGeometry outputs vertices in XY plane — remap to XZ plane (Y=0)
    const pos = shapeGeom.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // this is our Z
      pos.setXYZ(i, x, 0, y);
    }
    pos.needsUpdate = true;
    shapeGeom.computeVertexNormals();

    return shapeGeom;
  }, [board]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, -1, 0]} receiveShadow>
      <meshStandardMaterial color="#8b9a7b" side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Single track piece 3D ──

function TrackPiece3D({
  track,
  piece,
  elevMap,
}: {
  track: PlacedTrack;
  piece: TrackPieceDefinition;
  elevMap: Map<string, { startElev: number; endElev: number }>;
}) {
  const gaugeMm = getGaugeMm(piece.scale);
  const halfGauge = gaugeMm / 2;

  const geometry = useMemo(() => {
    const segments = getPieceSegmentsLocal(piece);
    const centerPoints: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }> = [];

    for (const seg of segments) {
      const pts = sampleSegmentWorld3D(seg, track, elevMap, 5);
      centerPoints.push(...pts);
    }

    return { centerPoints };
  }, [track, piece, elevMap]);

  // Create rail geometry — extruded rectangle profile along path
  // Each cross-section has 4 corners; quads between successive sections form the rail solid.
  const buildRailSolid = (
    centerPts: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }>,
    offsetX: number, // perpendicular offset from center (±halfGauge)
  ) => {
    if (centerPts.length < 2) return null;
    const hw = RAIL_WIDTH_MM / 2;
    const hh = RAIL_HEIGHT_MM / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const railY = BALLAST_HEIGHT_MM + SLEEPER_THICKNESS_MM;

    for (let i = 0; i < centerPts.length; i++) {
      const pt = centerPts[i];
      const perpX = -pt.tangentZ; // perpendicular in XZ plane
      const perpZ = pt.tangentX;

      // Rail center position (offset perpendicular to track)
      const cx = pt.x + perpX * offsetX;
      const cz = pt.z + perpZ * offsetX;
      const cy = pt.y + railY;

      // 4 corners of rail cross-section:
      // The rail profile is a rectangle in the plane perpendicular to the track tangent.
      // "width" is along perp direction, "height" is along Y.
      // 0: top-outer, 1: top-inner, 2: bottom-inner, 3: bottom-outer
      vertices.push(cx + perpX * hw, cy + hh, cz + perpZ * hw); // 0
      vertices.push(cx - perpX * hw, cy + hh, cz - perpZ * hw); // 1
      vertices.push(cx - perpX * hw, cy - hh, cz - perpZ * hw); // 2
      vertices.push(cx + perpX * hw, cy - hh, cz + perpZ * hw); // 3

      if (i > 0) {
        const c = i * 4; // current quad start
        const p = (i - 1) * 4; // previous quad start
        // 4 faces (quads = 2 tris each) connecting previous and current cross-sections
        // Top face
        indices.push(p + 0, p + 1, c + 1, p + 0, c + 1, c + 0);
        // Bottom face
        indices.push(p + 2, p + 3, c + 3, p + 2, c + 3, c + 2);
        // Outer face
        indices.push(p + 3, p + 0, c + 0, p + 3, c + 0, c + 3);
        // Inner face
        indices.push(p + 1, p + 2, c + 2, p + 1, c + 2, c + 1);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  };

  const railLeftGeom = useMemo(
    () => buildRailSolid(geometry.centerPoints, halfGauge),
    [geometry.centerPoints, halfGauge],
  );
  const railRightGeom = useMemo(
    () => buildRailSolid(geometry.centerPoints, -halfGauge),
    [geometry.centerPoints, halfGauge],
  );

  // Ballast: 3D trapezoidal ribbon along the center (top flat, sides sloped)
  const ballastGeom = useMemo(() => {
    const pts = geometry.centerPoints;
    if (pts.length < 2) return null;

    const topHalfW = halfGauge * BALLAST_WIDTH_FACTOR / 2;
    const botHalfW = topHalfW * 1.3; // wider at base
    const bh = BALLAST_HEIGHT_MM;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;
      const baseY = pt.y;

      // 4 vertices per cross-section: topLeft, topRight, bottomLeft, bottomRight
      vertices.push(pt.x + perpX * topHalfW, baseY + bh, pt.z + perpZ * topHalfW); // 0 topL
      vertices.push(pt.x - perpX * topHalfW, baseY + bh, pt.z - perpZ * topHalfW); // 1 topR
      vertices.push(pt.x - perpX * botHalfW, baseY,      pt.z - perpZ * botHalfW); // 2 botR
      vertices.push(pt.x + perpX * botHalfW, baseY,      pt.z + perpZ * botHalfW); // 3 botL

      if (i > 0) {
        const c = i * 4;
        const p = (i - 1) * 4;
        // Top face
        indices.push(p + 0, p + 1, c + 1, p + 0, c + 1, c + 0);
        // Right slope
        indices.push(p + 1, p + 2, c + 2, p + 1, c + 2, c + 1);
        // Bottom face
        indices.push(p + 2, p + 3, c + 3, p + 2, c + 3, c + 2);
        // Left slope
        indices.push(p + 3, p + 0, c + 0, p + 3, c + 0, c + 3);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [geometry.centerPoints, halfGauge]);

  // Sleepers: merged BufferGeometry — each sleeper is a box oriented perpendicular to track
  const sleeperLength = gaugeMm * SLEEPER_LENGTH_FACTOR;
  const sleeperGeom = useMemo(() => {
    const pts = geometry.centerPoints;
    if (pts.length < 2) return null;

    // Build cumulative distance array
    const cumDist: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      cumDist.push(cumDist[i - 1] + Math.hypot(
        pts[i].x - pts[i - 1].x,
        pts[i].z - pts[i - 1].z,
      ));
    }
    const totalLen = cumDist[cumDist.length - 1];
    if (totalLen < 1) return null;

    const sleeperCount = Math.max(2, Math.floor(totalLen / SLEEPER_SPACING_MM));
    const halfLen = sleeperLength / 2; // half sleeper length (perpendicular to track)
    const halfW = SLEEPER_WIDTH_MM / 2; // half sleeper width (along track)
    const hh = SLEEPER_THICKNESS_MM; // sleeper height

    const vertices: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= sleeperCount; s++) {
      const targetDist = (s / sleeperCount) * totalLen;

      // Find segment
      let segIdx = 1;
      while (segIdx < cumDist.length - 1 && cumDist[segIdx] < targetDist) segIdx++;

      const segStart = cumDist[segIdx - 1];
      const segEnd = cumDist[segIdx];
      const segLen = segEnd - segStart;
      const t = segLen > 0 ? (targetDist - segStart) / segLen : 0;

      const p0 = pts[segIdx - 1];
      const p1 = pts[segIdx];

      const cx = p0.x + t * (p1.x - p0.x);
      const cy = p0.y + t * (p1.y - p0.y) + BALLAST_HEIGHT_MM;
      const cz = p0.z + t * (p1.z - p0.z);

      // Tangent direction (along track)
      const tx = p1.tangentX;
      const tz = p1.tangentZ;
      // Perpendicular direction (across track — this is the sleeper's long axis)
      const px = -tz;
      const pz = tx;

      // 8 corners of the sleeper box
      // Along track: ±halfW * tangent
      // Across track: ±halfLen * perp
      // Height: cy to cy+hh
      const base = s * 8;
      for (let dy = 0; dy <= 1; dy++) {
        const y = cy + dy * hh;
        // 4 corners at this height
        vertices.push(cx + tx * halfW + px * halfLen, y, cz + tz * halfW + pz * halfLen); // +along +perp
        vertices.push(cx + tx * halfW - px * halfLen, y, cz + tz * halfW - pz * halfLen); // +along -perp
        vertices.push(cx - tx * halfW - px * halfLen, y, cz - tz * halfW - pz * halfLen); // -along -perp
        vertices.push(cx - tx * halfW + px * halfLen, y, cz - tz * halfW + pz * halfLen); // -along +perp
      }

      // Bottom: 0,1,2,3  Top: 4,5,6,7
      const b = base;
      // Top face
      indices.push(b+4, b+5, b+6, b+4, b+6, b+7);
      // Bottom face
      indices.push(b+2, b+1, b+0, b+3, b+2, b+0);
      // Front (+along)
      indices.push(b+0, b+1, b+5, b+0, b+5, b+4);
      // Back (-along)
      indices.push(b+2, b+3, b+7, b+2, b+7, b+6);
      // Left (+perp)
      indices.push(b+3, b+0, b+4, b+3, b+4, b+7);
      // Right (-perp)
      indices.push(b+1, b+2, b+6, b+1, b+6, b+5);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [geometry.centerPoints, sleeperLength, gaugeMm]);

  return (
    <group>
      {/* Ballast */}
      {ballastGeom && (
        <mesh geometry={ballastGeom}>
          <meshStandardMaterial color="#9e9584" />
        </mesh>
      )}

      {/* Sleepers */}
      {sleeperGeom && (
        <mesh geometry={sleeperGeom}>
          <meshStandardMaterial color="#6f4e37" />
        </mesh>
      )}

      {/* Rails */}
      {railLeftGeom && (
        <mesh geometry={railLeftGeom}>
          <meshStandardMaterial color="#b0b0b0" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
      {railRightGeom && (
        <mesh geometry={railRightGeom}>
          <meshStandardMaterial color="#b0b0b0" metalness={0.7} roughness={0.3} />
        </mesh>
      )}

      {/* Bridge supports */}
      {track.isBridge && (
        <BridgeSupports
          centerPoints={geometry.centerPoints}
          gaugeMm={gaugeMm}
        />
      )}

      {/* Tunnel hill */}
      {track.isTunnel && (
        <TunnelHill
          centerPoints={geometry.centerPoints}
          gaugeMm={gaugeMm}
        />
      )}
    </group>
  );
}

// ── Bridge supports ──

function BridgeSupports({
  centerPoints,
  gaugeMm,
}: {
  centerPoints: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }>;
  gaugeMm: number;
}) {
  const pillars = useMemo(() => {
    if (centerPoints.length < 2) return [];
    const result: Array<{ x: number; y: number; z: number; height: number }> = [];
    const totalLen = centerPoints.reduce((acc, pt, i) => {
      if (i === 0) return 0;
      const prev = centerPoints[i - 1];
      return acc + Math.hypot(pt.x - prev.x, pt.z - prev.z);
    }, 0);

    // Place pillars every ~40mm
    const spacing = 40;
    const count = Math.max(2, Math.floor(totalLen / spacing));
    const step = Math.floor(centerPoints.length / count);

    for (let i = 0; i < centerPoints.length; i += Math.max(1, step)) {
      const pt = centerPoints[i];
      if (pt.y > 0.5) {
        result.push({ x: pt.x, y: 0, z: pt.z, height: pt.y });
      }
    }
    return result;
  }, [centerPoints]);

  const pillarWidth = gaugeMm * 0.6;

  return (
    <group>
      {pillars.map((p, i) => (
        <mesh key={i} position={[p.x, p.height / 2, p.z]}>
          <boxGeometry args={[pillarWidth, p.height, pillarWidth]} />
          <meshStandardMaterial color="#7a7a7a" />
        </mesh>
      ))}
    </group>
  );
}

// ── Tunnel hill ──

function TunnelHill({
  centerPoints,
  gaugeMm,
}: {
  centerPoints: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }>;
  gaugeMm: number;
}) {
  const hillGeom = useMemo(() => {
    if (centerPoints.length < 2) return null;

    const hillRadius = gaugeMm * 3;
    const hillHeight = gaugeMm * 4;
    const vertices: number[] = [];
    const indices: number[] = [];
    const segments = 8; // around the hill cross-section

    for (let i = 0; i < centerPoints.length; i++) {
      const pt = centerPoints[i];
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;

      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI; // 0 to PI (half circle)
        const dx = Math.cos(angle) * hillRadius;
        const dy = Math.sin(angle) * hillHeight;

        vertices.push(
          pt.x + perpX * dx,
          pt.y + BALLAST_HEIGHT_MM + dy,
          pt.z + perpZ * dx,
        );
      }

      if (i > 0) {
        const rowLen = segments + 1;
        for (let j = 0; j < segments; j++) {
          const a = (i - 1) * rowLen + j;
          const b = a + 1;
          const c = i * rowLen + j;
          const d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [centerPoints, gaugeMm]);

  if (!hillGeom) return null;

  return (
    <mesh geometry={hillGeom}>
      <meshStandardMaterial
        color="#5a7a4a"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Elevation point markers ──

function ElevationMarkers({ elevationPoints, tracks, catalog }: {
  elevationPoints: ElevationPoint[];
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
}) {
  const markers = useMemo(() => {
    return elevationPoints.map((ep) => {
      const track = tracks.find((t) => t.instanceId === ep.trackId);
      if (!track) return null;
      const piece = catalog[track.pieceId];
      if (!piece) return null;

      const segments = getPieceSegmentsLocal(piece);
      if (segments.length === 0) return null;

      // Use first segment for simplicity (works for most tracks)
      const seg = segments[0];
      const { point: local } = pointAndTangentAt(seg, ep.t);
      const world = localToWorld(local, track);

      return {
        id: ep.id,
        x: world.x,
        y: ep.elevation,
        z: world.z,
        elevation: ep.elevation,
      };
    }).filter(Boolean) as Array<{ id: string; x: number; y: number; z: number; elevation: number }>;
  }, [elevationPoints, tracks, catalog]);

  return (
    <group>
      {markers.map((m) => {
        const color = m.elevation === 0 ? "#22c55e" : m.elevation > 0 ? "#3b82f6" : "#ef4444";
        return (
          <group key={m.id} position={[m.x, m.y, m.z]}>
            {/* Vertical pole */}
            <mesh position={[0, m.elevation > 0 ? -m.elevation / 2 : -m.elevation / 2, 0]}>
              <cylinderGeometry args={[0.3, 0.3, Math.abs(m.elevation) || 2, 6]} />
              <meshStandardMaterial color={color} opacity={0.5} transparent />
            </mesh>
            {/* Sphere marker */}
            <mesh>
              <sphereGeometry args={[2, 8, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Debug center line for each track ──

function TrackCenterLine({
  track,
  piece,
  elevMap,
}: {
  track: PlacedTrack;
  piece: TrackPieceDefinition;
  elevMap: Map<string, { startElev: number; endElev: number }>;
}) {
  const points = useMemo(() => {
    const segments = getPieceSegmentsLocal(piece);
    const pts: [number, number, number][] = [];
    for (const seg of segments) {
      const sampled = sampleSegmentWorld3D(seg, track, elevMap, 5);
      for (const pt of sampled) {
        pts.push([pt.x, pt.y + 5, pt.z]);
      }
    }
    return pts;
  }, [track, piece, elevMap]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color="#ff4444"
      lineWidth={3}
    />
  );
}

// ── Camera auto-fit ──

function CameraSetup({ board }: { board: BoardConfig }) {
  const widthMm = board.width * 10;
  const depthMm = board.depth * 10;

  return (
    <OrbitControls
      target={[widthMm / 2, 0, depthMm / 2]}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={50}
      maxDistance={widthMm * 3}
    />
  );
}

// ── Main scene ──

function Scene({ tracks, catalog, board, elevationPoints }: TrackViewer3DProps) {
  // Build elevation map once for the whole scene (graph-based propagation)
  const elevMap = useMemo(
    () => buildElevationMap(tracks, elevationPoints, catalog),
    [tracks, elevationPoints, catalog],
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[board.width * 5, board.width * 10, board.depth * 5]} intensity={0.8} castShadow />
      <directionalLight position={[-board.width * 5, board.width * 5, -board.depth * 5]} intensity={0.3} />

      {/* Board */}
      <BoardMesh board={board} />

      {/* Grid helper on board */}
      <gridHelper
        args={[Math.max(board.width, board.depth) * 10 * 2, Math.max(board.width, board.depth), "#999999", "#cccccc"]}
        position={[board.width * 5, -0.4, board.depth * 5]}
      />

      {/* Tracks */}
      {tracks.map((track) => {
        const piece = catalog[track.pieceId];
        if (!piece) return null;
        return (
          <TrackPiece3D
            key={track.instanceId}
            track={track}
            piece={piece}
            elevMap={elevMap}
          />
        );
      })}

      {/* Elevation markers */}
      <ElevationMarkers
        elevationPoints={elevationPoints}
        tracks={tracks}
        catalog={catalog}
      />

      {/* Camera controls */}
      <CameraSetup board={board} />
    </>
  );
}

// ── Exported component ──

export default function TrackViewer3D(props: TrackViewer3DProps) {
  const { board } = props;
  const widthMm = board.width * 10;
  const depthMm = board.depth * 10;

  return (
    <div className="h-full w-full" style={{ background: "#1a1a2e" }}>
      <Canvas
        camera={{
          position: [widthMm / 2, Math.max(widthMm, depthMm) * 0.8, depthMm * 1.5],
          fov: 50,
          near: 1,
          far: widthMm * 10,
        }}
        shadows
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
