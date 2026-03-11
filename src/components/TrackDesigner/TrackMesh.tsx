"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import type { TrackPieceDefinition } from "@/lib/track-library";

// ============================================================
// Constants — realistic model railway dimensions
// ============================================================

const GAUGE_TT = 12;
const GAUGE_H0 = 16.5;
const DEFAULT_GAUGE = 12;

// Rail T-profile dimensions (mm)
const RAIL_FOOT_WIDTH = 1.5;
const RAIL_FOOT_HEIGHT = 0.3;
const RAIL_WEB_WIDTH = 0.5;
const RAIL_WEB_HEIGHT = 0.8;
const RAIL_HEAD_WIDTH = 1.0;
const RAIL_HEAD_HEIGHT = 0.3;
const RAIL_TOTAL_HEIGHT = RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT + RAIL_HEAD_HEIGHT; // 1.4mm

// Sleepers
const SLEEPER_SPACING_TT = 10;
const SLEEPER_SPACING_H0 = 13;
const SLEEPER_HEIGHT = 1.0;

// Ballast bed
const BALLAST_HEIGHT = 1.5;
const BALLAST_EXTRA_WIDTH = 16; // total extra beyond gauge (8mm each side)

// Bridge
const BRIDGE_GIRDER_HEIGHT = 10;
const BRIDGE_TRUSS_BAR_RADIUS = 0.6;
const BRIDGE_PIER_WIDTH = 5;
const BRIDGE_PIER_SPACING = 80;
const BRIDGE_RAILING_HEIGHT = 4;

// Tunnel
const TUNNEL_PORTAL_THICKNESS = 5;

// ============================================================
// Shared materials (module-level, created once)
// ============================================================

const railMaterial = new THREE.MeshStandardMaterial({
  color: 0x808080,
  metalness: 0.85,
  roughness: 0.25,
});
const railSelectedMaterial = new THREE.MeshStandardMaterial({
  color: 0xf0a030,
  metalness: 0.85,
  roughness: 0.25,
});
const railHoveredMaterial = new THREE.MeshStandardMaterial({
  color: 0x80a0ff,
  metalness: 0.85,
  roughness: 0.25,
});
const sleeperMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a2a1a,
  roughness: 0.8,
});
const ballastMaterial = new THREE.MeshStandardMaterial({
  color: 0x6a6060,
  roughness: 0.9,
});
const bridgeMaterial = new THREE.MeshStandardMaterial({
  color: 0x505050,
  metalness: 0.6,
  roughness: 0.4,
});
const bridgePierMaterial = new THREE.MeshStandardMaterial({
  color: 0x666666,
  roughness: 0.8,
});
const tunnelPortalMaterial = new THREE.MeshStandardMaterial({
  color: 0x5a5a5a,
  roughness: 0.85,
});
const tunnelShellMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
});
const tunnelRailMaterial = new THREE.MeshStandardMaterial({
  color: 0x808080,
  metalness: 0.85,
  roughness: 0.25,
  transparent: true,
  opacity: 0.5,
});
const tunnelSleeperMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a2a1a,
  transparent: true,
  opacity: 0.5,
});
const bridgeFloorMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a,
  metalness: 0.3,
  roughness: 0.6,
  side: THREE.DoubleSide,
});

// ============================================================
// Rail T-profile shape (2D cross-section)
// ============================================================

function createRailProfileShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const fw = RAIL_FOOT_WIDTH / 2;
  const ww = RAIL_WEB_WIDTH / 2;
  const hw = RAIL_HEAD_WIDTH / 2;

  // Start at bottom-left of foot
  shape.moveTo(-fw, 0);
  shape.lineTo(fw, 0);
  shape.lineTo(fw, RAIL_FOOT_HEIGHT);
  shape.lineTo(ww, RAIL_FOOT_HEIGHT);
  shape.lineTo(ww, RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT);
  shape.lineTo(hw, RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT);
  shape.lineTo(hw, RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT + RAIL_HEAD_HEIGHT);
  shape.lineTo(-hw, RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT + RAIL_HEAD_HEIGHT);
  shape.lineTo(-hw, RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT);
  shape.lineTo(-ww, RAIL_FOOT_HEIGHT + RAIL_WEB_HEIGHT);
  shape.lineTo(-ww, RAIL_FOOT_HEIGHT);
  shape.lineTo(-fw, RAIL_FOOT_HEIGHT);
  shape.closePath();

  return shape;
}

