"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import type { TrackPieceDefinition } from "@/lib/track-library";

// ============================================================
// Track geometry builders
// ============================================================
// IMPORTANT: Curves use manual sweep geometry, NOT ExtrudeGeometry.
// ExtrudeGeometry's Frenet frame tilts the rail profile on XZ-plane
// curves, causing twisted/misaligned rails. Manual sweep keeps Y-up.

const RAIL_GAUGE = 3; // mm between rails (visual)
const RAIL_WIDTH = 0.8;
const RAIL_HEIGHT = 1.2;
const SLEEPER_WIDTH = 8;
const SLEEPER_HEIGHT = 0.6;
const SLEEPER_DEPTH = 1.5;
const SLEEPER_SPACING = 12; // mm between sleepers

/** Build geometry for a straight rail at given Z offset */
function buildStraightRailGeo(length: number, zOffset: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(length, RAIL_HEIGHT, RAIL_WIDTH);
  geo.translate(length / 2, RAIL_HEIGHT / 2, zOffset);
  return geo;
}

/** Build merged sleepers for a straight track */
function buildStraightSleepers(length: number): THREE.BufferGeometry {
  const count = Math.max(1, Math.floor(length / SLEEPER_SPACING));
  const sleeperGeo = new THREE.BoxGeometry(SLEEPER_DEPTH, SLEEPER_HEIGHT, SLEEPER_WIDTH);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const basePos = sleeperGeo.attributes.position.array;
  const baseNorm = sleeperGeo.attributes.normal.array;
  const baseIdx = sleeperGeo.index!.array;

  for (let i = 0; i < count; i++) {
    const offset = (i * basePos.length) / 3;
    const x = ((i + 0.5) / count) * length;
    const mat = new THREE.Matrix4().makeTranslation(x, SLEEPER_HEIGHT / 2, 0);
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

/** Build geometry for a straight track piece */
function buildStraightGeometry(length: number) {
  const halfGauge = RAIL_GAUGE / 2;
  return {
    railLeft: buildStraightRailGeo(length, -halfGauge),
    railRight: buildStraightRailGeo(length, halfGauge),
    sleepers: buildStraightSleepers(length),
  };
}

/**
 * Build a curved rail by manual sweep — keeps profile always vertical (Y-up).
 * This avoids ExtrudeGeometry's Frenet frame tilt issue on XZ-plane curves.
 * 
 * Curve center is at (0, 0, radius). Rail sweeps from angle 0 to angleDeg.
 * @param radius - curve center radius
 * @param angleDeg - sweep angle in degrees
 * @param rOffset - radial offset from center radius (negative = inner, positive = outer)
 */
function buildCurvedRailGeo(radius: number, angleDeg: number, rOffset: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const r = radius + rOffset;
  const segments = Math.max(12, Math.ceil(angleDeg / 2));
  const hw = RAIL_WIDTH / 2;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angleRad;
    // Center point of rail cross-section at this angle
    const cx = r * Math.sin(t);
    const cz = r - r * Math.cos(t);
    // Radial direction (outward from curve center) in XZ
    const nx = Math.sin(t);
    const nz = -Math.cos(t);

    // 4 vertices per cross-section (rectangular profile, always vertical):
    // 0: bottom-inner, 1: bottom-outer, 2: top-outer, 3: top-inner
    positions.push(cx - nx * hw, 0,           cz - nz * hw);         // 0 bottom-inner
    positions.push(cx + nx * hw, 0,           cz + nz * hw);         // 1 bottom-outer
    positions.push(cx + nx * hw, RAIL_HEIGHT,  cz + nz * hw);         // 2 top-outer
    positions.push(cx - nx * hw, RAIL_HEIGHT,  cz - nz * hw);         // 3 top-inner

    if (i < segments) {
      const a = i * 4;
      const b = (i + 1) * 4;
      // Bottom face
      indices.push(a, b, b + 1, a, b + 1, a + 1);
      // Top face
      indices.push(a + 3, a + 2, b + 2, a + 3, b + 2, b + 3);
      // Outer face
      indices.push(a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
      // Inner face
      indices.push(a, a + 3, b + 3, a, b + 3, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Build merged sleepers for a curved track */
function buildCurvedSleepers(radius: number, angleDeg: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const arcLength = radius * angleRad;
  const count = Math.max(1, Math.floor(arcLength / SLEEPER_SPACING));
  const sleeperGeo = new THREE.BoxGeometry(SLEEPER_DEPTH, SLEEPER_HEIGHT, SLEEPER_WIDTH);
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
    const trans = new THREE.Matrix4().makeTranslation(x, SLEEPER_HEIGHT / 2, z);
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

/** Build geometry for a curved track piece */
function buildCurveGeometry(radius: number, angleDeg: number) {
  const halfGauge = RAIL_GAUGE / 2;
  return {
    railLeft: buildCurvedRailGeo(radius, angleDeg, -halfGauge),
    railRight: buildCurvedRailGeo(radius, angleDeg, halfGauge),
    sleepers: buildCurvedSleepers(radius, angleDeg),
  };
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
  isTunnel?: boolean;
  isBridge?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

const RAIL_COLOR = "#c0c0c0";
const SLEEPER_COLOR = "#6b4226";
const SELECTED_COLOR = "#f0a030";
const HOVERED_COLOR = "#80a0ff";
const TUNNEL_OPACITY = 0.4;

export default function TrackMesh({
  piece,
  position,
  rotation,
  elevation,
  isSelected,
  isHovered,
  isTunnel,
  isBridge,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: TrackMeshProps) {
  const geometries = useMemo(() => {
    if (piece.type === "straight" || piece.type === "turnout") {
      const mainGeo = buildStraightGeometry(piece.length || 100);
      if (piece.type === "turnout" && piece.angle && piece.radius) {
        const branchGeo = buildCurveGeometry(piece.radius, piece.angle);
        return { main: mainGeo, branch: branchGeo };
      }
      return { main: mainGeo };
    }
    if (piece.type === "curve") {
      return { main: buildCurveGeometry(piece.radius || 300, piece.angle || 30) };
    }
    if (piece.type === "crossing") {
      const mainGeo = buildStraightGeometry(piece.length || 100);
      return { main: mainGeo };
    }
    return { main: buildStraightGeometry(100) };
  }, [piece]);

  const railColor = isSelected ? SELECTED_COLOR : isHovered ? HOVERED_COLOR : RAIL_COLOR;
  const opacity = isTunnel ? TUNNEL_OPACITY : 1;
  const worldY = elevation;

  return (
    <group
      position={[position[0], worldY + position[1], position[2]]}
      rotation={[0, -rotation, 0]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerEnter={(e) => { e.stopPropagation(); onPointerEnter?.(); }}
      onPointerLeave={(e) => { e.stopPropagation(); onPointerLeave?.(); }}
    >
      {/* Main track */}
      <mesh geometry={geometries.main.railLeft}>
        <meshStandardMaterial color={railColor} metalness={0.7} roughness={0.3} transparent={isTunnel} opacity={opacity} />
      </mesh>
      <mesh geometry={geometries.main.railRight}>
        <meshStandardMaterial color={railColor} metalness={0.7} roughness={0.3} transparent={isTunnel} opacity={opacity} />
      </mesh>
      <mesh geometry={geometries.main.sleepers}>
        <meshStandardMaterial color={SLEEPER_COLOR} transparent={isTunnel} opacity={opacity} />
      </mesh>

      {/* Branch track (turnout) */}
      {geometries.branch && (
        <group scale={[1, 1, piece.direction === "right" ? -1 : 1]}>
          <mesh geometry={geometries.branch.railLeft}>
            <meshStandardMaterial color={railColor} metalness={0.7} roughness={0.3} transparent={isTunnel} opacity={opacity} />
          </mesh>
          <mesh geometry={geometries.branch.railRight}>
            <meshStandardMaterial color={railColor} metalness={0.7} roughness={0.3} transparent={isTunnel} opacity={opacity} />
          </mesh>
          <mesh geometry={geometries.branch.sleepers}>
            <meshStandardMaterial color={SLEEPER_COLOR} transparent={isTunnel} opacity={opacity} />
          </mesh>
        </group>
      )}

      {/* Bridge supports */}
      {isBridge && elevation > 5 && (
        <>
          {Array.from({ length: Math.max(1, Math.ceil((piece.length || 100) / 60)) }, (_, i) => {
            const x = ((i + 0.5) / Math.max(1, Math.ceil((piece.length || 100) / 60))) * (piece.length || 100);
            return (
              <mesh key={i} position={[x, -elevation / 2, 0]}>
                <boxGeometry args={[3, elevation, 3]} />
                <meshStandardMaterial color="#888888" />
              </mesh>
            );
          })}
        </>
      )}

      {/* Tunnel shell */}
      {isTunnel && (
        <mesh position={[(piece.length || 100) / 2, 10, 0]}>
          <boxGeometry args={[piece.length || 100, 20, 20]} />
          <meshStandardMaterial color="#4a3a2a" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Selection highlight */}
      {isSelected && (
        <mesh position={[(piece.length || 50) / 2, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[10, 12, 32]} />
          <meshBasicMaterial color={SELECTED_COLOR} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
