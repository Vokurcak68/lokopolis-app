"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import type { TrackPieceDefinition } from "@/lib/track-library";

// ============================================================
// Constants — realistic model railway dimensions
// ============================================================

// Rail gauge by scale (we use a visual gauge, slightly wider for visibility)
const GAUGE_TT = 12; // 12mm TT gauge
const GAUGE_H0 = 16.5; // 16.5mm H0 gauge
const DEFAULT_GAUGE = 12; // fallback

// Rail profile
const RAIL_WIDTH = 1.0;
const RAIL_HEIGHT = 1.5;

// Sleepers (ties)
const SLEEPER_SPACING = 15; // mm between sleepers
const SLEEPER_THICKNESS = 0.8; // height
const SLEEPER_WIDTH_MM = 2.0; // width along track direction

// Ballast bed
const BALLAST_HEIGHT = 0.5;

// Bridge
const BRIDGE_GIRDER_HEIGHT = 8;
const BRIDGE_GIRDER_WIDTH = 1.5;
const BRIDGE_PIER_SPACING = 80; // mm between piers
const BRIDGE_PIER_WIDTH = 4;
const BRIDGE_RAILING_HEIGHT = 6;
const BRIDGE_RAILING_WIDTH = 0.5;

// Tunnel
const TUNNEL_PORTAL_THICKNESS = 4;
const TUNNEL_RADIUS = 14;

// ============================================================
// Shared materials (created once, reused)
// ============================================================

const railMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
  metalness: 0.8,
  roughness: 0.3,
});
const railSelectedMaterial = new THREE.MeshStandardMaterial({
  color: 0xf0a030,
  metalness: 0.8,
  roughness: 0.3,
});
const railHoveredMaterial = new THREE.MeshStandardMaterial({
  color: 0x80a0ff,
  metalness: 0.8,
  roughness: 0.3,
});
const sleeperMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a3525,
});
const ballastMaterial = new THREE.MeshStandardMaterial({
  color: 0x707070,
  roughness: 0.9,
});
const bridgeGirderMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  metalness: 0.6,
  roughness: 0.4,
});
const bridgePierMaterial = new THREE.MeshStandardMaterial({
  color: 0x666666,
  roughness: 0.8,
});
const tunnelPortalMaterial = new THREE.MeshStandardMaterial({
  color: 0x6a6a6a,
  roughness: 0.9,
});
const tunnelShellMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a3a3a,
  transparent: true,
  opacity: 0.4,
  side: THREE.DoubleSide,
});
const tunnelRailMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
  metalness: 0.8,
  roughness: 0.3,
  transparent: true,
  opacity: 0.5,
});
const tunnelSleeperMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a3525,
  transparent: true,
  opacity: 0.5,
});

// ============================================================
// Geometry builders — STRAIGHT tracks
// ============================================================

function buildStraightRailGeo(length: number, zOffset: number): THREE.BufferGeometry {
  // T-shaped rail profile: patka (base) + stojina (web) + hlava (head)
  // Simplified as a box for performance
  const geo = new THREE.BoxGeometry(length, RAIL_HEIGHT, RAIL_WIDTH);
  geo.translate(length / 2, SLEEPER_THICKNESS + RAIL_HEIGHT / 2, zOffset);
  return geo;
}

