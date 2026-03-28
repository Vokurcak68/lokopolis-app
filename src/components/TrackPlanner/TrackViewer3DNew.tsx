"use client";

import { useMemo, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
// All dimensions in mm

const SLEEPER_SPACING_MM = 5; // distance between sleepers along track
const RAIL_WIDTH_MM = 1.2; // rail profile width (cross-section)
const RAIL_HEIGHT_MM = 1.5; // rail profile height
const SLEEPER_THICKNESS_MM = 1.2; // sleeper height (Y)
const SLEEPER_WIDTH_MM = 2; // sleeper extent along track direction
const SLEEPER_LENGTH_FACTOR = 1.8; // sleeper length = gauge * factor (perpendicular to track)
const BALLAST_WIDTH_FACTOR = 1.97; // ballast width factor
const BALLAST_HEIGHT_MM = 1.5; // ballast ribbon thickness

// Visual tuning (new 3D)
const COLOR_BALLAST = "#7e6a50";
const COLOR_SLEEPER = "#5b4634";
const COLOR_RAIL = "#b9bec6";
const COLOR_BRIDGE = "#6f7786";
const COLOR_TUNNEL = "#5a6f4b";

// Terrain mesh v1
const TERRAIN_BASE_Y = -4;
const TERRAIN_OUTSIDE_Y = -10;
const TERRAIN_MIN_Y = -90;
const TERRAIN_MAX_Y = 140;
const TERRAIN_STEP_MM = 22;
const TRACK_INFLUENCE_RADIUS_MM = 75;
const TRACK_HARD_LOCK_RADIUS_MM = 18;
const ELEVATION_INFLUENCE_RADIUS_MM = 180;
const ZONE_INFLUENCE_RADIUS_MM = 130;
const TERRAIN_TUNNEL_RAISE_MM = 22;
const TERRAIN_BRIDGE_CUT_MM = 28;
const TERRAIN_SMOOTH_PASSES = 2;
const TERRAIN_SURFACE_COLOR = "#6f8f55";
const TERRAIN_SIDE_COLOR = "#5b7148";
const TERRAIN_OUTSIDE_COLOR = "#607a4c";

// Terrain v2 (SCARM-like local corridor patches)
const PATCH_BASE_Y = -2.1;
const PATCH_NORMAL_HALF_WIDTH_MM = 24;
const PATCH_TUNNEL_HALF_WIDTH_MM = 85;
const PATCH_BRIDGE_HALF_WIDTH_MM = 72;

// ── Elevation graph solver ──

interface TrackLengthInfo {
  trackId: string;
  length: number;
}

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
  if (segs.length > 1 && (piece.type === "turnout" || piece.type === "crossing")) {
    const s = segs[0];
    if (s.kind === "line") return Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z);
    return s.radius * Math.abs(s.endAngle - s.startAngle);
  }
  return total || 1;
}

