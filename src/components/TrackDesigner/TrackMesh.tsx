"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import type { TrackPieceDefinition } from "@/lib/track-library";

// ============================================================
// Track geometry builders
// ============================================================

const RAIL_GAUGE = 3; // mm between rails (visual, not scale-accurate)
const RAIL_WIDTH = 0.8;
const RAIL_HEIGHT = 1.2;
const SLEEPER_WIDTH = 8;
const SLEEPER_HEIGHT = 0.6;
const SLEEPER_DEPTH = 1.5;
const SLEEPER_SPACING = 12; // mm between sleepers

/** Build a rail profile (cross section) */
function createRailProfile(): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = RAIL_WIDTH / 2;
  const hh = RAIL_HEIGHT / 2;
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();
  return shape;
}

/** Build geometry for a straight track piece */
function buildStraightGeometry(length: number): {
  railLeft: THREE.BufferGeometry;
  railRight: THREE.BufferGeometry;
  sleepers: THREE.BufferGeometry;
} {
  const railProfile = createRailProfile();
  const halfGauge = RAIL_GAUGE / 2;

  // Path for left rail
  const leftPath = new THREE.LineCurve3(
    new THREE.Vector3(0, RAIL_HEIGHT / 2, -halfGauge),
    new THREE.Vector3(length, RAIL_HEIGHT / 2, -halfGauge)
  );
  const rightPath = new THREE.LineCurve3(
    new THREE.Vector3(0, RAIL_HEIGHT / 2, halfGauge),
    new THREE.Vector3(length, RAIL_HEIGHT / 2, halfGauge)
  );

  const extrudeSettings = {
    steps: 2,
    bevelEnabled: false,
    extrudePath: leftPath,
  };

  const railLeft = new THREE.ExtrudeGeometry(railProfile, extrudeSettings);
  const railRight = new THREE.ExtrudeGeometry(railProfile, {
    ...extrudeSettings,
    extrudePath: rightPath,
  });

  // Sleepers as merged box geometries
  const sleeperCount = Math.max(1, Math.floor(length / SLEEPER_SPACING));
  const sleeperGeo = new THREE.BoxGeometry(SLEEPER_DEPTH, SLEEPER_HEIGHT, SLEEPER_WIDTH);
  const merged = new THREE.BufferGeometry();
  const matrices: THREE.Matrix4[] = [];
  for (let i = 0; i < sleeperCount; i++) {
    const t = (i + 0.5) / sleeperCount;
    const x = t * length;
    const mat = new THREE.Matrix4().makeTranslation(x, SLEEPER_HEIGHT / 2, 0);
    matrices.push(mat);
  }
  // Merge sleepers into instanced or merged geometry
  const sleeperPositions: number[] = [];
  const sleeperNormals: number[] = [];
  const sleeperIndices: number[] = [];
  const basePositions = sleeperGeo.attributes.position.array;
  const baseNormals = sleeperGeo.attributes.normal.array;
  const baseIndex = sleeperGeo.index!.array;

  for (let i = 0; i < matrices.length; i++) {
    const offset = (i * basePositions.length) / 3;
    const mat = matrices[i];
    for (let j = 0; j < basePositions.length; j += 3) {
      const v = new THREE.Vector3(basePositions[j], basePositions[j + 1], basePositions[j + 2]);
      v.applyMatrix4(mat);
      sleeperPositions.push(v.x, v.y, v.z);
    }
    for (let j = 0; j < baseNormals.length; j++) {
      sleeperNormals.push(baseNormals[j]);
    }
    for (let j = 0; j < baseIndex.length; j++) {
      sleeperIndices.push(baseIndex[j] + offset);
    }
  }

  merged.setAttribute("position", new THREE.Float32BufferAttribute(sleeperPositions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(sleeperNormals, 3));
  merged.setIndex(sleeperIndices);

  sleeperGeo.dispose();

  return { railLeft, railRight, sleepers: merged };
}

/** Build geometry for a curved track piece */
function buildCurveGeometry(radius: number, angleDeg: number): {
  railLeft: THREE.BufferGeometry;
  railRight: THREE.BufferGeometry;
  sleepers: THREE.BufferGeometry;
} {
  const angleRad = (angleDeg * Math.PI) / 180;
  const halfGauge = RAIL_GAUGE / 2;
  const segments = Math.max(8, Math.ceil(angleDeg / 3));
  const railProfile = createRailProfile();

  // Build curve paths - curve bends to the left (positive Z direction)
  // Center of curvature is at (0, 0, radius)
  function makeCurvePath(r: number, yOffset: number): THREE.CurvePath<THREE.Vector3> {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * angleRad;
      const x = r * Math.sin(t);
      const z = r - r * Math.cos(t);
      // Offset perpendicular to curve direction
      // Tangent direction at angle t: (cos(t), 0, sin(t))
      // Normal (inward): (sin(t), 0, -cos(t))... but we want lateral offset
      points.push(new THREE.Vector3(x, yOffset, z));
    }
    const curvePath = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < points.length - 1; i++) {
      curvePath.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }
    return curvePath;
  }

  // Inner rail (smaller radius) and outer rail (larger radius)
  const innerPath = makeCurvePath(radius - halfGauge, RAIL_HEIGHT / 2);
  const outerPath = makeCurvePath(radius + halfGauge, RAIL_HEIGHT / 2);

  const railLeft = new THREE.ExtrudeGeometry(railProfile, {
    steps: segments,
    bevelEnabled: false,
    extrudePath: innerPath,
  });
  const railRight = new THREE.ExtrudeGeometry(railProfile, {
    steps: segments,
    bevelEnabled: false,
    extrudePath: outerPath,
  });

  // Sleepers along the curve
  const arcLength = radius * angleRad;
  const sleeperCount = Math.max(1, Math.floor(arcLength / SLEEPER_SPACING));
  const sleeperGeo = new THREE.BoxGeometry(SLEEPER_DEPTH, SLEEPER_HEIGHT, SLEEPER_WIDTH);
  const sleeperPositions: number[] = [];
  const sleeperNormals: number[] = [];
  const sleeperIndices: number[] = [];
  const basePositions = sleeperGeo.attributes.position.array;
  const baseNormals = sleeperGeo.attributes.normal.array;
  const baseIndex = sleeperGeo.index!.array;

  for (let i = 0; i < sleeperCount; i++) {
    const t = ((i + 0.5) / sleeperCount) * angleRad;
    const x = radius * Math.sin(t);
    const z = radius - radius * Math.cos(t);
    const offset = (i * basePositions.length) / 3;
    // Rotation: sleeper should be perpendicular to track direction
    const rot = new THREE.Matrix4().makeRotationY(-t);
    const trans = new THREE.Matrix4().makeTranslation(x, SLEEPER_HEIGHT / 2, z);
    const mat = trans.multiply(rot);

    for (let j = 0; j < basePositions.length; j += 3) {
      const v = new THREE.Vector3(basePositions[j], basePositions[j + 1], basePositions[j + 2]);
      v.applyMatrix4(mat);
      sleeperPositions.push(v.x, v.y, v.z);
    }
    for (let j = 0; j < baseNormals.length; j++) {
      sleeperNormals.push(baseNormals[j]);
    }
    for (let j = 0; j < baseIndex.length; j++) {
      sleeperIndices.push(baseIndex[j] + offset);
    }
  }

  const sleepers = new THREE.BufferGeometry();
  sleepers.setAttribute("position", new THREE.Float32BufferAttribute(sleeperPositions, 3));
  sleepers.setAttribute("normal", new THREE.Float32BufferAttribute(sleeperNormals, 3));
  sleepers.setIndex(sleeperIndices);
  sleeperGeo.dispose();

  return { railLeft, railRight, sleepers };
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

  // Convert mm to scene units (1mm = 1 unit in scene, but we'll scale the whole scene)
  const worldY = elevation;

  return (
    <group
      position={[position[0], worldY + position[1], position[2]]}
      rotation={[0, rotation, 0]}
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

      {/* Tunnel shell (simple box over track) */}
      {isTunnel && (
        <mesh position={[(piece.length || 100) / 2, 10, 0]}>
          <boxGeometry args={[piece.length || 100, 20, 20]} />
          <meshStandardMaterial color="#4a3a2a" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Selection highlight ring */}
      {isSelected && (
        <mesh position={[(piece.length || 50) / 2, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[10, 12, 32]} />
          <meshBasicMaterial color={SELECTED_COLOR} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
