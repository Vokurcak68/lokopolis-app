"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
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

const SLEEPER_SPACING_MM = 15; // distance between sleepers
const RAIL_WIDTH_MM = 0.8;
const RAIL_HEIGHT_MM = 1.2;
const SLEEPER_WIDTH_MM = 2;
const SLEEPER_LENGTH_FACTOR = 2.2; // factor of gauge
const BALLAST_WIDTH_FACTOR = 2.8; // factor of gauge
const BALLAST_HEIGHT_MM = 1.5;

// ── Helpers ──

/** Get elevation at a given track+t, interpolating from elevation points */
function getElevationAt(
  trackId: string,
  t: number,
  elevationPoints: ElevationPoint[],
  tracks: PlacedTrack[],
): number {
  // Get all elevation points for this track, sorted by t
  const pts = elevationPoints
    .filter((ep) => ep.trackId === trackId)
    .sort((a, b) => a.t - b.t);

  if (pts.length === 0) {
    // Check connected tracks for elevation hints
    const track = tracks.find((tr) => tr.instanceId === trackId);
    if (!track) return 0;
    
    // Check if any connected track has elevation points
    for (const [, snapTarget] of Object.entries(track.snappedConnections)) {
      const [targetId] = snapTarget.split(":");
      const connPts = elevationPoints.filter((ep) => ep.trackId === targetId);
      if (connPts.length > 0) {
        // Use the nearest endpoint elevation from connected track
        // Simple approach: return average of connected track's boundary elevations
        const boundaryPts = connPts.filter((p) => p.t <= 0.05 || p.t >= 0.95);
        if (boundaryPts.length > 0) {
          return boundaryPts[0].elevation;
        }
      }
    }
    return 0;
  }

  if (pts.length === 1) return pts[0].elevation;

  // Interpolate between points
  if (t <= pts[0].t) return pts[0].elevation;
  if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].elevation;

  for (let i = 0; i < pts.length - 1; i++) {
    if (t >= pts[i].t && t <= pts[i + 1].t) {
      const frac = (t - pts[i].t) / (pts[i + 1].t - pts[i].t);
      return pts[i].elevation + frac * (pts[i + 1].elevation - pts[i].elevation);
    }
  }

  return 0;
}

/** Sample a segment in world space with elevation, returning 3D points */
function sampleSegmentWorld3D(
  seg: PathSegment,
  track: PlacedTrack,
  elevationPoints: ElevationPoint[],
  tracks: PlacedTrack[],
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

    const elev = getElevationAt(track.instanceId, t, elevationPoints, tracks);

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
  const shape = useMemo(() => {
    const boardPath = getBoardPathMm(board);
    const s = new THREE.Shape();
    if (boardPath.length === 0) return s;

    // Board path is in mm (x, z) — map to Three.js (x, z) plane
    s.moveTo(boardPath[0].x, boardPath[0].z);
    for (let i = 1; i < boardPath.length; i++) {
      s.lineTo(boardPath[i].x, boardPath[i].z);
    }
    s.closePath();
    return s;
  }, [board]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <extrudeGeometry args={[shape, { depth: 1, bevelEnabled: false }]} />
      <meshStandardMaterial color="#8b9a7b" side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Single track piece 3D ──

function TrackPiece3D({
  track,
  piece,
  elevationPoints,
  tracks,
}: {
  track: PlacedTrack;
  piece: TrackPieceDefinition;
  elevationPoints: ElevationPoint[];
  tracks: PlacedTrack[];
}) {
  const gaugeMm = getGaugeMm(piece.scale);
  const halfGauge = gaugeMm / 2;

  const geometry = useMemo(() => {
    const segments = getPieceSegmentsLocal(piece);
    const railLeftPoints: THREE.Vector3[] = [];
    const railRightPoints: THREE.Vector3[] = [];
    const centerPoints: Array<{ x: number; y: number; z: number; tangentX: number; tangentZ: number }> = [];

    for (const seg of segments) {
      const pts = sampleSegmentWorld3D(seg, track, elevationPoints, tracks, 5);
      centerPoints.push(...pts);
    }

    // Build rail paths offset by half gauge perpendicular to tangent
    for (const pt of centerPoints) {
      // Perpendicular in xz plane (left = -tanZ, tanX)
      const perpX = -pt.tangentZ;
      const perpZ = pt.tangentX;

      railLeftPoints.push(new THREE.Vector3(
        pt.x + perpX * halfGauge,
        pt.y + BALLAST_HEIGHT_MM + SLEEPER_WIDTH_MM,
        pt.z + perpZ * halfGauge,
      ));
      railRightPoints.push(new THREE.Vector3(
        pt.x - perpX * halfGauge,
        pt.y + BALLAST_HEIGHT_MM + SLEEPER_WIDTH_MM,
        pt.z - perpZ * halfGauge,
      ));
    }

    return { railLeftPoints, railRightPoints, centerPoints };
  }, [track, piece, elevationPoints, tracks, halfGauge]);

  // Create rail tube geometry
  const railLeftGeom = useMemo(() => {
    if (geometry.railLeftPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(geometry.railLeftPoints, false, "centripetal", 0.1);
    return new THREE.TubeGeometry(curve, geometry.railLeftPoints.length * 2, RAIL_WIDTH_MM / 2, 4, false);
  }, [geometry.railLeftPoints]);

  const railRightGeom = useMemo(() => {
    if (geometry.railRightPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(geometry.railRightPoints, false, "centripetal", 0.1);
    return new THREE.TubeGeometry(curve, geometry.railRightPoints.length * 2, RAIL_WIDTH_MM / 2, 4, false);
  }, [geometry.railRightPoints]);

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
        position: [pt.x, pt.y + BALLAST_HEIGHT_MM + SLEEPER_WIDTH_MM / 2, pt.z],
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
          <boxGeometry args={[SLEEPER_WIDTH_MM, SLEEPER_WIDTH_MM * 0.6, sleeperLength]} />
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

function Scene({ tracks, catalog, board, elevationPoints, terrainZones }: TrackViewer3DProps) {
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
            elevationPoints={elevationPoints}
            tracks={tracks}
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
