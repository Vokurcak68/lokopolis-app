"use client";

import React from "react";
import { Grid } from "@react-three/drei";

interface BoardBaseProps {
  /** Width in mm */
  width: number;
  /** Depth in mm */
  depth: number;
}

export default function BoardBase({ width, depth }: BoardBaseProps) {
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
