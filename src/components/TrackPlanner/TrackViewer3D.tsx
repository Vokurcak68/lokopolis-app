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

    // ExtrudeGeometry extrudes along Z — rotate so board lies in XZ plane (flat)
    geom.rotateX(-Math.PI / 2);

    return geom;
  }, [board]);

  const gridTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#5a8a45";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "#4a7a38";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 512; i += 32) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
    }
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Repeat so grid tiles are ~50mm each
    const tileMm = 50;
    texture.repeat.set(widthMm / tileMm, depthMm / tileMm);
    return texture;
  }, [widthMm, depthMm]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, -3, 0]} receiveShadow>
      <meshStandardMaterial
        color="#ffffff"
        map={gridTexture}
        roughness={0.85}
        metalness={0}
        side={THREE.DoubleSide}
      />
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

  // Generate center points PER SEGMENT to avoid jumps in turnouts/crossings
  const segmentPoints = useMemo(() => {
    const segments = getPieceSegmentsLocal(piece);
    return segments.map((seg) => sampleSegmentWorld3D(seg, track, elevMap, 10));
  }, [track, piece, elevMap]);

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
          <meshStandardMaterial color="#c4b08a" roughness={0.8} />
        </mesh>
      ))}

      {/* Fan-shaped sleepers for turnouts, standard for simple tracks */}
      {sleeperGeom && (
        <mesh geometry={sleeperGeom} castShadow receiveShadow>
          <meshStandardMaterial color="#9b7b50" roughness={0.7} />
        </mesh>
      )}

      {railGeoms.map((rg, idx) => (
        <group key={`rails-${idx}`}>
          {rg.left && (
            <mesh geometry={rg.left} castShadow receiveShadow>
              <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
            </mesh>
          )}
          {rg.right && (
            <mesh geometry={rg.right} castShadow receiveShadow>
              <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
            </mesh>
          )}
        </group>
      ))}

      {track.isBridge && (
        <BridgeSupports centerPoints={primaryPoints} gaugeMm={gaugeMm} />
      )}

      {track.isTunnel && (
        <TunnelHill centerPoints={primaryPoints} gaugeMm={gaugeMm} />
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
          <meshStandardMaterial color="#8a9aaa" roughness={0.4} metalness={0.4} />
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
      <meshStandardMaterial color="#4a6a3a" transparent opacity={0.7} roughness={0.9} />
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

function Scene({ tracks, catalog, board, elevationPoints }: TrackViewer3DProps) {
  const widthMm = board.width * 10;
  const depthMm = board.depth * 10;
  const boardDiagonal = Math.sqrt(widthMm * widthMm + depthMm * depthMm);

  const elevMap = useMemo(
    () => buildElevationMap(tracks, elevationPoints, catalog),
    [tracks, elevationPoints, catalog],
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

      {/* Fog for depth cue */}
      {/* Fog removed — was washing out the board color */}

      {/* Board */}
      <BoardMesh board={board} />

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
      <CameraSetup board={board} boardDiagonal={boardDiagonal} />
    </>
  );
}

// ── Exported component ──

export default function TrackViewer3D(props: TrackViewer3DProps) {
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
