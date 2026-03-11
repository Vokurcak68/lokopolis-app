"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import BoardBase from "./BoardBase";
import TrackMesh from "./TrackMesh";
import ConnectionIndicator from "./ConnectionIndicator";
import type { TrackPieceDefinition } from "@/lib/track-library";
import type { PlacedTrack, DesignerAction, BoardShape, LCorner } from "@/lib/track-designer-store";
import {
  connectionToWorld,
  findFreeConnections,
  computeSnapPlacement,
  generateInstanceId,
} from "@/lib/track-designer-store";

// ============================================================
// Click handler for placing new tracks on the board
// ============================================================

interface PlacementHandlerProps {
  boardWidth: number;
  boardDepth: number;
  activePiece: TrackPieceDefinition | null;
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
  dispatch: React.Dispatch<DesignerAction>;
}

function PlacementHandler({ boardWidth, boardDepth, activePiece, tracks, catalog, dispatch }: PlacementHandlerProps) {
  const { raycaster, camera } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);

  const handleClick = useCallback(
    (e: THREE.Event) => {
      if (!activePiece) return;

      // @ts-expect-error R3F event
      const event = e as { point: THREE.Vector3; stopPropagation: () => void };
      event.stopPropagation();

      const clickPos = event.point;

      // Check if we can snap to an existing free connection
      const freeConns = findFreeConnections(tracks, catalog);
      let bestSnap: { position: { x: number; y: number; z: number }; rotation: number; fromInst: string; fromConn: string; toConn: string } | null = null;
      let bestDist = 30; // snap radius in mm

      for (const free of freeConns) {
        const dist = Math.sqrt(
          (clickPos.x - free.worldPos.x) ** 2 + (clickPos.z - free.worldPos.z) ** 2
        );
        if (dist < bestDist) {
          const snap = computeSnapPlacement(free.worldPos, free.worldAngle, activePiece, "a");
          if (snap) {
            bestDist = dist;
            bestSnap = {
              position: snap.position,
              rotation: snap.rotation,
              fromInst: free.instanceId,
              fromConn: free.connId,
              toConn: "a",
            };
          }
        }
      }

      const instanceId = generateInstanceId();

      if (bestSnap) {
        dispatch({
          type: "ADD_TRACK",
          track: {
            instanceId,
            pieceId: activePiece.id,
            position: bestSnap.position,
            rotation: bestSnap.rotation,
            elevation: 0,
            snappedConnections: { [bestSnap.toConn]: `${bestSnap.fromInst}:${bestSnap.fromConn}` },
          },
        });
        dispatch({
          type: "SNAP_CONNECTION",
          fromInstanceId: bestSnap.fromInst,
          fromConnId: bestSnap.fromConn,
          toInstanceId: instanceId,
          toConnId: bestSnap.toConn,
        });
      } else {
        dispatch({
          type: "ADD_TRACK",
          track: {
            instanceId,
            pieceId: activePiece.id,
            position: { x: clickPos.x, y: 0, z: clickPos.z },
            rotation: 0,
            elevation: 0,
            snappedConnections: {},
          },
        });
      }
    },
    [activePiece, tracks, catalog, dispatch]
  );

  return (
    <mesh
      ref={planeRef}
      position={[boardWidth / 2, 0, boardDepth / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      visible={false}
    >
      <planeGeometry args={[boardWidth + 200, boardDepth + 200]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

// ============================================================
// Main Scene Component
// ============================================================

interface Scene3DProps {
  boardWidth: number;
  boardDepth: number;
  boardShape?: BoardShape;
  lCorner?: LCorner;
  lArmWidth?: number;
  lArmDepth?: number;
  uArmDepth?: number;
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
  selectedTrackId: string | null;
  hoveredTrackId: string | null;
  activePiece: TrackPieceDefinition | null;
  dispatch: React.Dispatch<DesignerAction>;
}

export default function Scene3D({
  boardWidth,
  boardDepth,
  boardShape,
  lCorner,
  lArmWidth,
  lArmDepth,
  uArmDepth,
  tracks,
  catalog,
  selectedTrackId,
  hoveredTrackId,
  activePiece,
  dispatch,
}: Scene3DProps) {
  // Build catalog lookup
  const catalogMap = useMemo(() => {
    const map: Record<string, TrackPieceDefinition> = {};
    for (const piece of Object.values(catalog)) {
      if (Array.isArray(piece)) {
        for (const p of piece) map[p.id] = p;
      } else {
        map[piece.id] = piece;
      }
    }
    return map;
  }, [catalog]);

  // Free connections for indicators
  const freeConnections = useMemo(
    () => findFreeConnections(tracks, catalogMap),
    [tracks, catalogMap]
  );

  // Snapped connection positions for green indicators
  const snappedPositions = useMemo(() => {
    const positions: Array<{ x: number; y: number; z: number }> = [];
    for (const track of tracks) {
      const piece = catalogMap[track.pieceId];
      if (!piece) continue;
      for (const conn of piece.connections) {
        if (track.snappedConnections[conn.id]) {
          const world = connectionToWorld(conn, track.position, track.rotation);
          positions.push(world.position);
        }
      }
    }
    return positions;
  }, [tracks, catalogMap]);

  return (
    <Canvas
      style={{ width: "100%", height: "100%", background: "#0a0b14" }}
      shadows
      gl={{ antialias: true }}
    >
      <PerspectiveCamera
        makeDefault
        position={[boardWidth / 2, Math.max(boardWidth, boardDepth) * 0.8, boardDepth * 1.5]}
        fov={50}
        near={1}
        far={10000}
      />

      <OrbitControls
        target={[boardWidth / 2, 0, boardDepth / 2]}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={50}
        maxDistance={5000}
        enableDamping
        dampingFactor={0.1}
      />

      {/* === Enhanced Lighting === */}
      {/* Ambient fill */}
      <ambientLight intensity={0.3} color="#e8e0d8" />

      {/* Main sun light with shadows */}
      <directionalLight
        position={[boardWidth * 0.8, 600, boardDepth * 0.6]}
        intensity={1.0}
        color="#fff8e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={2000}
        shadow-camera-left={-boardWidth}
        shadow-camera-right={boardWidth}
        shadow-camera-top={boardDepth}
        shadow-camera-bottom={-boardDepth}
        shadow-bias={-0.001}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-boardWidth * 0.3, 400, -boardDepth * 0.3]}
        intensity={0.3}
        color="#c0d0ff"
      />

      {/* Sky/ground hemisphere light for ambient realism */}
      <hemisphereLight
        color="#87CEEB"
        groundColor="#3a5a3a"
        intensity={0.4}
      />

      {/* Subtle point light for warmth */}
      <pointLight
        position={[boardWidth / 2, 300, boardDepth / 2]}
        intensity={0.2}
        color="#ffe0a0"
        distance={2000}
        decay={2}
      />

      {/* Board */}
      <BoardBase
        width={boardWidth}
        depth={boardDepth}
        shape={boardShape}
        lCorner={lCorner}
        lArmWidth={lArmWidth}
        lArmDepth={lArmDepth}
        uArmDepth={uArmDepth}
      />

      {/* Placement handler (invisible click plane) */}
      <PlacementHandler
        boardWidth={boardWidth}
        boardDepth={boardDepth}
        activePiece={activePiece}
        tracks={tracks}
        catalog={catalogMap}
        dispatch={dispatch}
      />

      {/* Placed tracks */}
      {tracks.map((track) => {
        const piece = catalogMap[track.pieceId];
        if (!piece) return null;
        return (
          <TrackMesh
            key={track.instanceId}
            piece={piece}
            position={[track.position.x, track.position.y, track.position.z]}
            rotation={track.rotation}
            elevation={track.elevation}
            isSelected={selectedTrackId === track.instanceId}
            isHovered={hoveredTrackId === track.instanceId}
            isRamp={track.isRamp}
            isTunnel={track.isTunnel}
            isBridge={track.isBridge}
            onClick={() => dispatch({ type: "SELECT_TRACK", instanceId: track.instanceId })}
            onPointerEnter={() => dispatch({ type: "HOVER_TRACK", instanceId: track.instanceId })}
            onPointerLeave={() => dispatch({ type: "HOVER_TRACK", instanceId: null })}
          />
        );
      })}

      {/* Free connection indicators (red) */}
      {freeConnections.map((conn, i) => (
        <ConnectionIndicator
          key={`free-${i}`}
          position={conn.worldPos}
          isSnapped={false}
        />
      ))}

      {/* Snapped connection indicators (green) — only show unique positions */}
      {snappedPositions
        .filter((pos, i, arr) => arr.findIndex(p => Math.abs(p.x - pos.x) < 0.5 && Math.abs(p.z - pos.z) < 0.5) === i)
        .map((pos, i) => (
          <ConnectionIndicator
            key={`snap-${i}`}
            position={pos}
            isSnapped
          />
        ))}

      {/* Soft atmospheric fog */}
      <fog attach="fog" args={["#1a1b24", 1500, 6000]} />
    </Canvas>
  );
}