// Cached rail profile shape
const _railProfile = createRailProfileShape();

// ============================================================
// Straight rail geometry — extrude T-profile along X axis
// ============================================================

function buildStraightRailGeo(length: number, zOffset: number): THREE.BufferGeometry {
  // Extrude the T-profile along the track direction (X axis)
  // ExtrudeGeometry extrudes along Z, so we rotate after
  const geo = new THREE.ExtrudeGeometry(_railProfile, {
    depth: length,
    bevelEnabled: false,
    steps: 1,
  });
  // Rotate so extrusion goes along X: swap Z->X
  // The extruded shape is in XY plane, extruded along Z
  // We need it in ZY plane extruded along X
  // Rotate -90° around Y
  geo.rotateY(-Math.PI / 2);
  // Now the rail runs from x=-length to x=0. Translate so it starts at x=0
  geo.translate(length, SLEEPER_HEIGHT, zOffset);

  return geo;
}

// ============================================================
// Straight sleeper geometry (merged into one BufferGeometry)
// ============================================================

function buildStraightSleepers(length: number, gauge: number, scale: string): THREE.BufferGeometry {
  const spacing = scale === "H0" ? SLEEPER_SPACING_H0 : SLEEPER_SPACING_TT;
  const sleeperLength = gauge + 8;
  const sleeperWidth = scale === "H0" ? 2.5 : 2.0;
  const count = Math.max(1, Math.floor(length / spacing));

  const singleSleeper = new THREE.BoxGeometry(sleeperWidth, SLEEPER_HEIGHT, sleeperLength);
  const basePos = singleSleeper.attributes.position.array as Float32Array;
  const baseNorm = singleSleeper.attributes.normal.array as Float32Array;
  const baseIdx = singleSleeper.index!.array;
  const vertCount = basePos.length / 3;

  const positions = new Float32Array(count * basePos.length);
  const normals = new Float32Array(count * baseNorm.length);
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count) * length;
    const vOff = i * vertCount;

    for (let j = 0; j < basePos.length; j += 3) {
      positions[i * basePos.length + j] = basePos[j] + x;
      positions[i * basePos.length + j + 1] = basePos[j + 1] + SLEEPER_HEIGHT / 2;
      positions[i * basePos.length + j + 2] = basePos[j + 2];
    }
    normals.set(baseNorm, i * baseNorm.length);
    for (let j = 0; j < baseIdx.length; j++) {
      indices.push(baseIdx[j] + vOff);
    }
  }

  singleSleeper.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

// ============================================================
// Straight ballast — trapezoidal profile (lichoběžník)
// ============================================================

