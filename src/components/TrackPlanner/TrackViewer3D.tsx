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
  const geometry = useMemo(() => {
    const boardPath = getBoardPathMm(board);
    if (boardPath.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(boardPath[0].x, boardPath[0].z);
    for (let i = 1; i < boardPath.length; i++) {
      shape.lineTo(boardPath[i].x, boardPath[i].z);
    }
    shape.closePath();

    const shapeGeom = new THREE.ShapeGeometry(shape);

    const pos = shapeGeom.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setXYZ(i, x, 0, y);
    }
    pos.needsUpdate = true;
    shapeGeom.computeVertexNormals();

    return shapeGeom;
  }, [board]);

  const gridTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#6a7a5b";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "#8b9a7b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 512; i += 64) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
    }
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }, []);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color="#7a8a6b"
        map={gridTexture}
        roughness={0.8}
        metalness={0.1}
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
  // For turnouts/crossings: fan-shaped sleepers spanning from outer edge of one rail
  // to outer edge of the diverging rail (like real turnout sleepers)
  // For simple tracks: standard perpendicular sleepers
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
        tx: p1.tangentX,
        tz: p1.tangentZ,
      };
    }

    const count = Math.max(2, Math.floor(mainTotalLen / SLEEPER_SPACING_MM));
    const halfW = SLEEPER_WIDTH_MM / 2;
    const hh = SLEEPER_THICKNESS_MM;
    const sVerts: number[] = [];
    const sIdx: number[] = [];

    for (let s = 0; s <= count; s++) {
      const dist = (s / count) * mainTotalLen;
      const frac = dist / mainTotalLen; // 0..1 along turnout
      const mp = pointAtDist(mainPts, mainCumDist, dist);
      const cy = mp.y + BALLAST_HEIGHT_MM;

      // Main track perpendicular
      const mPerpX = -mp.tz;
      const mPerpZ = mp.tx;

      let leftX: number, leftZ: number, rightX: number, rightZ: number;

      if (divPts && divCumDist && divTotalLen > 0) {
        // Find corresponding point on diverging branch
        const divDist = frac * divTotalLen;
        const dp = pointAtDist(divPts, divCumDist, divDist);
        const dPerpX = -dp.tz;
        const dPerpZ = dp.tx;

        // Determine which side the diverging branch is on
        // (check if diverging center is to the left or right of main track)
        const toDiv = { x: dp.x - mp.x, z: dp.z - mp.z };
        const cross = mPerpX * toDiv.z - mPerpZ * toDiv.x;
        // cross > 0 → div is to the right of main perp direction

        // Outer edge of main rail (side away from diverging)
        // Outer edge of diverging rail (side away from main)
        if (cross >= 0) {
          // Diverging is to the "right" — main left edge stays, div right edge extends
          leftX = mp.x + mPerpX * (halfGauge + RAIL_WIDTH_MM);
          leftZ = mp.z + mPerpZ * (halfGauge + RAIL_WIDTH_MM);
          rightX = dp.x - dPerpX * (halfGauge + RAIL_WIDTH_MM);
          rightZ = dp.z - dPerpZ * (halfGauge + RAIL_WIDTH_MM);
        } else {
          // Diverging is to the "left"
          leftX = dp.x + dPerpX * (halfGauge + RAIL_WIDTH_MM);
          leftZ = dp.z + dPerpZ * (halfGauge + RAIL_WIDTH_MM);
          rightX = mp.x - mPerpX * (halfGauge + RAIL_WIDTH_MM);
          rightZ = mp.z - mPerpZ * (halfGauge + RAIL_WIDTH_MM);
        }
      } else {
        // Simple track: standard symmetric sleeper
        const halfLen = sleeperLengthBase / 2;
        leftX = mp.x + mPerpX * halfLen;
        leftZ = mp.z + mPerpZ * halfLen;
        rightX = mp.x - mPerpX * halfLen;
        rightZ = mp.z - mPerpZ * halfLen;
      }

      // Sleeper direction (left → right)
      const sdx = rightX - leftX;
      const sdz = rightZ - leftZ;
      const sdLen = Math.hypot(sdx, sdz);
      const snx = sdLen > 0 ? sdx / sdLen : mPerpX;
      const snz = sdLen > 0 ? sdz / sdLen : mPerpZ;
      // Along-track direction for sleeper thickness
      const stx = -snz;
      const stz = snx;

      const base = s * 8;
      for (let dy = 0; dy <= 1; dy++) {
        const y = cy + dy * hh;
        sVerts.push(leftX + stx * halfW, y, leftZ + stz * halfW);
        sVerts.push(leftX - stx * halfW, y, leftZ - stz * halfW);
        sVerts.push(rightX - stx * halfW, y, rightZ - stz * halfW);
        sVerts.push(rightX + stx * halfW, y, rightZ + stz * halfW);
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
          <meshStandardMaterial color="#8b8171" roughness={0.9} />
        </mesh>
      ))}

      {/* Fan-shaped sleepers for turnouts, standard for simple tracks */}
      {sleeperGeom && (
        <mesh geometry={sleeperGeom} castShadow receiveShadow>
          <meshStandardMaterial color="#5a4a3a" roughness={0.8} />
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
  const pillars = useMemo(() => {
    if (centerPoints.length < 2) return [];
    const result: Array<{ x: number; y: number; z: number; height: number }> = [];
    const totalLen = centerPoints.reduce((acc, pt, i) => {
      if (i === 0) return 0;
      const prev = centerPoints[i - 1];
      return acc + Math.hypot(pt.x - prev.x, pt.z - prev.z);
    }, 0);

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
        <mesh key={i} position={[p.x, p.height / 2, p.z]} castShadow receiveShadow>
          <boxGeometry args={[pillarWidth, p.height, pillarWidth]} />
          <meshStandardMaterial color="#6a6a6a" roughness={0.6} />
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
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <hemisphereLight intensity={0.3} color="#a0a0a0" groundColor="#404040" />
      <directionalLight
        position={[board.width * 5, board.width * 8, board.depth * 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={[-board.width * 3, board.width * 5, -board.depth * 3]}
        intensity={0.3}
      />

      {/* Fog for depth cue */}
      <fog attach="fog" args={["#1a1a2e", boardDiagonal * 0.5, boardDiagonal * 3]} />

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
    <div className="h-full w-full" style={{ background: "#1a1a2e" }}>
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
