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
// Sizes are exaggerated for visibility in 3D (mm units in a large scene)

const SLEEPER_SPACING_MM = 12; // distance between sleepers
const RAIL_WIDTH_MM = 1.5; // visual rail profile width (exaggerated from real 0.8mm)
const RAIL_HEIGHT_MM = 2; // rail profile height
const SLEEPER_THICKNESS_MM = 2.5; // sleeper height/thickness
const SLEEPER_WIDTH_MM = 4; // sleeper width along track direction
const SLEEPER_LENGTH_FACTOR = 2.2; // factor of gauge for sleeper length
const BALLAST_WIDTH_FACTOR = 3.0; // factor of gauge for ballast width
const BALLAST_HEIGHT_MM = 2;

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
    const railLeftPoints: THREE.Vector3[] = [];
    const railRightPoints: THREE.Vector3[] = [];
    const centerPoints: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }> = [];

    for (const seg of segments) {
      const pts = sampleSegmentWorld3D(seg, track, elevMap, 5);
      centerPoints.push(...pts);
    }

    // Build rail paths offset by half gauge perpendicular to tangent
    for (const pt of centerPoints) {
      // Perpendicular in xz plane (left = -tanZ, tanX)
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;

      railLeftPoints.push(new THREE.Vector3(
        pt.x + perpX * halfGauge,
        pt.y + BALLAST_HEIGHT_MM + SLEEPER_THICKNESS_MM + RAIL_HEIGHT_MM / 2,
        pt.z + perpZ * halfGauge,
      ));
      railRightPoints.push(new THREE.Vector3(
        pt.x - perpX * halfGauge,
        pt.y + BALLAST_HEIGHT_MM + SLEEPER_THICKNESS_MM + RAIL_HEIGHT_MM / 2,
        pt.z - perpZ * halfGauge,
      ));
    }

    return { railLeftPoints, railRightPoints, centerPoints };
  }, [track, piece, elevMap, halfGauge]);

  // Create rail geometry — extruded ribbon (more visible than thin tubes)
  const buildRailRibbon = (points: THREE.Vector3[]) => {
    if (points.length < 2) return null;
    const hw = RAIL_WIDTH_MM / 2;
    const hh = RAIL_HEIGHT_MM / 2;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      // For each point, create 4 vertices (top-left, top-right, bottom-left, bottom-right of rail cross-section)
      // Rail runs along the path; cross-section is in Y (up) direction
      vertices.push(p.x, p.y + hh, p.z); // top
      vertices.push(p.x, p.y - hh, p.z); // bottom

      if (i > 0) {
        const idx = i * 2;
        // Two triangles forming a quad between this point and previous
        indices.push(idx - 2, idx - 1, idx);
        indices.push(idx - 1, idx + 1, idx);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  };

  const railLeftGeom = useMemo(() => buildRailRibbon(geometry.railLeftPoints), [geometry.railLeftPoints]);
  const railRightGeom = useMemo(() => buildRailRibbon(geometry.railRightPoints), [geometry.railRightPoints]);

  // Ballast: a flat ribbon along the center
  const ballastGeom = useMemo(() => {
    const pts = geometry.centerPoints;
    if (pts.length < 2) return null;

    const ballastHalfWidth = halfGauge * BALLAST_WIDTH_FACTOR / 2;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;

      // Left vertex
      vertices.push(
        pt.x + perpX * ballastHalfWidth,
        pt.y,
        pt.z + perpZ * ballastHalfWidth,
      );
      // Right vertex
      vertices.push(
        pt.x - perpX * ballastHalfWidth,
        pt.y,
        pt.z - perpZ * ballastHalfWidth,
      );

      if (i > 0) {
        const idx = i * 2;
        indices.push(idx - 2, idx - 1, idx);
        indices.push(idx - 1, idx + 1, idx);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [geometry.centerPoints, halfGauge]);

  // Sleepers: small boxes at regular intervals along the path
  const sleeperInstances = useMemo(() => {
    const pts = geometry.centerPoints;
    if (pts.length < 2) return [];

    const totalLen = pts.reduce((acc, pt, i) => {
      if (i === 0) return 0;
      const prev = pts[i - 1];
      return acc + Math.hypot(pt.x - prev.x, pt.z - prev.z);
    }, 0);

    const sleeperCount = Math.max(2, Math.floor(totalLen / SLEEPER_SPACING_MM));
    const result: Array<{ position: [number, number, number]; rotation: number }> = [];

    let accumulated = 0;
    let nextSleeperDist = 0;
    let ptIdx = 1;

    for (let s = 0; s <= sleeperCount; s++) {
      const targetDist = (s / sleeperCount) * totalLen;

      while (ptIdx < pts.length && accumulated + Math.hypot(
        pts[ptIdx].x - pts[ptIdx - 1].x,
        pts[ptIdx].z - pts[ptIdx - 1].z,
      ) < targetDist) {
        accumulated += Math.hypot(
          pts[ptIdx].x - pts[ptIdx - 1].x,
          pts[ptIdx].z - pts[ptIdx - 1].z,
        );
        ptIdx++;
      }

      if (ptIdx >= pts.length) ptIdx = pts.length - 1;

      const pt = pts[ptIdx];
      const angle = Math.atan2(pt.tangentZ, pt.tangentX);

      result.push({
        position: [pt.x, pt.y + BALLAST_HEIGHT_MM + SLEEPER_THICKNESS_MM / 2, pt.z],
        rotation: angle,
      });
    }

    return result;
  }, [geometry.centerPoints]);

  const sleeperLength = gaugeMm * SLEEPER_LENGTH_FACTOR;

  return (
    <group>
      {/* Ballast */}
      {ballastGeom && (
        <mesh geometry={ballastGeom}>
          <meshStandardMaterial color="#9e9584" />
        </mesh>
      )}

      {/* Sleepers */}
      {sleeperInstances.map((sl, i) => (
        <mesh key={i} position={sl.position} rotation={[0, -sl.rotation + Math.PI / 2, 0]}>
          <boxGeometry args={[SLEEPER_WIDTH_MM, SLEEPER_THICKNESS_MM, sleeperLength]} />
          <meshStandardMaterial color="#6f4e37" />
        </mesh>
      ))}

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
