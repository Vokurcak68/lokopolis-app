"use client";

import React from "react";
import type { Vec3 } from "@/lib/track-library";

interface ConnectionIndicatorProps {
  position: Vec3;
  isSnapped: boolean;
}

export default function ConnectionIndicator({ position, isSnapped }: ConnectionIndicatorProps) {
  return (
    <mesh position={[position.x, position.y + 2, position.z]}>
      <sphereGeometry args={[1.5, 16, 16]} />
      <meshBasicMaterial
        color={isSnapped ? "#44ff44" : "#ff4444"}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}