function buildElevationMap(
  tracks: PlacedTrack[],
  elevationPoints: ElevationPoint[],
  catalog: Record<string, TrackPieceDefinition>,
): Map<string, { startElev: number; endElev: number }> {
  const result = new Map<string, { startElev: number; endElev: number }>();
  if (elevationPoints.length === 0) return result;

  const trackMap = new Map(tracks.map((t) => [t.instanceId, t]));

  type Neighbor = { trackId: string; atMyEnd: "start" | "end"; atTheirEnd: "start" | "end" };
  const adjacency = new Map<string, Neighbor[]>();

  for (const track of tracks) {
    const neighbors: Neighbor[] = [];
    const piece = catalog[track.pieceId];
    if (!piece) continue;
    for (const [myConnId, snapVal] of Object.entries(track.snappedConnections)) {
      const [otherTrackId, otherConnId] = snapVal.split(":");
      const myEnd: "start" | "end" = myConnId === "a" ? "start" : "end";
      const theirEnd: "start" | "end" = otherConnId === "a" ? "start" : "end";
      neighbors.push({ trackId: otherTrackId, atMyEnd: myEnd, atTheirEnd: theirEnd });
    }
    adjacency.set(track.instanceId, neighbors);
  }

  const visited = new Set<string>();

  for (const ep of elevationPoints) {
    if (visited.has(ep.trackId)) continue;

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

    const inComponent = new Set(component);
    const componentNeighbors = (tid: string) =>
      (adjacency.get(tid) ?? []).filter((n) => inComponent.has(n.trackId));

    const endpoints: string[] = [];
    for (const tid of component) {
      if (componentNeighbors(tid).length <= 1) endpoints.push(tid);
    }
    if (endpoints.length === 0) endpoints.push(ep.trackId);

    const chainVisited = new Set<string>();

    type ChainEntry = { trackId: string; cumDist: number; length: number; reversed: boolean };

    const walkChain = (startTid: string, entryEnd: "start" | "end" | null) => {
      const chain: ChainEntry[] = [];
      let current: string | null = startTid;
      let cumDist = 0;
      let prevEntryEnd = entryEnd;

      while (current && !chainVisited.has(current)) {
        chainVisited.add(current);
        const track = trackMap.get(current);
        if (!track) break;
        const len = getTrackLengthMm(track, catalog);

        let enteredFrom: "start" | "end" = "start";
        if (prevEntryEnd !== null) {
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

        const unvisitedNeighbors: Neighbor[] = componentNeighbors(current).filter(
          (n) => !chainVisited.has(n.trackId),
        );

        if (unvisitedNeighbors.length === 0) break;

        const mainNext = unvisitedNeighbors[0];
        prevEntryEnd = mainNext.atTheirEnd;

        for (let i = 1; i < unvisitedNeighbors.length; i++) {
          const branch = unvisitedNeighbors[i];
          walkChain(branch.trackId, branch.atTheirEnd);
        }

        current = mainNext.trackId;
      }

      if (chain.length === 0) return;

      type Anchor = { globalDist: number; elevation: number };
      const anchors: Anchor[] = [];
      for (const ep2 of elevationPoints) {
        const ci = chain.findIndex((c) => c.trackId === ep2.trackId);
        if (ci === -1) continue;
        const c = chain[ci];
        const effectiveT = c.reversed ? 1 - ep2.t : ep2.t;
        anchors.push({
          globalDist: c.cumDist + effectiveT * c.length,
          elevation: ep2.elevation,
        });
      }

      if (chain.length > 0 && anchors.length === 0) {
        const firstTrack = chain[0];
        const firstReversed = firstTrack.reversed;
        const connEnd = firstReversed ? "end" : "start";
        for (const n of adjacency.get(firstTrack.trackId) ?? []) {
          const resolved = result.get(n.trackId);
          if (resolved) {
            const connElev = n.atTheirEnd === "start" ? resolved.startElev : resolved.endElev;
            anchors.push({ globalDist: 0, elevation: connElev });
            break;
          }
        }
      }

      anchors.sort((a, b) => a.globalDist - b.globalDist);
      if (anchors.length === 0) return;

      for (const c of chain) {
        if (result.has(c.trackId)) continue;
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
    };

    walkChain(endpoints[0], null);

    for (const tid of component) {
      if (!chainVisited.has(tid)) {
        walkChain(tid, null);
      }
    }
  }

  return result;
}

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

function getElevationFromMap(
  trackId: string,
  t: number,
  elevMap: Map<string, { startElev: number; endElev: number }>,
): number {
  const entry = elevMap.get(trackId);
  if (!entry) return 0;
  return entry.startElev + t * (entry.endElev - entry.startElev);
}

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
  const widthMm = board.width * 10;
  const depthMm = board.depth * 10;

  const geometry = useMemo(() => {
    const boardPath = getBoardPathMm(board);
    if (boardPath.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(boardPath[0].x, boardPath[0].z);
    for (let i = 1; i < boardPath.length; i++) {
      shape.lineTo(boardPath[i].x, boardPath[i].z);
    }
    shape.closePath();

    // Extrude a thin slab so both sides have proper normals
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 3, // 3mm thick board
      bevelEnabled: false,
    });

    // ExtrudeGeometry extrudes along +Z — rotate to lie flat in XZ plane
    // and flip to correct mirror
    geom.rotateX(-Math.PI / 2);
    geom.scale(1, 1, -1);

    return geom;
  }, [board]);

  const groundTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Base grass tone
    ctx.fillStyle = "#7c9f5a";
    ctx.fillRect(0, 0, 512, 512);

    // Mottled grass/soil patches for a less technical look
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 1 + Math.random() * 3.5;
      const g = 105 + Math.floor(Math.random() * 35);
      const a = 0.05 + Math.random() * 0.12;
      ctx.fillStyle = `rgba(55, ${g}, 40, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A few darker paths/strips for visual variation
    ctx.strokeStyle = "rgba(70,55,35,0.12)";
    ctx.lineWidth = 8;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 512);
      ctx.quadraticCurveTo(
        Math.random() * 512,
        Math.random() * 512,
        Math.random() * 512,
        Math.random() * 512,
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Tile roughly per 120mm for softer detail density
    const tileMm = 120;
    texture.repeat.set(widthMm / tileMm, depthMm / tileMm);
    texture.anisotropy = 8;
    return texture;
  }, [widthMm, depthMm]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, -5, 0]} receiveShadow>
      <meshStandardMaterial
        color="#f2f4ea"
        map={groundTexture}
        roughness={0.98}
        metalness={0}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}

// ── Single track piece 3D ──

function TrackPiece3D({
  track,
  piece,
  elevMap,
  snapMap,
}: {
  track: PlacedTrack;
  piece: TrackPieceDefinition;
  elevMap: Map<string, { startElev: number; endElev: number }>;
  snapMap: SnapMap;
}) {
  const gaugeMm = getGaugeMm(piece.scale);
  const halfGauge = gaugeMm / 2;

  // Generate center points PER SEGMENT to avoid jumps in turnouts/crossings
  const segmentPoints = useMemo(() => {
    const segments = getPieceSegmentsLocal(piece);
    const allPts = segments.map((seg) => sampleSegmentWorld3D(seg, track, elevMap, 10));

    // Snap endpoints: for each connection, if snapped, move the closest endpoint to the snap midpoint
    for (const [connId] of Object.entries(track.snappedConnections)) {
      const snapPt = snapMap.get(`${track.instanceId}:${connId}`);
      if (!snapPt) continue;

      const conn = piece.connections.find((c) => c.id === connId);
      if (!conn) continue;
      const connWorld = localToWorld({ x: conn.position.x, z: conn.position.z }, track);

      // Find which segment + which end is closest, then blend smoothly
      for (const pts of allPts) {
        if (pts.length < 2) continue;
        const first = pts[0];
        const last = pts[pts.length - 1];
        const distFirst = Math.hypot(first.x - connWorld.x, first.z - connWorld.z);
        const distLast = Math.hypot(last.x - connWorld.x, last.z - connWorld.z);

        // Blend over ~30% of points from the matched end
        const blendCount = Math.max(2, Math.floor(pts.length * 0.3));

        if (distFirst < 5) {
          const dx = snapPt.x - first.x;
          const dz = snapPt.z - first.z;
          for (let b = 0; b < blendCount && b < pts.length; b++) {
            // Smooth ease-out: full correction at b=0, zero at b=blendCount
            const t = 1 - b / blendCount;
            const ease = t * t; // quadratic ease-out
            pts[b] = { ...pts[b], x: pts[b].x + dx * ease, z: pts[b].z + dz * ease };
          }
        }
        if (distLast < 5) {
          const dx = snapPt.x - last.x;
          const dz = snapPt.z - last.z;
          for (let b = 0; b < blendCount && b < pts.length; b++) {
            const idx = pts.length - 1 - b;
            const t = 1 - b / blendCount;
            const ease = t * t;
            pts[idx] = { ...pts[idx], x: pts[idx].x + dx * ease, z: pts[idx].z + dz * ease };
          }
        }
      }
    }

    return allPts;
  }, [track, piece, elevMap, snapMap]);

  // For ballast + sleepers, use only the FIRST segment (primary path)
  // For rails, render each segment separately
  const primaryPoints = segmentPoints[0] ?? [];

  const buildRailSolid = (
    centerPts: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }>,
    offsetX: number,
  ) => {
    if (centerPts.length < 2) return null;
    const hw = RAIL_WIDTH_MM / 2;
    const hh = RAIL_HEIGHT_MM / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const railY = BALLAST_HEIGHT_MM + SLEEPER_THICKNESS_MM;

    for (let i = 0; i < centerPts.length; i++) {
      const pt = centerPts[i];
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;

      const cx = pt.x + perpX * offsetX;
      const cz = pt.z + perpZ * offsetX;
      const cy = pt.y + railY;

      vertices.push(cx + perpX * hw, cy + hh, cz + perpZ * hw);
      vertices.push(cx - perpX * hw, cy + hh, cz - perpZ * hw);
      vertices.push(cx - perpX * hw, cy - hh, cz - perpZ * hw);
      vertices.push(cx + perpX * hw, cy - hh, cz + perpZ * hw);

      if (i > 0) {
        const c = i * 4;
        const p = (i - 1) * 4;
        indices.push(p + 0, p + 1, c + 1, p + 0, c + 1, c + 0);
        indices.push(p + 2, p + 3, c + 3, p + 2, c + 3, c + 2);
        indices.push(p + 3, p + 0, c + 0, p + 3, c + 0, c + 3);
        indices.push(p + 1, p + 2, c + 2, p + 1, c + 2, c + 1);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  };

  // Build rail geometry per segment (so turnout branches render correctly)
  const railGeoms = useMemo(() => {
    return segmentPoints.map((pts) => ({
      left: buildRailSolid(pts, halfGauge),
      right: buildRailSolid(pts, -halfGauge),
    }));
  }, [segmentPoints, halfGauge]);

  const isMultiSegment = segmentPoints.length > 1; // turnout / crossing
  const sleeperLengthBase = gaugeMm * SLEEPER_LENGTH_FACTOR;

  // Ballast per segment (each branch gets its own ballast)
  const ballastGeoms = useMemo(() => {
    return segmentPoints.map((pts) => {
      if (pts.length < 2) return null;
      const topHalfW = gaugeMm * BALLAST_WIDTH_FACTOR / 2;
      const botHalfW = topHalfW * 1.3;
      const bh = BALLAST_HEIGHT_MM;
      const bVerts: number[] = [];
      const bIdx: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const px = -pt.tangentZ;
        const pz = pt.tangentX;
        bVerts.push(pt.x + px * topHalfW, pt.y + bh, pt.z + pz * topHalfW);
        bVerts.push(pt.x - px * topHalfW, pt.y + bh, pt.z - pz * topHalfW);
        bVerts.push(pt.x - px * botHalfW, pt.y, pt.z - pz * botHalfW);
        bVerts.push(pt.x + px * botHalfW, pt.y, pt.z + pz * botHalfW);
        if (i > 0) {
          const c = i * 4, p = (i - 1) * 4;
          bIdx.push(p, p + 1, c + 1, p, c + 1, c);
          bIdx.push(p + 1, p + 2, c + 2, p + 1, c + 2, c + 1);
          bIdx.push(p + 2, p + 3, c + 3, p + 2, c + 3, c + 2);
          bIdx.push(p + 3, p, c, p + 3, c, c + 3);
        }
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(bVerts, 3));
      geom.setIndex(bIdx);
      geom.computeVertexNormals();
      return geom;
    });
  }, [segmentPoints, gaugeMm]);

  // ── Sleeper geometry ──
  // For turnouts/crossings: sleepers perpendicular to main track, but dynamically
  // extended on the side where the diverging branch goes (like real turnout sleepers).
  // For simple tracks: standard perpendicular sleepers.
  const sleeperGeom = useMemo(() => {
    const mainPts = primaryPoints;
    if (mainPts.length < 2) return null;

    // Build cumDist for main path
    const mainCumDist: number[] = [0];
    for (let i = 1; i < mainPts.length; i++) {
      mainCumDist.push(mainCumDist[i - 1] + Math.hypot(mainPts[i].x - mainPts[i - 1].x, mainPts[i].z - mainPts[i - 1].z));
    }
    const mainTotalLen = mainCumDist[mainCumDist.length - 1];
    if (mainTotalLen < 1) return null;

    // Build cumDist for diverging path (if exists)
    const divPts = isMultiSegment ? segmentPoints[1] : null;
    let divCumDist: number[] | null = null;
    let divTotalLen = 0;
    if (divPts && divPts.length >= 2) {
      divCumDist = [0];
      for (let i = 1; i < divPts.length; i++) {
        divCumDist.push(divCumDist[i - 1] + Math.hypot(divPts[i].x - divPts[i - 1].x, divPts[i].z - divPts[i - 1].z));
      }
      divTotalLen = divCumDist[divCumDist.length - 1];
    }

    // Helper: interpolate point at distance along a path
    function pointAtDist(pts: typeof mainPts, cumD: number[], dist: number) {
      let si = 1;
      while (si < cumD.length - 1 && cumD[si] < dist) si++;
      const segLen = cumD[si] - cumD[si - 1];
      const t = segLen > 0 ? (dist - cumD[si - 1]) / segLen : 0;
      const p0 = pts[si - 1], p1 = pts[si];
      return {
        x: p0.x + t * (p1.x - p0.x),
        y: p0.y + t * (p1.y - p0.y),
        z: p0.z + t * (p1.z - p0.z),
      };
    }

    const count = Math.max(2, Math.floor(mainTotalLen / SLEEPER_SPACING_MM));
    const halfW = SLEEPER_WIDTH_MM / 2;
    const hh = SLEEPER_THICKNESS_MM;
    const baseHalfLen = sleeperLengthBase / 2;
    const railEdge = halfGauge + RAIL_WIDTH_MM; // outer edge of rail from center
    const overhang = RAIL_WIDTH_MM * 2; // small overhang beyond outer rail

    const sVerts: number[] = [];
    const sIdx: number[] = [];

    for (let s = 0; s <= count; s++) {
      const dist = (s / count) * mainTotalLen;
      const frac = dist / mainTotalLen;

      // Main track point
      const mp = mainPts[0]; // fallback
      let si = 1;
      while (si < mainCumDist.length - 1 && mainCumDist[si] < dist) si++;
      const segLen = mainCumDist[si] - mainCumDist[si - 1];
      const t = segLen > 0 ? (dist - mainCumDist[si - 1]) / segLen : 0;
      const p0 = mainPts[si - 1], p1 = mainPts[si];
      const cx = p0.x + t * (p1.x - p0.x);
      const cy = p0.y + t * (p1.y - p0.y) + BALLAST_HEIGHT_MM;
      const cz = p0.z + t * (p1.z - p0.z);
      const tx = p1.tangentX, tz = p1.tangentZ;
      // Perpendicular to main track (always)
      const perpX = -tz;
      const perpZ = tx;

      // Default: symmetric sleeper
      let extLeft = baseHalfLen;
      let extRight = baseHalfLen;

      if (divPts && divCumDist && divTotalLen > 0) {
        // Find diverging point at same fraction
        const dp = pointAtDist(divPts, divCumDist, frac * divTotalLen);

        // Project diverging center onto the main track's perpendicular axis
        // to find how far the diverging track is from main center
        const toDivX = dp.x - cx;
        const toDivZ = dp.z - cz;
        const projDist = toDivX * perpX + toDivZ * perpZ;
        // projDist > 0 → diverging is in the "left" (positive perp) direction
        // projDist < 0 → diverging is in the "right" (negative perp) direction

        // The sleeper needs to reach the far edge of the diverging track
        const divFarEdge = Math.abs(projDist) + railEdge + overhang;

        if (projDist > 0) {
          // Diverging is to the left
          extLeft = Math.max(baseHalfLen, divFarEdge);
        } else {
          // Diverging is to the right
          extRight = Math.max(baseHalfLen, divFarEdge);
        }
      }

      // Sleeper endpoints (perpendicular to main track, asymmetric extension)
      const leftX = cx + perpX * extLeft;
      const leftZ = cz + perpZ * extLeft;
      const rightX = cx - perpX * extRight;
      const rightZ = cz - perpZ * extRight;

      const base = s * 8;
      for (let dy = 0; dy <= 1; dy++) {
        const y = cy + dy * hh;
        sVerts.push(leftX + tx * halfW, y, leftZ + tz * halfW);
        sVerts.push(leftX - tx * halfW, y, leftZ - tz * halfW);
        sVerts.push(rightX - tx * halfW, y, rightZ - tz * halfW);
        sVerts.push(rightX + tx * halfW, y, rightZ + tz * halfW);
      }
      const b = base;
      sIdx.push(b + 4, b + 5, b + 6, b + 4, b + 6, b + 7);
      sIdx.push(b + 2, b + 1, b, b + 3, b + 2, b);
      sIdx.push(b, b + 1, b + 5, b, b + 5, b + 4);
      sIdx.push(b + 2, b + 3, b + 7, b + 2, b + 7, b + 6);
      sIdx.push(b + 3, b, b + 4, b + 3, b + 4, b + 7);
      sIdx.push(b + 1, b + 2, b + 6, b + 1, b + 6, b + 5);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(sVerts, 3));
    geom.setIndex(sIdx);
    geom.computeVertexNormals();
    return geom;
  }, [primaryPoints, segmentPoints, isMultiSegment, halfGauge, sleeperLengthBase]);

  return (
    <group>
      {/* Ballast per segment */}
      {ballastGeoms.map((bg, idx) => bg && (
        <mesh key={`ballast-${idx}`} geometry={bg} castShadow receiveShadow>
          <meshStandardMaterial color={COLOR_BALLAST} roughness={0.95} />
        </mesh>
      ))}

      {/* Fan-shaped sleepers for turnouts, standard for simple tracks */}
      {sleeperGeom && (
        <mesh geometry={sleeperGeom} castShadow receiveShadow>
          <meshStandardMaterial color={COLOR_SLEEPER} roughness={0.82} />
        </mesh>
      )}

      {railGeoms.map((rg, idx) => (
        <group key={`rails-${idx}`}>
          {rg.left && (
            <mesh geometry={rg.left} castShadow receiveShadow>
              <meshStandardMaterial color={COLOR_RAIL} metalness={0.88} roughness={0.26} />
            </mesh>
          )}
          {rg.right && (
            <mesh geometry={rg.right} castShadow receiveShadow>
              <meshStandardMaterial color={COLOR_RAIL} metalness={0.88} roughness={0.26} />
            </mesh>
          )}
        </group>
      ))}

      {track.isBridge && (
        <BridgeSupports centerPoints={primaryPoints} gaugeMm={gaugeMm} />
      )}

      {/* Tunnel hill replaced by terrain corridor v2 */}
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
  const bridgeGeom = useMemo(() => {
    if (centerPoints.length < 4) return null;

    // Use ALL points — bridge renders even at ground level (y=0).
    // Pillar height is max(y, minClearance) so there's always visible structure.
    const bridgePts = centerPoints;
    if (bridgePts.length < 2) return null;

    const minClearance = gaugeMm * 1.5; // minimum bridge height when flat

    const halfWidth = gaugeMm * 1.2; // bridge deck half-width (wider than track)
    const girderHeight = gaugeMm * 0.8; // side girder height
    const girderThick = gaugeMm * 0.08; // girder wall thickness
    const deckThick = gaugeMm * 0.1; // deck plate thickness
    const pillarW = gaugeMm * 0.5; // pillar cross-section
    const railingH = gaugeMm * 0.5; // railing height above girder
    const railingThick = gaugeMm * 0.04;

    const vertices: number[] = [];
    const indices: number[] = [];
    let vi = 0;

    function addQuad(
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
      dx: number, dy: number, dz: number,
    ) {
      const base = vi;
      vertices.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      vi += 4;
    }

    // Generate bridge deck + girders along center points
    for (let i = 0; i < bridgePts.length - 1; i++) {
      const p0 = bridgePts[i];
      const p1 = bridgePts[i + 1];

      // Perpendiculars
      const perp0x = -p0.tangentZ, perp0z = p0.tangentX;
      const perp1x = -p1.tangentZ, perp1z = p1.tangentX;

      const deckY0 = p0.y - deckThick;
      const deckY1 = p1.y - deckThick;

      // ── Deck bottom face ──
      addQuad(
        p0.x + perp0x * halfWidth, deckY0, p0.z + perp0z * halfWidth,
        p0.x - perp0x * halfWidth, deckY0, p0.z - perp0z * halfWidth,
        p1.x - perp1x * halfWidth, deckY1, p1.z - perp1z * halfWidth,
        p1.x + perp1x * halfWidth, deckY1, p1.z + perp1z * halfWidth,
      );

      // ── Left girder (outer face) ──
      const gBase0 = deckY0 - girderHeight;
      const gBase1 = deckY1 - girderHeight;
      addQuad(
        p0.x + perp0x * halfWidth, deckY0, p0.z + perp0z * halfWidth,
        p1.x + perp1x * halfWidth, deckY1, p1.z + perp1z * halfWidth,
        p1.x + perp1x * halfWidth, gBase1, p1.z + perp1z * halfWidth,
        p0.x + perp0x * halfWidth, gBase0, p0.z + perp0z * halfWidth,
      );
      // Left girder (inner face)
      const innerOff = halfWidth - girderThick;
      addQuad(
        p0.x + perp0x * innerOff, deckY0, p0.z + perp0z * innerOff,
        p0.x + perp0x * innerOff, gBase0, p0.z + perp0z * innerOff,
        p1.x + perp1x * innerOff, gBase1, p1.z + perp1z * innerOff,
        p1.x + perp1x * innerOff, deckY1, p1.z + perp1z * innerOff,
      );
      // Left girder bottom
      addQuad(
        p0.x + perp0x * halfWidth, gBase0, p0.z + perp0z * halfWidth,
        p1.x + perp1x * halfWidth, gBase1, p1.z + perp1z * halfWidth,
        p1.x + perp1x * innerOff, gBase1, p1.z + perp1z * innerOff,
        p0.x + perp0x * innerOff, gBase0, p0.z + perp0z * innerOff,
      );

      // ── Right girder (outer face) ──
      addQuad(
        p0.x - perp0x * halfWidth, deckY0, p0.z - perp0z * halfWidth,
        p0.x - perp0x * halfWidth, gBase0, p0.z - perp0z * halfWidth,
        p1.x - perp1x * halfWidth, gBase1, p1.z - perp1z * halfWidth,
        p1.x - perp1x * halfWidth, deckY1, p1.z - perp1z * halfWidth,
      );
      // Right girder (inner face)
      addQuad(
        p0.x - perp0x * innerOff, deckY0, p0.z - perp0z * innerOff,
        p1.x - perp1x * innerOff, deckY1, p1.z - perp1z * innerOff,
        p1.x - perp1x * innerOff, gBase1, p1.z - perp1z * innerOff,
        p0.x - perp0x * innerOff, gBase0, p0.z - perp0z * innerOff,
      );
      // Right girder bottom
      addQuad(
        p0.x - perp0x * halfWidth, gBase0, p0.z - perp0z * halfWidth,
        p0.x - perp0x * innerOff, gBase0, p0.z - perp0z * innerOff,
        p1.x - perp1x * innerOff, gBase1, p1.z - perp1z * innerOff,
        p1.x - perp1x * halfWidth, gBase1, p1.z - perp1z * halfWidth,
      );

      // ── Left railing ──
      const railTop0 = p0.y + railingH;
      const railTop1 = p1.y + railingH;
      addQuad(
        p0.x + perp0x * halfWidth, railTop0, p0.z + perp0z * halfWidth,
        p1.x + perp1x * halfWidth, railTop1, p1.z + perp1z * halfWidth,
        p1.x + perp1x * halfWidth, deckY1 + deckThick, p1.z + perp1z * halfWidth,
        p0.x + perp0x * halfWidth, deckY0 + deckThick, p0.z + perp0z * halfWidth,
      );
      // Left railing inner
      const railInner = halfWidth - railingThick;
      addQuad(
        p0.x + perp0x * railInner, railTop0, p0.z + perp0z * railInner,
        p0.x + perp0x * railInner, deckY0 + deckThick, p0.z + perp0z * railInner,
        p1.x + perp1x * railInner, deckY1 + deckThick, p1.z + perp1z * railInner,
        p1.x + perp1x * railInner, railTop1, p1.z + perp1z * railInner,
      );

      // ── Right railing ──
      addQuad(
        p0.x - perp0x * halfWidth, railTop0, p0.z - perp0z * halfWidth,
        p0.x - perp0x * halfWidth, deckY0 + deckThick, p0.z - perp0z * halfWidth,
        p1.x - perp1x * halfWidth, deckY1 + deckThick, p1.z - perp1z * halfWidth,
        p1.x - perp1x * halfWidth, railTop1, p1.z + perp1z * halfWidth,
      );
      addQuad(
        p0.x - perp0x * railInner, railTop0, p0.z - perp0z * railInner,
        p1.x - perp1x * railInner, railTop1, p1.z - perp1z * railInner,
        p1.x - perp1x * railInner, deckY1 + deckThick, p1.z - perp1z * railInner,
        p0.x - perp0x * railInner, deckY0 + deckThick, p0.z - perp0z * railInner,
      );
    }

    // ── Pillars at regular intervals ──
    const cumDist: number[] = [0];
    for (let i = 1; i < bridgePts.length; i++) {
      cumDist.push(cumDist[i - 1] + Math.hypot(
        bridgePts[i].x - bridgePts[i - 1].x,
        bridgePts[i].z - bridgePts[i - 1].z,
      ));
    }
    const totalLen = cumDist[cumDist.length - 1];
    const pillarSpacing = 40; // mm between pillars
    const pillarCount = Math.max(2, Math.floor(totalLen / pillarSpacing));

    for (let p = 0; p <= pillarCount; p++) {
      const targetDist = (p / pillarCount) * totalLen;
      let si = 1;
      while (si < cumDist.length - 1 && cumDist[si] < targetDist) si++;
      const sLen = cumDist[si] - cumDist[si - 1];
      const t = sLen > 0 ? (targetDist - cumDist[si - 1]) / sLen : 0;
      const pt0 = bridgePts[si - 1], pt1 = bridgePts[si];
      const px = pt0.x + t * (pt1.x - pt0.x);
      const py = pt0.y + t * (pt1.y - pt0.y);
      const pz = pt0.z + t * (pt1.z - pt0.z);

      // Bridge height: at least minClearance so flat bridges still show pillars
      const effectiveY = Math.max(py, minClearance);
      const deckBottom = effectiveY - deckThick - girderHeight;
      const hpw = pillarW / 2;

      // Pillar: from ground (0) to girder bottom
      // Front face
      addQuad(px - hpw, deckBottom, pz - hpw, px + hpw, deckBottom, pz - hpw, px + hpw, 0, pz - hpw, px - hpw, 0, pz - hpw);
      // Back face
      addQuad(px + hpw, deckBottom, pz + hpw, px - hpw, deckBottom, pz + hpw, px - hpw, 0, pz + hpw, px + hpw, 0, pz + hpw);
      // Left face
      addQuad(px - hpw, deckBottom, pz + hpw, px - hpw, deckBottom, pz - hpw, px - hpw, 0, pz - hpw, px - hpw, 0, pz + hpw);
      // Right face
      addQuad(px + hpw, deckBottom, pz - hpw, px + hpw, deckBottom, pz + hpw, px + hpw, 0, pz + hpw, px + hpw, 0, pz - hpw);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [centerPoints, gaugeMm]);

  return (
    <group>
      {bridgeGeom && (
        <mesh geometry={bridgeGeom} castShadow receiveShadow>
          <meshStandardMaterial color={COLOR_BRIDGE} roughness={0.52} metalness={0.42} />
        </mesh>
      )}
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
    const segments = 8;

    for (let i = 0; i < centerPoints.length; i++) {
      const pt = centerPoints[i];
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;

      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI;
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
    <mesh geometry={hillGeom} receiveShadow>
      <meshStandardMaterial color={COLOR_TUNNEL} transparent opacity={0.82} roughness={0.95} />
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
            <mesh position={[0, m.elevation > 0 ? -m.elevation / 2 : -m.elevation / 2, 0]}>
              <cylinderGeometry args={[0.3, 0.3, Math.abs(m.elevation) || 2, 6]} />
              <meshStandardMaterial color={color} opacity={0.6} transparent />
            </mesh>
            <mesh>
              <sphereGeometry args={[1.5, 8, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Camera auto-fit ──

function CameraSetup({ board, boardDiagonal }: { board: BoardConfig; boardDiagonal: number }) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    if (controlsRef.current) {
      const widthMm = board.width * 10;
      const depthMm = board.depth * 10;
      controlsRef.current.target.set(widthMm / 2, 0, depthMm / 2);
      controlsRef.current.update();
    }
  }, [board]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={50}
      maxDistance={boardDiagonal * 2}
    />
  );
}

// ── Main scene ──

// snapKey: "trackId:connId" → averaged world position
type SnapMap = Map<string, { x: number; z: number }>;

function buildSnapMap(tracks: PlacedTrack[], catalog: Record<string, TrackPieceDefinition>): SnapMap {
  const map: SnapMap = new Map();
  // For each snapped pair, compute the midpoint of the two connection world positions
  for (const track of tracks) {
    const piece = catalog[track.pieceId];
    if (!piece) continue;
    for (const [myConnId, snapVal] of Object.entries(track.snappedConnections)) {
      const key1 = `${track.instanceId}:${myConnId}`;
      if (map.has(key1)) continue;

      const [otherTrackId, otherConnId] = snapVal.split(":");
      const otherTrack = tracks.find((t) => t.instanceId === otherTrackId);
      const otherPiece = otherTrack ? catalog[otherTrack.pieceId] : null;
      if (!otherTrack || !otherPiece) continue;

      // Find my connection point in local coords → world
      const myConn = piece.connections.find((c) => c.id === myConnId);
      const otherConn = otherPiece.connections.find((c) => c.id === otherConnId);
      if (!myConn || !otherConn) continue;

      const myWorld = localToWorld({ x: myConn.position.x, z: myConn.position.z }, track);
      const otherWorld = localToWorld({ x: otherConn.position.x, z: otherConn.position.z }, otherTrack);

      const midX = (myWorld.x + otherWorld.x) / 2;
      const midZ = (myWorld.z + otherWorld.z) / 2;

      const key2 = `${otherTrackId}:${otherConnId}`;
      map.set(key1, { x: midX, z: midZ });
      map.set(key2, { x: midX, z: midZ });
    }
  }
  return map;
}

type TerrainSample = { x: number; y: number; z: number; isTunnel: boolean; isBridge: boolean };
type ZoneSample = { kind: TerrainZone["kind"]; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } };

type TerrainCell = { x: number; z: number; y: number; inside: boolean };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep01(t: number) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function pointInPolygon2D(x: number, z: number, polygon: LocalPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersects = ((zi > z) !== (zj > z))
      && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-6) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment2D(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const abx = bx - ax;
  const abz = bz - az;
  const denom = abx * abx + abz * abz;
  const t = denom > 0 ? clamp(((px - ax) * abx + (pz - az) * abz) / denom, 0, 1) : 0;
  const qx = ax + abx * t;
  const qz = az + abz * t;
  return { dist: Math.hypot(px - qx, pz - qz), t };
}

function sampleTrackPoint(
  track: PlacedTrack,
  piece: TrackPieceDefinition,
  t: number,
  elevMap: Map<string, { startElev: number; endElev: number }>,
) {
  const segments = getPieceSegmentsLocal(piece);
  if (!segments.length) {
    return { x: track.position.x, y: getElevationFromMap(track.instanceId, t, elevMap), z: track.position.z };
  }

  if (segments.length === 1) {
    const p = pointAndTangentAt(segments[0], clamp(t, 0, 1)).point;
    const w = localToWorld(p, track);
    return { x: w.x, y: getElevationFromMap(track.instanceId, t, elevMap), z: w.z };
  }

  const lengths = segments.map((seg) => seg.kind === "line"
    ? Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z)
    : seg.radius * Math.abs(seg.endAngle - seg.startAngle));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const target = clamp(t, 0, 1) * total;

  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const len = lengths[i];
    const next = acc + len;
    if (target <= next || i === segments.length - 1) {
      const localT = len > 0 ? (target - acc) / len : 0;
      const p = pointAndTangentAt(segments[i], clamp(localT, 0, 1)).point;
      const w = localToWorld(p, track);
      return { x: w.x, y: getElevationFromMap(track.instanceId, t, elevMap), z: w.z };
    }
    acc = next;
  }

  return { x: track.position.x, y: getElevationFromMap(track.instanceId, t, elevMap), z: track.position.z };
}

function buildTerrainSamples(
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
  elevMap: Map<string, { startElev: number; endElev: number }>,
  zoneTrackKind: Map<string, TerrainZone["kind"]>,
): TerrainSample[] {
  const out: TerrainSample[] = [];

  for (const track of tracks) {
    const piece = catalog[track.pieceId];
    if (!piece) continue;

    const segments = getPieceSegmentsLocal(piece);
    if (segments.length === 0) continue;

    const segLens = segments.map((seg) => seg.kind === "line"
      ? Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z)
      : seg.radius * Math.abs(seg.endAngle - seg.startAngle));
    const totalLen = segLens.reduce((a, b) => a + b, 0) || 1;

    let acc = 0;
    const zoneKind = zoneTrackKind.get(track.instanceId);
    const forcedTunnel = zoneKind === "tunnel";
    const forcedBridge = zoneKind === "bridge";

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const segLen = segLens[si] || 1;
      const steps = Math.max(3, Math.ceil(segLen / 18));

      for (let i = 0; i <= steps; i++) {
        const localT = i / steps;
        const globalT = (acc + localT * segLen) / totalLen;
        const p = pointAndTangentAt(seg, localT).point;
        const w = localToWorld(p, track);

        out.push({
          x: w.x,
          y: getElevationFromMap(track.instanceId, globalT, elevMap),
          z: w.z,
          isTunnel: forcedTunnel || (!!track.isTunnel && !forcedBridge),
          isBridge: forcedBridge || (!!track.isBridge && !forcedTunnel),
        });
      }

      acc += segLen;
    }
  }

  return out;
}

function buildZoneSamples(
  terrainZones: TerrainZone[],
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
  elevMap: Map<string, { startElev: number; endElev: number }>,
): ZoneSample[] {
  const byTrack = new Map(tracks.map((t) => [t.instanceId, t]));
  const out: ZoneSample[] = [];

  for (const zone of terrainZones) {
    const t1 = byTrack.get(zone.start.trackId);
    const t2 = byTrack.get(zone.end.trackId);
    if (!t1 || !t2) continue;
    const p1 = catalog[t1.pieceId];
    const p2 = catalog[t2.pieceId];
    if (!p1 || !p2) continue;
    out.push({
      kind: zone.kind,
      start: sampleTrackPoint(t1, p1, zone.start.t, elevMap),
      end: sampleTrackPoint(t2, p2, zone.end.t, elevMap),
    });
  }
  return out;
}


function buildZoneTrackKindMap(
  terrainZones: TerrainZone[],
  tracks: PlacedTrack[],
): Map<string, TerrainZone["kind"]> {
  const byId = new Map(tracks.map((t) => [t.instanceId, t]));
  const out = new Map<string, TerrainZone["kind"]>();

  type Edge = { to: string };
  const graph = new Map<string, Edge[]>();
  for (const track of tracks) {
    const edges: Edge[] = [];
    for (const snap of Object.values(track.snappedConnections)) {
      const [to] = snap.split(":");
      if (to) edges.push({ to });
    }
    graph.set(track.instanceId, edges);
  }

  for (const zone of terrainZones) {
    if (!byId.has(zone.start.trackId) || !byId.has(zone.end.trackId)) continue;

    const parent = new Map<string, string>();
    const q = [zone.start.trackId];
    const visited = new Set([zone.start.trackId]);

    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur === zone.end.trackId) break;
      for (const e of graph.get(cur) ?? []) {
        if (visited.has(e.to)) continue;
        visited.add(e.to);
        parent.set(e.to, cur);
        q.push(e.to);
      }
    }

    const path: string[] = [];
    if (zone.start.trackId === zone.end.trackId) {
      path.push(zone.start.trackId);
    } else if (parent.has(zone.end.trackId)) {
      let cur: string | undefined = zone.end.trackId;
      while (cur) {
        path.unshift(cur);
        if (cur === zone.start.trackId) break;
        cur = parent.get(cur);
      }
      if (path[0] !== zone.start.trackId) continue;
    } else {
      path.push(zone.start.trackId, zone.end.trackId);
    }

    for (const trackId of path) {
      const existing = out.get(trackId);
      if (!existing) {
        out.set(trackId, zone.kind);
      }
    }
  }

  return out;
}

type TerrainPatchMode = "normal" | "tunnel" | "bridge";
type TerrainCorridorPoint = { x: number; y: number; z: number; tangentX: number; tangentZ: number };

function getTrackTerrainMode(
  track: PlacedTrack,
  zoneTrackKind: Map<string, TerrainZone["kind"]>,
): TerrainPatchMode {
  const z = zoneTrackKind.get(track.instanceId);
  if (z === "tunnel") return "tunnel";
  if (z === "bridge") return "bridge";
  if (track.isTunnel) return "tunnel";
  if (track.isBridge) return "bridge";
  return "normal";
}

function buildTrackCorridorPoints(
  track: PlacedTrack,
  piece: TrackPieceDefinition,
  elevMap: Map<string, { startElev: number; endElev: number }>,
): TerrainCorridorPoint[] {
  const segments = getPieceSegmentsLocal(piece);
  if (segments.length === 0) return [];

  const lengths = segments.map((seg) => seg.kind === "line"
    ? Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z)
    : seg.radius * Math.abs(seg.endAngle - seg.startAngle));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;

  const out: TerrainCorridorPoint[] = [];
  let acc = 0;

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const segLen = lengths[si] || 1;
    const samples = Math.max(3, Math.ceil(segLen / 14));

    for (let i = 0; i <= samples; i++) {
      if (si > 0 && i === 0) continue;
      const localT = i / samples;
      const globalT = (acc + localT * segLen) / total;

      const { point: local, tangent: localTan } = pointAndTangentAt(seg, localT);
      const world = localToWorld(local, track);
      const worldTanPt = localToWorld({ x: local.x + localTan.x, z: local.z + localTan.z }, track);
      const tx = worldTanPt.x - world.x;
      const tz = worldTanPt.z - world.z;
      const tl = Math.hypot(tx, tz) || 1;

      out.push({
        x: world.x,
        y: getElevationFromMap(track.instanceId, globalT, elevMap),
        z: world.z,
        tangentX: tx / tl,
        tangentZ: tz / tl,
      });
    }

    acc += segLen;
  }

  return out;
}

function TerrainCorridors({
  tracks,
  catalog,
  elevMap,
  terrainZones,
}: {
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
  elevMap: Map<string, { startElev: number; endElev: number }>;
  terrainZones: TerrainZone[];
}) {
  const { normalGeom, tunnelGeom, bridgeGeom } = useMemo(() => {
    const zoneTrackKind = buildZoneTrackKindMap(terrainZones, tracks);

    const modeData = {
      normal: { pos: [] as number[], idx: [] as number[], v: 0 },
      tunnel: { pos: [] as number[], idx: [] as number[], v: 0 },
      bridge: { pos: [] as number[], idx: [] as number[], v: 0 },
    };

    const TUNNEL_PROFILE_SEGMENTS = 10; // cross-section segments for tunnel hill

    const addStrip = (mode: TerrainPatchMode, points: TerrainCorridorPoint[]) => {
      if (points.length < 2) return;
      if (mode === "bridge") return; // keep original bridge model without terrain cut under it

      const d = modeData[mode];

      if (mode === "tunnel") {
        // Semi-elliptical hill profile (like a real tunnel mound)
        const hillHalfW = PATCH_TUNNEL_HALF_WIDTH_MM;
        const hillHeight = 38; // mm above track
        const cols = TUNNEL_PROFILE_SEGMENTS + 1;

        for (const p of points) {
          const px = -p.tangentZ;
          const pz = p.tangentX;
          const baseY = p.y - 1;

          for (let j = 0; j <= TUNNEL_PROFILE_SEGMENTS; j++) {
            const angle = (j / TUNNEL_PROFILE_SEGMENTS) * Math.PI; // 0..PI
            const dx = Math.cos(angle) * hillHalfW; // -halfW..+halfW
            const dy = Math.sin(angle) * hillHeight; // 0..hillHeight..0

            d.pos.push(
              p.x + px * dx,
              baseY + dy,
              p.z + pz * dx,
            );
          }
        }

        const rows = points.length;
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const a = d.v + r * cols + c;
            const b = a + 1;
            const c1 = a + cols;
            const d1 = c1 + 1;
            d.idx.push(a, b, c1, b, d1, c1);
          }
        }

        d.v += rows * cols;
        return;
      }

      // Normal mode: flat ribbon along track
      const halfW = PATCH_NORMAL_HALF_WIDTH_MM;
      const laneFactors = [-1, -0.58, 0, 0.58, 1];

      for (const p of points) {
        const px = -p.tangentZ;
        const pz = p.tangentX;
        const centerY = p.y - 0.8;

        for (const lf of laneFactors) {
          const abs = Math.abs(lf);
          const edgeBlend = smoothstep01(abs);
          const y = centerY * (1 - edgeBlend) + PATCH_BASE_Y * edgeBlend;
          d.pos.push(
            p.x + px * halfW * lf,
            y,
            p.z + pz * halfW * lf,
          );
        }
      }

      const cols = laneFactors.length;
      const rows = points.length;
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = d.v + r * cols + c;
          const b = a + 1;
          const c1 = a + cols;
          const d1 = c1 + 1;
          d.idx.push(a, b, c1, b, d1, c1);
        }
      }

      d.v += rows * cols;
    };

    for (const track of tracks) {
      const piece = catalog[track.pieceId];
      if (!piece) continue;

      const mode = getTrackTerrainMode(track, zoneTrackKind);
      const points = buildTrackCorridorPoints(track, piece, elevMap);
      addStrip(mode, points);
    }

    const makeGeom = (pos: number[], idx: number[]) => {
      if (!pos.length || !idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };

    return {
      normalGeom: makeGeom(modeData.normal.pos, modeData.normal.idx),
      tunnelGeom: makeGeom(modeData.tunnel.pos, modeData.tunnel.idx),
      bridgeGeom: makeGeom(modeData.bridge.pos, modeData.bridge.idx),
    };
  }, [tracks, catalog, elevMap, terrainZones]);

  return (
    <group>
      {normalGeom && (
        <mesh geometry={normalGeom} receiveShadow castShadow>
          <meshStandardMaterial
            color="#6f8b4c"
            roughness={0.98}
            metalness={0}
            transparent
            opacity={0.98}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {tunnelGeom && (
        <mesh geometry={tunnelGeom} receiveShadow castShadow>
          <meshStandardMaterial
            color="#5a7340"
            roughness={0.95}
            metalness={0}
          />
        </mesh>
      )}

      {bridgeGeom && (
        <mesh geometry={bridgeGeom} receiveShadow castShadow>
          <meshStandardMaterial
            color="#655c4f"
            roughness={1}
            metalness={0}
            transparent
            opacity={0.92}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
    </group>
  );
}

function smoothCells(cells: TerrainCell[], cols: number, rows: number) {
  let current = cells;
  for (let pass = 0; pass < TERRAIN_SMOOTH_PASSES; pass++) {
    const next = current.map((c) => ({ ...c }));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (!current[idx].inside) continue;

        let sum = current[idx].y * 4;
        let w = 4;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const rr = r + dz;
            const cc = c + dx;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            const ni = rr * cols + cc;
            if (!current[ni].inside) continue;
            const ww = dx === 0 || dz === 0 ? 1.4 : 0.8;
            sum += current[ni].y * ww;
            w += ww;
          }
        }
        next[idx].y = sum / w;
      }
    }
    current = next;
  }
  return current;
}

function TerrainMesh({
  board,
  tracks,
  catalog,
  elevMap,
  elevationPoints,
  terrainZones,
}: {
  board: BoardConfig;
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
  elevMap: Map<string, { startElev: number; endElev: number }>;
  elevationPoints: ElevationPoint[];
  terrainZones: TerrainZone[];
}) {
  const { topGeom, sideGeom, outsideGeom } = useMemo(() => {
    const widthMm = board.width * 10;
    const depthMm = board.depth * 10;
    const poly = getBoardPathMm(board);
    const cols = Math.max(2, Math.floor(widthMm / TERRAIN_STEP_MM) + 1);
    const rows = Math.max(2, Math.floor(depthMm / TERRAIN_STEP_MM) + 1);

    const zoneTrackKind = buildZoneTrackKindMap(terrainZones, tracks);
    const trackSamples = buildTerrainSamples(tracks, catalog, elevMap, zoneTrackKind);
    const zoneSamples = buildZoneSamples(terrainZones, tracks, catalog, elevMap);

    const markerSamples = elevationPoints.map((ep) => {
      const tr = tracks.find((t) => t.instanceId === ep.trackId);
      if (!tr) return null;
      const piece = catalog[tr.pieceId];
      if (!piece) return null;
      return sampleTrackPoint(tr, piece, ep.t, elevMap);
    }).filter(Boolean) as Array<{ x: number; y: number; z: number }>;

    let cells: TerrainCell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c / (cols - 1)) * widthMm;
        const z = (r / (rows - 1)) * depthMm;
        const inside = pointInPolygon2D(x, z, poly);

        let y = inside ? TERRAIN_BASE_Y : TERRAIN_OUTSIDE_Y;

        if (inside) {
          y += Math.sin(x * 0.012) * Math.cos(z * 0.01) * 1.2;

          for (const m of markerSamples) {
            const d = Math.hypot(x - m.x, z - m.z);
            if (d > ELEVATION_INFLUENCE_RADIUS_MM) continue;
            const f = smoothstep01(1 - d / ELEVATION_INFLUENCE_RADIUS_MM);
            y += m.y * 0.4 * f;
          }

          for (const s of trackSamples) {
            const d = Math.hypot(x - s.x, z - s.z);
            if (d > TRACK_INFLUENCE_RADIUS_MM) continue;
            const f = smoothstep01(1 - d / TRACK_INFLUENCE_RADIUS_MM);

            if (s.isTunnel) {
              y = Math.max(y, s.y + TERRAIN_TUNNEL_RAISE_MM * f);
            } else if (s.isBridge) {
              y = Math.min(y, s.y - TERRAIN_BRIDGE_CUT_MM * f);
            } else {
              const target = s.y - 0.6;
              y = y * (1 - 0.55 * f) + target * (0.55 * f);
            }

            if (d <= TRACK_HARD_LOCK_RADIUS_MM) {
              if (s.isTunnel) y = Math.max(y, s.y + TERRAIN_TUNNEL_RAISE_MM * 0.92);
              else if (s.isBridge) y = Math.min(y, s.y - TERRAIN_BRIDGE_CUT_MM * 0.9);
              else y = y * 0.25 + (s.y - 0.5) * 0.75;
            }
          }

          for (const zSample of zoneSamples) {
            const d = distanceToSegment2D(
              x,
              z,
              zSample.start.x,
              zSample.start.z,
              zSample.end.x,
              zSample.end.z,
            );
            if (d.dist > ZONE_INFLUENCE_RADIUS_MM) continue;
            const f = smoothstep01(1 - d.dist / ZONE_INFLUENCE_RADIUS_MM);
            const lineY = zSample.start.y + (zSample.end.y - zSample.start.y) * d.t;
            if (zSample.kind === "tunnel") {
              y = Math.max(y, lineY + TERRAIN_TUNNEL_RAISE_MM * 1.1 * f);
            } else {
              y = Math.min(y, lineY - TERRAIN_BRIDGE_CUT_MM * 1.1 * f);
            }
          }

          y = clamp(y, TERRAIN_MIN_Y, TERRAIN_MAX_Y);
        }

        cells.push({ x, z, y, inside });
      }
    }

    cells = smoothCells(cells, cols, rows);

    // Re-anchor terrain to nearest track corridor after smoothing,
    // so mesh keeps respecting rail elevations and tunnel/bridge markings.
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i].inside) continue;

      let best: TerrainSample | null = null;
      let bestDist = Infinity;
      for (const s of trackSamples) {
        const d = Math.hypot(cells[i].x - s.x, cells[i].z - s.z);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }

      if (!best || bestDist > TRACK_INFLUENCE_RADIUS_MM) continue;

      const f = smoothstep01(1 - bestDist / TRACK_INFLUENCE_RADIUS_MM);
      if (best.isTunnel) {
        const minY = best.y + TERRAIN_TUNNEL_RAISE_MM * (0.85 + 0.15 * f);
        cells[i].y = Math.max(cells[i].y, minY);
      } else if (best.isBridge) {
        const maxY = best.y - TERRAIN_BRIDGE_CUT_MM * (0.8 + 0.2 * f);
        cells[i].y = Math.min(cells[i].y, maxY);
      } else {
        const target = best.y - 0.5;
        cells[i].y = cells[i].y * (1 - 0.35 * f) + target * (0.35 * f);
      }

      cells[i].y = clamp(cells[i].y, TERRAIN_MIN_Y, TERRAIN_MAX_Y);
    }

    const topPos: number[] = [];
    const topIdx: number[] = [];
    const topIndex = new Map<number, number>();

    for (let i = 0; i < cells.length; i++) {
      if (!cells[i].inside) continue;
      topIndex.set(i, topPos.length / 3);
      topPos.push(cells[i].x, cells[i].y, cells[i].z);
    }

    const addTri = (a: number, b: number, c: number) => {
      const ia = topIndex.get(a);
      const ib = topIndex.get(b);
      const ic = topIndex.get(c);
      if (ia == null || ib == null || ic == null) return;
      topIdx.push(ia, ib, ic);
    };

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const cIdx = a + cols;
        const d = cIdx + 1;
        addTri(a, b, cIdx);
        addTri(b, d, cIdx);
      }
    }

    const sidePos: number[] = [];
    const sideIdx: number[] = [];
    let sv = 0;
    const pushSide = (a: TerrainCell, b: TerrainCell) => {
      sidePos.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        b.x, TERRAIN_OUTSIDE_Y, b.z,
        a.x, TERRAIN_OUTSIDE_Y, a.z,
      );
      sideIdx.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
      sv += 4;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (!cells[idx].inside) continue;

        const neighbors = [
          { ok: c + 1 < cols, idx: idx + 1, edgeA: idx, edgeB: r + 1 < rows ? idx + cols : idx },
          { ok: c - 1 >= 0, idx: idx - 1, edgeA: idx, edgeB: r + 1 < rows ? idx + cols : idx },
          { ok: r + 1 < rows, idx: idx + cols, edgeA: idx, edgeB: c + 1 < cols ? idx + 1 : idx },
          { ok: r - 1 >= 0, idx: idx - cols, edgeA: idx, edgeB: c + 1 < cols ? idx + 1 : idx },
        ];

        for (const n of neighbors) {
          if (!n.ok || cells[n.idx].inside) {
            continue;
          }
          const a = cells[n.edgeA];
          const b = cells[n.edgeB];
          if (a && b && a.inside && b.inside) pushSide(a, b);
        }
      }
    }

    const topGeom = new THREE.BufferGeometry();
    topGeom.setAttribute("position", new THREE.Float32BufferAttribute(topPos, 3));
    topGeom.setIndex(topIdx);
    topGeom.computeVertexNormals();

    const sideGeom = new THREE.BufferGeometry();
    sideGeom.setAttribute("position", new THREE.Float32BufferAttribute(sidePos, 3));
    sideGeom.setIndex(sideIdx);
    sideGeom.computeVertexNormals();

    const outsideSize = Math.sqrt(widthMm * widthMm + depthMm * depthMm) * 2.6;
    const outsideGeom = new THREE.PlaneGeometry(outsideSize, outsideSize, 1, 1);
    outsideGeom.rotateX(-Math.PI / 2);

    return { topGeom, sideGeom, outsideGeom };
  }, [board, tracks, catalog, elevMap, elevationPoints, terrainZones]);

  return (
    <group>
      <mesh geometry={outsideGeom} position={[board.width * 5, TERRAIN_OUTSIDE_Y, board.depth * 5]} receiveShadow>
        <meshStandardMaterial color={TERRAIN_OUTSIDE_COLOR} roughness={1} metalness={0} transparent opacity={0.5} />
      </mesh>

      <mesh geometry={topGeom} receiveShadow castShadow>
        <meshStandardMaterial color={TERRAIN_SURFACE_COLOR} roughness={0.98} metalness={0} />
      </mesh>

      <mesh geometry={sideGeom} receiveShadow castShadow>
        <meshStandardMaterial color={TERRAIN_SIDE_COLOR} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

function Scene({ tracks, catalog, board, elevationPoints, terrainZones }: TrackViewer3DProps) {
  const widthMm = board.width * 10;
  const depthMm = board.depth * 10;
  const boardDiagonal = Math.sqrt(widthMm * widthMm + depthMm * depthMm);

  const elevMap = useMemo(
    () => buildElevationMap(tracks, elevationPoints, catalog),
    [tracks, elevationPoints, catalog],
  );

  const snapMap = useMemo(
    () => buildSnapMap(tracks, catalog),
    [tracks, catalog],
  );

  return (
    <>
      {/* Scene background */}
      <color attach="background" args={["#d4d0c8"]} />

      {/* Lighting */}
      <ambientLight intensity={0.9} />
      <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#b0a890" />
      <directionalLight
        position={[board.width * 5, board.width * 8, board.depth * 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={[-board.width * 3, board.width * 5, -board.depth * 3]}
        intensity={0.5}
      />

      {/* Board + local terrain corridors (v2, SCARM-like) */}
      <BoardMesh board={board} />
      <TerrainCorridors
        tracks={tracks}
        catalog={catalog}
        elevMap={elevMap}
        terrainZones={terrainZones}
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
            snapMap={snapMap}
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
      <CameraSetup board={board} boardDiagonal={boardDiagonal} />
    </>
  );
}

// ── Exported component ──

export default function TrackViewer3DNew(props: TrackViewer3DProps) {
  const { board } = props;
  const widthMm = board.width * 10;
  const depthMm = board.depth * 10;
  const boardDiagonal = Math.sqrt(widthMm * widthMm + depthMm * depthMm);

  return (
    <div className="h-full w-full" style={{ background: "#d4d0c8" }}>
      <Canvas
        camera={{
          position: [widthMm / 2, Math.max(widthMm, depthMm) * 0.7, depthMm * 1.2],
          fov: 50,
          near: 0.1,
          far: boardDiagonal * 20,
        }}
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          logarithmicDepthBuffer: true,
        }}
        dpr={[1, 2]}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
