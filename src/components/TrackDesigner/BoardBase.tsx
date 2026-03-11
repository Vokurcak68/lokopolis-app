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

/**
 * Build a THREE.Shape for the board outline.
 * Coordinates are in the XY plane (will be extruded along Z, then rotated to lie flat).
 *
 * Convention: the main rectangle spans (0,0) to (width, depth).
 * L-shape adds an arm in the chosen corner.
 * U-shape adds two symmetric arms on top.
 */
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
    // L-shape: main rectangle + one arm
    // The arm extends outward from the chosen corner.
    // We define the polygon so the bounding box origin is at (0, 0).
    const aw = lArmWidth;
    const ad = lArmDepth;

    switch (lCorner) {
      case "top-right":
        // Arm extends from top-right corner upward
        // Shape (CCW from bottom-left):
        // (0,0) -> (w,0) -> (w, d) -> (w, d+ad) -> (w-aw, d+ad) -> (w-aw, d) -> (0, d) -> close
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
        // Arm extends from top-left corner upward
        // (0,0) -> (w,0) -> (w,d) -> (aw,d) -> (aw, d+ad) -> (0, d+ad) -> close
        s.moveTo(0, 0);
        s.lineTo(width, 0);
        s.lineTo(width, depth);
        s.lineTo(aw, depth);
        s.lineTo(aw, depth + ad);
        s.lineTo(0, depth + ad);
        s.closePath();
        break;

      case "bottom-right":
        // Arm extends from bottom-right corner downward
        // (0,0) -> (w-aw, 0) -> (w-aw, -ad) -> (w, -ad) -> (w, d) -> (0, d) -> close
        s.moveTo(0, 0);
        s.lineTo(width - aw, 0);
        s.lineTo(width - aw, -ad);
        s.lineTo(width, -ad);
        s.lineTo(width, depth);
        s.lineTo(0, depth);
        s.closePath();
        break;

      case "bottom-left":
        // Arm extends from bottom-left corner downward
        // (0, -ad) -> (aw, -ad) -> (aw, 0) -> (w, 0) -> (w, d) -> (0, d) -> close
        s.moveTo(0, -ad);
        s.lineTo(aw, -ad);
        s.lineTo(aw, 0);
        s.lineTo(width, 0);
        s.lineTo(width, depth);
        s.lineTo(0, depth);
        s.closePath();
        break;

      default:
        // Default to top-right
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
    // U-shape: main rectangle + two arms extending upward from both top corners
    // The arm width is fixed to 1/3 of the main width (reasonable default)
    const armWidth = Math.round(width / 3);
    const ad = uArmDepth;

    // Shape (CCW from bottom-left):
    // (0,0) -> (w,0) -> (w, d) -> (w, d+ad) -> (w-armW, d+ad) -> (w-armW, d)
    //       -> (armW, d) -> (armW, d+ad) -> (0, d+ad) -> (0, d) -> close
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
    // Rectangle
    s.moveTo(0, 0);
    s.lineTo(width, 0);
    s.lineTo(width, depth);
    s.lineTo(0, depth);
    s.closePath();
  }

  return s;
}

/**
 * Compute bounding box of the board shape in mm.
 * Returns { minX, minY, maxX, maxY, centerX, centerZ, bbWidth, bbDepth }.
 * Note: Y in shape space = Z in 3D space.
 */
function getBoardBounds(
  width: number,
  depth: number,
  shape: BoardShape,
  lCorner?: LCorner,
  lArmWidth?: number,
  lArmDepth?: number,
  uArmDepth?: number,
) {
  let minX = 0, minY = 0, maxX = width, maxY = depth;

  if (shape === "l-shape" && lArmWidth && lArmDepth) {
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

  // Build Three.js shapes for custom board shapes
  const boardGeometry = useMemo(() => {
    if (!isCustomShape) return null;

    const boardShape = buildBoardShape(width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 1, // 1mm thick
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(boardShape, extrudeSettings);
  }, [width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth, isCustomShape]);

  // Frame geometry (slightly larger outline)
  const frameGeometry = useMemo(() => {
    if (!isCustomShape) return null;

    const pad = 2; // 2mm padding for frame
    const frameShape = buildBoardShape(
      width + pad * 2,
      depth + (shape === "u-shape" ? 0 : pad * 2),
      shape,
      lCorner,
      lArmWidth ? lArmWidth + pad * 2 : undefined,
      lArmDepth ? lArmDepth + pad : undefined,
      uArmDepth ? uArmDepth + pad : undefined,
    );

    // Offset the frame shape to account for padding
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 1,
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(frameShape, extrudeSettings);
  }, [width, depth, shape, lCorner, lArmWidth, lArmDepth, uArmDepth, isCustomShape]);

  if (isCustomShape) {
    // Custom shape rendering: extruded polygon
    return (
      <group>
        {/* Board frame (wood) — slightly larger, below the green surface */}
        {frameGeometry && (
          <mesh
            geometry={frameGeometry}
            position={[-2, -0.5, -2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial color="#5a4030" />
          </mesh>
        )}

        {/* Green surface */}
        {boardGeometry && (
          <mesh
            geometry={boardGeometry}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial color="#3a5a3a" />
          </mesh>
        )}

        {/* Grid — rectangular, covering the bounding box */}
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

  // Default rectangle rendering (unchanged)
  return (
    <group>
      {/* Ground plane */}
      <mesh position={[width / 2, -0.5, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#3a5a3a" />
      </mesh>

      {/* Board edge frame */}
      <mesh position={[width / 2, 0, depth / 2]}>
        <boxGeometry args={[width + 4, 1, depth + 4]} />
        <meshStandardMaterial color="#5a4030" />
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