function buildStraightBallast(length: number, gauge: number): THREE.BufferGeometry {
  const topWidth = gauge + BALLAST_EXTRA_WIDTH;
  const bottomWidth = topWidth + 4; // wider at bottom
  const halfTop = topWidth / 2;
  const halfBot = bottomWidth / 2;
  const h = BALLAST_HEIGHT;

  // Trapezoidal cross-section extruded along X
  // Cross-section in YZ plane: bottom wider, top narrower
  const positions = new Float32Array([
    // x=0 face
    0, 0, -halfBot,
    0, 0, halfBot,
    0, h, halfTop,
    0, h, -halfTop,
    // x=length face
    length, 0, -halfBot,
    length, 0, halfBot,
    length, h, halfTop,
    length, h, -halfTop,
  ]);

  const indices = [
    // front (x=0)
    0, 3, 2, 0, 2, 1,
    // back (x=length)
    4, 6, 7, 4, 5, 6,
    // top
    3, 7, 6, 3, 6, 2,
    // bottom
    0, 1, 5, 0, 5, 4,
    // left (z<0)
    0, 4, 7, 0, 7, 3,
    // right (z>0)
    1, 2, 6, 1, 6, 5,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.translate(0, -0.01, 0);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// Combine straight track
// ============================================================

function buildStraightGeometry(length: number, gauge: number, scale: string) {
  const halfGauge = gauge / 2;
  return {
    railLeft: buildStraightRailGeo(length, -halfGauge),
    railRight: buildStraightRailGeo(length, halfGauge),
    sleepers: buildStraightSleepers(length, gauge, scale),
    ballast: buildStraightBallast(length, gauge),
  };
}

// ============================================================
// Curved rail — discrete segments along arc (NO ExtrudeGeometry with CurvePath!)
// ============================================================

function buildCurvedRailGeo(radius: number, angleDeg: number, rOffset: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const r = radius + rOffset;
  const segDeg = 2; // degrees per segment
  const segments = Math.max(6, Math.ceil(angleDeg / segDeg));

  // T-profile cross-section vertices (in local YZ space, centered at Z=0)
  const fw = RAIL_FOOT_WIDTH / 2;
  const ww = RAIL_WEB_WIDTH / 2;
  const hw = RAIL_HEAD_WIDTH / 2;
  const fh = RAIL_FOOT_HEIGHT;
  const wh = RAIL_WEB_HEIGHT;
  const hh = RAIL_HEAD_HEIGHT;

  // Cross-section points (Y, Z_local) — forming the T shape
  // Going clockwise from bottom-left
  const profile: [number, number][] = [
    [0, -fw],
    [0, fw],
    [fh, fw],
    [fh, ww],
    [fh + wh, ww],
    [fh + wh, hw],
    [fh + wh + hh, hw],
    [fh + wh + hh, -hw],
    [fh + wh, -hw],
    [fh + wh, -ww],
    [fh, -ww],
    [fh, -fw],
  ];

  const profLen = profile.length;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angleRad;
    const cx = r * Math.sin(t);
    const cz = r - r * Math.cos(t);
    // Tangent direction (perpendicular to radius at this point)
    const nx = Math.cos(t);  // normal in X
    const nz = Math.sin(t);  // normal in Z

    for (let p = 0; p < profLen; p++) {
      const [py, pz] = profile[p];
      // pz is the cross-rail offset, py is height
      positions.push(
        cx + nz * pz,
        SLEEPER_HEIGHT + py,
        cz - nx * pz,
      );
    }

    if (i < segments) {
      const a = i * profLen;
      const b = (i + 1) * profLen;
      for (let p = 0; p < profLen; p++) {
        const p2 = (p + 1) % profLen;
        indices.push(a + p, b + p, b + p2);
        indices.push(a + p, b + p2, a + p2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// Curved sleepers
// ============================================================

function buildCurvedSleepers(radius: number, angleDeg: number, gauge: number, scale: string): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const spacing = scale === "H0" ? SLEEPER_SPACING_H0 : SLEEPER_SPACING_TT;
  const arcLength = radius * angleRad;
  const count = Math.max(1, Math.floor(arcLength / spacing));
  const sleeperLength = gauge + 8;
  const sleeperWidth = scale === "H0" ? 2.5 : 2.0;

  const singleSleeper = new THREE.BoxGeometry(sleeperWidth, SLEEPER_HEIGHT, sleeperLength);
  const basePos = singleSleeper.attributes.position.array as Float32Array;
  const baseNorm = singleSleeper.attributes.normal.array as Float32Array;
  const baseIdx = singleSleeper.index!.array;
  const vertCount = basePos.length / 3;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const mat4 = new THREE.Matrix4();
  const nMat = new THREE.Matrix3();

  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * angleRad;
    const x = radius * Math.sin(t);
    const z = radius - radius * Math.cos(t);
    const vOff = i * vertCount;

    // Rotation: sleeper perpendicular to track tangent
    const rot = new THREE.Matrix4().makeRotationY(-t);
    const trans = new THREE.Matrix4().makeTranslation(x, SLEEPER_HEIGHT / 2, z);
    mat4.copy(trans).multiply(rot);
    nMat.setFromMatrix4(rot);

    for (let j = 0; j < basePos.length; j += 3) {
      const v = new THREE.Vector3(basePos[j], basePos[j + 1], basePos[j + 2]).applyMatrix4(mat4);
      positions.push(v.x, v.y, v.z);
    }
    for (let j = 0; j < baseNorm.length; j += 3) {
      const n = new THREE.Vector3(baseNorm[j], baseNorm[j + 1], baseNorm[j + 2]).applyMatrix3(nMat).normalize();
      normals.push(n.x, n.y, n.z);
    }
    for (let j = 0; j < baseIdx.length; j++) {
      indices.push(baseIdx[j] + vOff);
    }
  }

  singleSleeper.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

// ============================================================
// Curved ballast — trapezoidal profile along arc
// ============================================================

function buildCurvedBallast(radius: number, angleDeg: number, gauge: number): THREE.BufferGeometry {
  const angleRad = (angleDeg * Math.PI) / 180;
  const topWidth = gauge + BALLAST_EXTRA_WIDTH;
  const bottomWidth = topWidth + 4;
  const halfTop = topWidth / 2;
  const halfBot = bottomWidth / 2;
  const h = BALLAST_HEIGHT;
  const segments = Math.max(8, Math.ceil(angleDeg / 3));

  const positions: number[] = [];
  const indices: number[] = [];

  // 4 verts per cross-section: bottom-left, bottom-right, top-right, top-left
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angleRad;
    const cx = radius * Math.sin(t);
    const cz = radius - radius * Math.cos(t);
    const nx = Math.cos(t);
    const nz = Math.sin(t);

    // bottom-left, bottom-right, top-right, top-left
    positions.push(cx + nz * (-halfBot), -0.01, cz - nx * (-halfBot));
    positions.push(cx + nz * halfBot, -0.01, cz - nx * halfBot);
    positions.push(cx + nz * halfTop, h - 0.01, cz - nx * halfTop);
    positions.push(cx + nz * (-halfTop), h - 0.01, cz - nx * (-halfTop));

    if (i < segments) {
      const a = i * 4;
      const b = (i + 1) * 4;
      // top face
      indices.push(a + 3, b + 3, b + 2, a + 3, b + 2, a + 2);
      // bottom face
      indices.push(a, a + 1, b + 1, a, b + 1, b);
      // left side
      indices.push(a, b, b + 3, a, b + 3, a + 3);
      // right side
      indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
    }
  }

  // Cap at start (i=0)
  indices.push(0, 3, 2, 0, 2, 1);
  // Cap at end
  const e = segments * 4;
  indices.push(e, e + 1, e + 2, e, e + 2, e + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// Combine curved track
// ============================================================

function buildCurveGeometry(radius: number, angleDeg: number, gauge: number, scale: string) {
  const halfGauge = gauge / 2;
  return {
    railLeft: buildCurvedRailGeo(radius, angleDeg, -halfGauge),
    railRight: buildCurvedRailGeo(radius, angleDeg, halfGauge),
    sleepers: buildCurvedSleepers(radius, angleDeg, gauge, scale),
    ballast: buildCurvedBallast(radius, angleDeg, gauge),
  };
}

// ============================================================
// Bridge geometry — truss bridge with diagonals
// ============================================================

function buildBridgeTruss(length: number, gauge: number): {
  girders: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
  railings: THREE.BufferGeometry;
} {
  const halfW = (gauge + 12) / 2;
  const barRadius = BRIDGE_TRUSS_BAR_RADIUS;
  const height = BRIDGE_GIRDER_HEIGHT;
  const panelCount = Math.max(2, Math.ceil(length / 20));
  const panelLength = length / panelCount;

  // Build truss as merged cylinders
  const geoArray: THREE.BufferGeometry[] = [];
  const cylSegments = 6; // low-poly cylinders for performance

  for (const side of [-1, 1]) {
    const z = side * halfW;

    for (let i = 0; i <= panelCount; i++) {
      const x = i * panelLength;
      // Vertical post
      const vert = new THREE.CylinderGeometry(barRadius, barRadius, height, cylSegments);
      vert.translate(x, height / 2 - 1, z);
      geoArray.push(vert);
    }

    // Top chord
    const topBar = new THREE.CylinderGeometry(barRadius, barRadius, length, cylSegments);
    topBar.rotateZ(Math.PI / 2);
    topBar.translate(length / 2, height - 1, z);
    geoArray.push(topBar);

    // Bottom chord
    const botBar = new THREE.CylinderGeometry(barRadius, barRadius, length, cylSegments);
    botBar.rotateZ(Math.PI / 2);
    botBar.translate(length / 2, -1, z);
    geoArray.push(botBar);

    // Diagonals (X-pattern in each panel)
    for (let i = 0; i < panelCount; i++) {
      const x0 = i * panelLength;
      const x1 = (i + 1) * panelLength;
      const diagLen = Math.sqrt(panelLength ** 2 + height ** 2);
      const diagAngle = Math.atan2(height, panelLength);

      const diag1 = new THREE.CylinderGeometry(barRadius * 0.7, barRadius * 0.7, diagLen, cylSegments);
      diag1.rotateZ(Math.PI / 2 - diagAngle);
      diag1.translate((x0 + x1) / 2, height / 2 - 1, z);
      geoArray.push(diag1);

      // Reverse diagonal
      const diag2 = new THREE.CylinderGeometry(barRadius * 0.7, barRadius * 0.7, diagLen, cylSegments);
      diag2.rotateZ(Math.PI / 2 + diagAngle);
      diag2.translate((x0 + x1) / 2, height / 2 - 1, z);
      geoArray.push(diag2);
    }
  }

  // Merge all girder geometries
  const girders = mergeGeometries(geoArray);
  geoArray.forEach(g => g.dispose());

  // Bridge floor
  const floor = new THREE.PlaneGeometry(length, gauge + 12);
  floor.rotateX(-Math.PI / 2);
  floor.translate(length / 2, -0.5, 0);

  // Railings on top
  const railingGeos: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const z = side * halfW;
    const rail = new THREE.CylinderGeometry(barRadius * 0.5, barRadius * 0.5, length, cylSegments);
    rail.rotateZ(Math.PI / 2);
    rail.translate(length / 2, height - 1 + BRIDGE_RAILING_HEIGHT, z);
    railingGeos.push(rail);

    // Railing posts
    const postCount = Math.max(2, Math.ceil(length / 15));
    for (let i = 0; i <= postCount; i++) {
      const x = (i / postCount) * length;
      const post = new THREE.CylinderGeometry(barRadius * 0.4, barRadius * 0.4, BRIDGE_RAILING_HEIGHT, cylSegments);
      post.translate(x, height - 1 + BRIDGE_RAILING_HEIGHT / 2, z);
      railingGeos.push(post);
    }
  }
  const railings = mergeGeometries(railingGeos);
  railingGeos.forEach(g => g.dispose());

  return { girders, floor, railings };
}

// ============================================================
// Tunnel portal geometry — stone arch
// ============================================================

function buildTunnelPortalGeo(gauge: number, scale: string): THREE.BufferGeometry {
  const portalWidth = gauge + 20;
  const portalHeight = scale === "H0" ? 40 : 30;
  const halfW = portalWidth / 2;
  const archRadius = halfW;
  const wallHeight = portalHeight - archRadius;
  const thickness = TUNNEL_PORTAL_THICKNESS;
  const stoneW = portalWidth + 10;
  const stoneH = portalHeight + 4;

  // Build an arch shape with a hole
  const outerShape = new THREE.Shape();
  const halfStoneW = stoneW / 2;

  // Outer contour
  outerShape.moveTo(-halfStoneW, 0);
  outerShape.lineTo(halfStoneW, 0);
  outerShape.lineTo(halfStoneW, wallHeight);
  outerShape.absarc(0, wallHeight, halfStoneW, 0, Math.PI, false);
  outerShape.lineTo(-halfStoneW, 0);

  // Inner hole (tunnel opening)
  const hole = new THREE.Path();
  hole.moveTo(-halfW, 0);
  hole.lineTo(halfW, 0);
  hole.lineTo(halfW, wallHeight);
  hole.absarc(0, wallHeight, archRadius, 0, Math.PI, false);
  hole.lineTo(-halfW, 0);
  outerShape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(outerShape, {
    depth: thickness,
    bevelEnabled: false,
  });

  return geo;
}

// ============================================================
// Merge BufferGeometries helper
// ============================================================

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;

  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];

  let vertOffset = 0;

  for (const g of geometries) {
    // Ensure normals exist
    if (!g.attributes.normal) {
      g.computeVertexNormals();
    }

    const pos = g.attributes.position.array;
    const norm = g.attributes.normal ? g.attributes.normal.array : new Float32Array(pos.length);
    const idx = g.index ? g.index.array : null;
    const vCount = g.attributes.position.count;

    positions.set(pos, vertOffset * 3);
    normals.set(norm, vertOffset * 3);

    if (idx) {
      for (let i = 0; i < idx.length; i++) {
        indices.push(idx[i] + vertOffset);
      }
    }

    vertOffset += vCount;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
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
  const scale = piece.scale || "TT";

  // ===== Main track geometries =====
  const geometries = useMemo(() => {
    if (piece.type === "straight" || piece.type === "turnout") {
      const mainGeo = buildStraightGeometry(piece.length || 100, gauge, scale);
      if (piece.type === "turnout" && piece.angle && piece.radius) {
        const branchGeo = buildCurveGeometry(piece.radius, piece.angle, gauge, scale);
        return { main: mainGeo, branch: branchGeo };
      }
      return { main: mainGeo };
    }
    if (piece.type === "curve") {
      return { main: buildCurveGeometry(piece.radius || 300, piece.angle || 30, gauge, scale) };
    }
    if (piece.type === "crossing") {
      return { main: buildStraightGeometry(piece.length || 100, gauge, scale) };
    }
    return { main: buildStraightGeometry(100, gauge, scale) };
  }, [piece, gauge, scale]);

  // ===== Bridge geometry =====
  const bridgeGeo = useMemo(() => {
    if (!isBridge || !piece.length) return null;
    return buildBridgeTruss(piece.length, gauge);
  }, [isBridge, piece.length, gauge]);

  // ===== Tunnel portal geometry =====
  const tunnelPortal = useMemo(() => {
    if (!isTunnel) return null;
    return buildTunnelPortalGeo(gauge, scale);
  }, [isTunnel, gauge, scale]);

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

      {/* ===== Rails (T-profile) ===== */}
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

      {/* ===== Crossing second track ===== */}
      {piece.type === "crossing" && (
        <group rotation={[0, -(piece.angle || 30) * Math.PI / 180, 0]}
               position={[trackLength / 2, 0, 0]}>
          <group position={[-trackLength / 2, 0, 0]}>
            <mesh geometry={geometries.main.railLeft} material={currentRailMat} castShadow />
            <mesh geometry={geometries.main.railRight} material={currentRailMat} castShadow />
          </group>
        </group>
      )}

      {/* ===== Bridge truss ===== */}
      {isBridge && bridgeGeo && (
        <>
          <mesh geometry={bridgeGeo.girders} material={bridgeMaterial} castShadow />
          <mesh geometry={bridgeGeo.floor} material={bridgeFloorMaterial} receiveShadow />
          <mesh geometry={bridgeGeo.railings} material={bridgeMaterial} castShadow />
        </>
      )}

      {/* ===== Bridge piers ===== */}
      {pierCount > 0 && Array.from({ length: pierCount }, (_, i) => {
        const x = ((i + 0.5) / pierCount) * trackLength;
        return (
          <mesh key={`pier-${i}`} position={[x, -elevation / 2, 0]} castShadow>
            <boxGeometry args={[BRIDGE_PIER_WIDTH, elevation, BRIDGE_PIER_WIDTH]} />
            <primitive object={bridgePierMaterial} attach="material" />
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
          <mesh position={[trackLength / 2, (gauge + 20) * 0.4, 0]}>
            <boxGeometry args={[
              trackLength - TUNNEL_PORTAL_THICKNESS * 2,
              (piece.scale === "H0" ? 40 : 30) * 0.8,
              gauge + 22,
            ]} />
            <primitive object={tunnelShellMaterial} attach="material" />
          </mesh>
        </>
      )}

      {/* ===== Ramp embankment ===== */}
      {isRamp && elevation > 2 && (
        <mesh position={[trackLength / 2, -elevation / 4, 0]} receiveShadow>
          <boxGeometry args={[trackLength, elevation / 2, gauge + 20 + elevation * 0.4]} />
          <meshStandardMaterial color="#8a7a60" roughness={0.95} />
        </mesh>
      )}

      {/* ===== Selection highlight ===== */}
      {isSelected && (
        <mesh position={[trackLength / 2, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[10, 12, 32]} />
          <meshBasicMaterial color="#f0a030" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
