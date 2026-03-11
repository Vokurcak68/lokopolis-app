"use client";

import React, { useMemo } from "react";
import { Grid } from "@react-three/drei";
import * as THREE from "three";
import type { BoardShape, LCorner } from "@/lib/track-designer-store";

interface BoardBaseProps {
  /** Width in mm */
  width: number;
  /** Depth in mm */
  depth: number;
  /** Board shape */
  shape?: BoardShape;
  /** L-shape corner */
  lCorner?: LCorner;
  /** L-shape arm width in mm */
  lArmWidth?: number;
  /** L-shape arm depth in mm */
  lArmDepth?: number;
  /** U-shape arm depth in mm */
  uArmDepth?: number;
}

// ============================================================
// Procedural grass texture
// ============================================================

function createGrassTexture(size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base green
  ctx.fillStyle = "#3a5a3a";
  ctx.fillRect(0, 0, size, size);

  // Add noise/variation for grass look
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 30;
    data[i] = Math.max(0, Math.min(255, data[i] + noise * 0.5));       // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));     // G (more variation)
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.5)); // B
  }

  ctx.putImageData(imageData, 0, 0);

  // Add some darker patches
  for (let p = 0; p < 40; p++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 2 + Math.random() * 6;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30, 60, 30, ${0.2 + Math.random() * 0.3})`;
    ctx.fill();
  }

  // Add lighter spots
  for (let p = 0; p < 30; p++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 1 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80, 120, 60, ${0.1 + Math.random() * 0.2})`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

// ============================================================
// Board shape builder
// ============================================================

function buildBoardShape(
  width: number,
  depth: number,
  shape: BoardShape,
  lCorner?: LCorner,
  lArmWidth?: number,
  lArmDepth?: number,
  uArmDepth?: number,
): THREE.Shape {
  const s = new THREE.Shape();

  if (shape === "l-shape" && lArmWidth && lArmDepth) {
    const aw = lArmWidth;
    const ad = lArmDepth;

    switch (lCorner) {
      case "top-right":
        s.moveTo(0, 0);
        s.lineTo(width, 0);
        s.lineTo(width, depth);
        s.lineTo(width, depth + ad);
        s.lineTo(width - aw, depth + ad);
        s.lineTo(width - aw, depth);
        s.lineTo(0, depth);
        s.closePath();
        break;
      case "top-left":
        s.moveTo(0, 0);
        s.lineTo(width, 0);
        s.lineTo(width, depth);
        s.lineTo(aw, depth);
        s.lineTo(aw, depth + ad);
        s.lineTo(0, depth + ad);
        s.closePath();
        break;
      case "bottom-right":
        s.moveTo(0, 0);
        s.lineTo(width - aw, 0);
        s.lineTo(width - aw, -ad);
        s.lineTo(width, -ad);
        s.lineTo(width, depth);
        s.lineTo(0, depth);
        s.closePath();
        break;
      case "bottom-left":
        s.moveTo(0, -ad);
        s.lineTo(aw, -ad);
        s.lineTo(aw, 0);
        s.lineTo(width, 0);
        s.lineTo(width, depth);
        s.lineTo(0, depth);
        s.closePath();
        break;
      default:
        s.moveTo(0, 0);
        s.lineTo(width, 0);
        s.lineTo(width, depth + ad);
        s.lineTo(width - aw, depth + ad);
        s.lineTo(width - aw, depth);
        s.lineTo(0, depth);
        s.closePath();
        break;
    }
  } else if (shape === "u-shape" && uArmDepth) {
    const armWidth = Math.round(width / 3);
    const ad = uArmDepth;

    s.moveTo(0, 0);
    s.lineTo(width, 0);
    s.lineTo(width, depth + ad);
    s.lineTo(width - armWidth, depth + ad);
    s.lineTo(width - armWidth, depth);
    s.lineTo(armWidth, depth);
    s.lineTo(armWidth, depth + ad);
    s.lineTo(0, depth + ad);
    s.closePath();
  } else {
    s.moveTo(0, 0);
    s.lineTo(width, 0);
    s.lineTo(width, depth);
    s.lineTo(0, depth);
    s.closePath();
  }

  return s;
}

function getBoardBounds(
  width: number,
  depth: number,
  shape: BoardShape,
  lCorner?: LCorner,
  _lArmWidth?: number,
  lArmDepth?: number,
  uArmDepth?: number,
) {
  let minX = 0, minY = 0, maxX = width, maxY = depth;

  if (shape === "l-shape" && lArmDepth) {
    switch (lCorner) {
      case "top-right":
      case "top-left":
        maxY = depth + lArmDepth;
        break;
      case "bottom-right":
      case "bottom-left":
        minY = -lArmDepth;
        break;
    }
  } else if (shape === "u-shape" && uArmDepth) {
    maxY = depth + uArmDepth;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerZ: (minY + maxY) / 2,
    bbWidth: maxX - minX,
    bbDepth: maxY - minY,
  };
}

// ============================================================
// Wood frame edge material
// ============================================================