function buildStraightSleepers(length: number, gauge: number): THREE.BufferGeometry {
  const sleeperLength = gauge + 6; // sleeper extends beyond rails
  const count = Math.max(1, Math.floor(length / SLEEPER_SPACING));
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const sleeperGeo = new THREE.BoxGeometry(SLEEPER_WIDTH_MM, SLEEPER_THICKNESS, sleeperLength);
  const basePos = sleeperGeo.attributes.position.array;
  const baseNorm = sleeperGeo.attributes.normal.array;
  const baseIdx = sleeperGeo.index!.array;

  for (let i = 0; i < count; i++) {
    const offset = (i * basePos.length) / 3;
    const x = ((i + 0.5) / count) * length;
    const mat = new THREE.Matrix4().makeTranslation(x, SLEEPER_THICKNESS / 2, 0);

    for (let j = 0; j < basePos.length; j += 3) {
      const v = new THREE.Vector3(basePos[j], basePos[j + 1], basePos[j + 2]).applyMatrix4(mat);
      positions.push(v.x, v.y, v.z);
    }
    for (let j = 0; j < baseNorm.length; j++) normals.push(baseNorm[j]);
    for (let j = 0; j < baseIdx.length; j++) indices.push(baseIdx[j] + offset);
  }

  sleeperGeo.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

function buildStraightBallast(length: number, gauge: number): THREE.BufferGeometry {
  const ballastWidth = gauge + 12;
  const geo = new THREE.BoxGeometry(length, BALLAST_HEIGHT, ballastWidth);
  geo.translate(length / 2, BALLAST_HEIGHT / 2 - 0.01, 0);
  return geo;
}

function buildStraightGeometry(length: number, gauge: number) {
  const halfGauge = gauge / 2;
  return {
    railLeft: buildStraightRailGeo(length, -halfGauge),
    railRight: buildStraightRailGeo(length, halfGauge),
    sleepers: buildStraightSleepers(length, gauge),
    ballast: buildStraightBallast(length, gauge),
  };
}

// ============================================================
// Geometry builders — CURVED tracks
// ============================================================

function buildCurvedRailGeo(radius: number, angleDeg: number, rOffset: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const r = radius + rOffset;
  const segments = Math.max(12, Math.ceil(angleDeg / 2));
  const hw = RAIL_WIDTH / 2;
  const yBase = SLEEPER_THICKNESS;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angleRad;
    const cx = r * Math.sin(t);
    const cz = r - r * Math.cos(t);
    const nx = Math.sin(t);
    const nz = -Math.cos(t);

    // 4 verts per cross-section
    positions.push(cx - nx * hw, yBase, cz - nz * hw);
    positions.push(cx + nx * hw, yBase, cz + nz * hw);
    positions.push(cx + nx * hw, yBase + RAIL_HEIGHT, cz + nz * hw);
    positions.push(cx - nx * hw, yBase + RAIL_HEIGHT, cz - nz * hw);

    if (i < segments) {
      const a = i * 4;
      const b = (i + 1) * 4;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
      indices.push(a + 3, a + 2, b + 2, a + 3, b + 2, b + 3);
      indices.push(a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
      indices.push(a, a + 3, b + 3, a, b + 3, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedSleepers(radius: number, angleDeg: number, gauge: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const arcLength = radius * angleRad;
  const count = Math.max(1, Math.floor(arcLength / SLEEPER_SPACING));
  const sleeperLength = gauge + 6;
  const sleeperGeo = new THREE.BoxGeometry(SLEEPER_WIDTH_MM, SLEEPER_THICKNESS, sleeperLength);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const basePos = sleeperGeo.attributes.position.array;
  const baseNorm = sleeperGeo.attributes.normal.array;
  const baseIdx = sleeperGeo.index!.array;

  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * angleRad;
    const x = radius * Math.sin(t);
    const z = radius - radius * Math.cos(t);
    const offset = (i * basePos.length) / 3;
    const rot = new THREE.Matrix4().makeRotationY(-t);
    const trans = new THREE.Matrix4().makeTranslation(x, SLEEPER_THICKNESS / 2, z);
    const mat = trans.multiply(rot);

    for (let j = 0; j < basePos.length; j += 3) {
      const v = new THREE.Vector3(basePos[j], basePos[j + 1], basePos[j + 2]).applyMatrix4(mat);
      positions.push(v.x, v.y, v.z);
    }
    for (let j = 0; j < baseNorm.length; j++) normals.push(baseNorm[j]);
    for (let j = 0; j < baseIdx.length; j++) indices.push(baseIdx[j] + offset);
  }

  sleeperGeo.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

function buildCurvedBallast(radius: number, angleDeg: number, gauge: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const ballastWidth = gauge + 12;
  const halfW = ballastWidth / 2;
  const segments = Math.max(8, Math.ceil(angleDeg / 3));
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angleRad;
    const cx = radius * Math.sin(t);
    const cz = radius - radius * Math.cos(t);
    const nx = Math.sin(t);
    const nz = -Math.cos(t);

    // 2 verts per cross-section (top of ballast, left and right)
    positions.push(cx - nx * halfW, BALLAST_HEIGHT, cz - nz * halfW);
    positions.push(cx + nx * halfW, BALLAST_HEIGHT, cz + nz * halfW);

    if (i < segments) {
      const a = i * 2;
      const b = (i + 1) * 2;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCurveGeometry(radius: number, angleDeg: number, gauge: number) {
  const halfGauge = gauge / 2;
  return {
    railLeft: buildCurvedRailGeo(radius, angleDeg, -halfGauge),
    railRight: buildCurvedRailGeo(radius, angleDeg, halfGauge),
    sleepers: buildCurvedSleepers(radius, angleDeg, gauge),
    ballast: buildCurvedBallast(radius, angleDeg, gauge),
  };
}

// ============================================================
// Bridge geometry
// ============================================================

function buildBridgeGirders(length: number, gauge: number, elevation: number): THREE.BufferGeometry {
  const halfW = (gauge + 10) / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const girderGeo = new THREE.BoxGeometry(length, BRIDGE_GIRDER_HEIGHT, BRIDGE_GIRDER_WIDTH);
  const basePos = girderGeo.attributes.position.array;
  const baseNorm = girderGeo.attributes.normal.array;
  const baseIdx = girderGeo.index!.array;

  // Two girders, one on each side
  for (const side of [-1, 1]) {
    const offset = (positions.length / 3);
    const mat = new THREE.Matrix4().makeTranslation(length / 2, BRIDGE_GIRDER_HEIGHT / 2 - 1, side * halfW);
    for (let j = 0; j < basePos.length; j += 3) {
      const v = new THREE.Vector3(basePos[j], basePos[j + 1], basePos[j + 2]).applyMatrix4(mat);
      positions.push(v.x, v.y, v.z);
    }
    for (let j = 0; j < baseNorm.length; j++) normals.push(baseNorm[j]);
    for (let j = 0; j < baseIdx.length; j++) indices.push(baseIdx[j] + offset);
  }

  girderGeo.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

// ============================================================
// Tunnel portal geometry (arch shape)
// ============================================================

function buildTunnelPortalGeo(): THREE.BufferGeometry {
  // Create an arch shape
  const width = TUNNEL_RADIUS * 2 + 4;
  const height = TUNNEL_RADIUS + 4;
  const shape = new THREE.Shape();

  // Outer arch
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height * 0.6);
  shape.absarc(0, height * 0.6, width / 2, Math.PI, 0, false);
  shape.lineTo(width / 2, 0);
  shape.lineTo(-width / 2, 0);

  // Inner hole (cut out)
  const hole = new THREE.Path();
  const innerW = TUNNEL_RADIUS;
  hole.moveTo(-innerW, 0);
  hole.lineTo(-innerW, height * 0.5);
  hole.absarc(0, height * 0.5, innerW, Math.PI, 0, false);
  hole.lineTo(innerW, 0);
  hole.lineTo(-innerW, 0);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: TUNNEL_PORTAL_THICKNESS,
    bevelEnabled: false,
  });

  return geo;
}

// ============================================================
// React Component
// ============================================================

interface TrackMeshProps {
  piece: TrackPieceDefinition;
  position: [number, number, number];
  rotation: number;
  elevation: number;
  isSelected?: boolean;
  isHovered?: boolean;
  isRamp?: boolean;
  isTunnel?: boolean;
  isBridge?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

function getGauge(piece: TrackPieceDefinition): number {
  if (piece.scale === "TT") return GAUGE_TT;
  if (piece.scale === "H0") return GAUGE_H0;
  return DEFAULT_GAUGE;
}

export default function TrackMesh({
  piece,
  position,
  rotation,
  elevation,
  isSelected,
  isHovered,
  isRamp,
  isTunnel,
  isBridge,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: TrackMeshProps) {
  const gauge = getGauge(piece);

  const geometries = useMemo(() => {
    if (piece.type === "straight" || piece.type === "turnout") {
      const mainGeo = buildStraightGeometry(piece.length || 100, gauge);
      if (piece.type === "turnout" && piece.angle && piece.radius) {
        const branchGeo = buildCurveGeometry(piece.radius, piece.angle, gauge);
        return { main: mainGeo, branch: branchGeo };
      }
      return { main: mainGeo };
    }
    if (piece.type === "curve") {
      return { main: buildCurveGeometry(piece.radius || 300, piece.angle || 30, gauge) };
    }
    if (piece.type === "crossing") {
      return { main: buildStraightGeometry(piece.length || 100, gauge) };
    }
    return { main: buildStraightGeometry(100, gauge) };
  }, [piece, gauge]);

  const bridgeGirders = useMemo(() => {
    if (!isBridge || !piece.length) return null;
    return buildBridgeGirders(piece.length, gauge, elevation);
  }, [isBridge, piece.length, gauge, elevation]);

  const tunnelPortal = useMemo(() => {
    if (!isTunnel) return null;
    return buildTunnelPortalGeo();
  }, [isTunnel]);

  const currentRailMat = isTunnel
    ? tunnelRailMaterial
    : isSelected
      ? railSelectedMaterial
      : isHovered
        ? railHoveredMaterial
        : railMaterial;

  const currentSleeperMat = isTunnel ? tunnelSleeperMaterial : sleeperMaterial;

  const worldY = elevation;
  const trackLength = piece.length || 100;

  // Bridge piers
  const pierCount = isBridge && elevation > 5
    ? Math.max(1, Math.ceil(trackLength / BRIDGE_PIER_SPACING))
    : 0;

  return (
    <group
      position={[position[0], worldY + position[1], position[2]]}
      rotation={[0, -rotation, 0]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerEnter={(e) => { e.stopPropagation(); onPointerEnter?.(); }}
      onPointerLeave={(e) => { e.stopPropagation(); onPointerLeave?.(); }}
    >
      {/* ===== Ballast bed ===== */}
      <mesh geometry={geometries.main.ballast} material={ballastMaterial} castShadow receiveShadow />

      {/* ===== Sleepers ===== */}
      <mesh geometry={geometries.main.sleepers} material={currentSleeperMat} castShadow receiveShadow />

      {/* ===== Rails ===== */}
      <mesh geometry={geometries.main.railLeft} material={currentRailMat} castShadow />
      <mesh geometry={geometries.main.railRight} material={currentRailMat} castShadow />

      {/* ===== Branch track (turnout) ===== */}
      {geometries.branch && (
        <group scale={[1, 1, piece.direction === "right" ? -1 : 1]}>
          <mesh geometry={geometries.branch.ballast} material={ballastMaterial} castShadow receiveShadow />
          <mesh geometry={geometries.branch.sleepers} material={currentSleeperMat} castShadow receiveShadow />
          <mesh geometry={geometries.branch.railLeft} material={currentRailMat} castShadow />
          <mesh geometry={geometries.branch.railRight} material={currentRailMat} castShadow />
        </group>
      )}

      {/* ===== Bridge girders ===== */}
      {isBridge && bridgeGirders && (
        <mesh geometry={bridgeGirders} material={bridgeGirderMaterial} castShadow />
      )}

      {/* ===== Bridge railings ===== */}
      {isBridge && elevation > 5 && (
        <>
          <mesh position={[trackLength / 2, BRIDGE_GIRDER_HEIGHT - 1 + BRIDGE_RAILING_HEIGHT / 2, -(gauge + 10) / 2]} castShadow>
            <boxGeometry args={[trackLength, BRIDGE_RAILING_HEIGHT, BRIDGE_RAILING_WIDTH]} />
            <meshStandardMaterial color="#555555" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[trackLength / 2, BRIDGE_GIRDER_HEIGHT - 1 + BRIDGE_RAILING_HEIGHT / 2, (gauge + 10) / 2]} castShadow>
            <boxGeometry args={[trackLength, BRIDGE_RAILING_HEIGHT, BRIDGE_RAILING_WIDTH]} />
            <meshStandardMaterial color="#555555" metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      )}

      {/* ===== Bridge piers (pillars) ===== */}
      {pierCount > 0 && Array.from({ length: pierCount }, (_, i) => {
        const x = ((i + 0.5) / pierCount) * trackLength;
        return (
          <mesh key={`pier-${i}`} position={[x, -elevation / 2, 0]} castShadow>
            <boxGeometry args={[BRIDGE_PIER_WIDTH, elevation, BRIDGE_PIER_WIDTH]} />
            <meshStandardMaterial color="#666666" roughness={0.8} />
          </mesh>
        );
      })}

      {/* ===== Tunnel portals ===== */}
      {isTunnel && tunnelPortal && (
        <>
          {/* Entry portal */}
          <mesh
            geometry={tunnelPortal}
            material={tunnelPortalMaterial}
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            castShadow
          />
          {/* Exit portal */}
          <mesh
            geometry={tunnelPortal}
            material={tunnelPortalMaterial}
            position={[trackLength, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            castShadow
          />
          {/* Tunnel shell (semi-transparent tube) */}
          <mesh position={[trackLength / 2, TUNNEL_RADIUS * 0.6, 0]}>
            <boxGeometry args={[trackLength - TUNNEL_PORTAL_THICKNESS * 2, TUNNEL_RADIUS * 1.5, TUNNEL_RADIUS * 2 + 4]} />
            <primitive object={tunnelShellMaterial} attach="material" />
          </mesh>
        </>
      )}

      {/* ===== Ramp embankment (nasypové těleso) ===== */}
      {isRamp && elevation > 2 && (
        <mesh position={[trackLength / 2, -elevation / 4, 0]} receiveShadow>
          <boxGeometry args={[trackLength, elevation / 2, gauge + 20 + elevation * 0.4]} />
          <meshStandardMaterial color="#8a7a60" roughness={0.95} />
        </mesh>
      )}

      {/* ===== Selection highlight ring ===== */}
      {isSelected && (
        <mesh position={[trackLength / 2, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[10, 12, 32]} />
          <meshBasicMaterial color="#f0a030" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