const FRAME_HEIGHT = 3; // mm tall frame edge
const FRAME_INSET = 2; // mm padding

export default function BoardBase({
  width,
  depth,
  shape = "rectangle",
  lCorner,
  lArmWidth,
  lArmDepth,
  uArmDepth,
}: BoardBaseProps) {
  const isCustomShape = shape === "l-shape" || shape === "u-shape";

  const bounds = useMemo(
    () => getBoardBounds(width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth),
    [width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth],
  );

  // Procedural grass texture
  const grassTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return createGrassTexture(256);
  }, []);

  // Custom shape geometries
  const boardGeometry = useMemo(() => {
    if (!isCustomShape) return null;
    const boardShape = buildBoardShape(width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth);
    return new THREE.ExtrudeGeometry(boardShape, { depth: 1, bevelEnabled: false });
  }, [width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth, isCustomShape]);

  // Frame geometry for custom shapes
  const frameGeometry = useMemo(() => {
    if (!isCustomShape) return null;
    const pad = FRAME_INSET;
    const frameShape = buildBoardShape(
      width + pad * 2,
      depth + (shape === "u-shape" ? 0 : pad * 2),
      shape,
      lCorner,
      lArmWidth ? lArmWidth + pad * 2 : undefined,
      lArmDepth ? lArmDepth + pad : undefined,
      uArmDepth ? uArmDepth + pad : undefined,
    );
    return new THREE.ExtrudeGeometry(frameShape, { depth: FRAME_HEIGHT, bevelEnabled: false });
  }, [width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth, isCustomShape]);

  if (isCustomShape) {
    return (
      <group>
        {/* Board frame (wood) */}
        {frameGeometry && (
          <mesh
            geometry={frameGeometry}
            position={[-FRAME_INSET, -FRAME_HEIGHT + 0.5, -FRAME_INSET]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <meshStandardMaterial color="#5a4030" roughness={0.8} />
          </mesh>
        )}

        {/* Green grass surface */}
        {boardGeometry && (
          <mesh
            geometry={boardGeometry}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            {grassTexture ? (
              <meshStandardMaterial map={grassTexture} roughness={0.9} />
            ) : (
              <meshStandardMaterial color="#3a5a3a" roughness={0.9} />
            )}
          </mesh>
        )}

        {/* Grid */}
        <Grid
          position={[bounds.centerX, 0.05, bounds.centerZ]}
          args={[bounds.bbWidth, bounds.bbDepth]}
          cellSize={50}
          cellThickness={0.5}
          cellColor="#4a6a4a"
          sectionSize={100}
          sectionThickness={1}
          sectionColor="#5a7a5a"
          fadeDistance={3000}
          infiniteGrid={false}
        />
      </group>
    );
  }

  // Default rectangle rendering
  return (
    <group>
      {/* Ground plane with grass */}
      <mesh position={[width / 2, -0.5, depth / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        {grassTexture ? (
          <meshStandardMaterial map={grassTexture} roughness={0.9} />
        ) : (
          <meshStandardMaterial color="#3a5a3a" roughness={0.9} />
        )}
      </mesh>

      {/* Board edge frame (raised wooden edge) */}
      {/* Bottom frame */}
      <mesh position={[width / 2, FRAME_HEIGHT / 2 - 0.5, -FRAME_INSET]} receiveShadow castShadow>
        <boxGeometry args={[width + FRAME_INSET * 2 + 4, FRAME_HEIGHT, 4]} />
        <meshStandardMaterial color="#5a4030" roughness={0.8} />
      </mesh>
      {/* Top frame */}
      <mesh position={[width / 2, FRAME_HEIGHT / 2 - 0.5, depth + FRAME_INSET]} receiveShadow castShadow>
        <boxGeometry args={[width + FRAME_INSET * 2 + 4, FRAME_HEIGHT, 4]} />
        <meshStandardMaterial color="#5a4030" roughness={0.8} />
      </mesh>
      {/* Left frame */}
      <mesh position={[-FRAME_INSET, FRAME_HEIGHT / 2 - 0.5, depth / 2]} receiveShadow castShadow>
        <boxGeometry args={[4, FRAME_HEIGHT, depth + FRAME_INSET * 2 + 4]} />
        <meshStandardMaterial color="#5a4030" roughness={0.8} />
      </mesh>
      {/* Right frame */}
      <mesh position={[width + FRAME_INSET, FRAME_HEIGHT / 2 - 0.5, depth / 2]} receiveShadow castShadow>
        <boxGeometry args={[4, FRAME_HEIGHT, depth + FRAME_INSET * 2 + 4]} />
        <meshStandardMaterial color="#5a4030" roughness={0.8} />
      </mesh>

      {/* Grid */}
      <Grid
        position={[width / 2, 0.05, depth / 2]}
        args={[width, depth]}
        cellSize={50}
        cellThickness={0.5}
        cellColor="#4a6a4a"
        sectionSize={100}
        sectionThickness={1}
        sectionColor="#5a7a5a"
        fadeDistance={3000}
        infiniteGrid={false}
      />
    </group>
  );
}
