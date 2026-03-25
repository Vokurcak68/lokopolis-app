"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignerState, PlacedTrack } from "@/lib/track-designer-store";
import type { TrackPieceDefinition } from "@/lib/track-library";
import {
  distancePointToTrackMm,
  renderTrackCanvas,
  type LocalPoint,
  type ViewTransform,
} from "@/lib/track-canvas-renderer";

interface TrackCanvasProps {
  state: DesignerState;
  catalog: Record<string, TrackPieceDefinition>;
  activePiece: TrackPieceDefinition | null;
  transform: ViewTransform;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onTransformChange: (fn: (prev: ViewTransform) => ViewTransform) => void;
  onSetSelectedTrack: (instanceId: string | null) => void;
  onSetHoveredTrack: (instanceId: string | null) => void;
  onPlaceTrack: (piece: TrackPieceDefinition, worldX: number, worldZ: number, preferredRotation?: number) => void;
  onDeactivatePiece: () => void;
  onUpdateTrack: (instanceId: string, updates: Partial<PlacedTrack>) => void;
  onSnapDraggedTrack: (track: PlacedTrack) => PlacedTrack;
}

function screenToWorld(x: number, y: number, t: ViewTransform): LocalPoint {
  return {
    x: (x - t.offsetX) / t.zoom,
    z: (y - t.offsetY) / t.zoom,
  };
}

function worldToScreen(x: number, z: number, t: ViewTransform) {
  return {
    x: t.offsetX + x * t.zoom,
    y: t.offsetY + z * t.zoom,
  };
}

export function TrackCanvas({
  state,
  catalog,
  activePiece,
  transform,
  canvasRef,
  onTransformChange,
  onSetSelectedTrack,
  onSetHoveredTrack,
  onPlaceTrack,
  onUpdateTrack,
  onSnapDraggedTrack,
  onDeactivatePiece,
}: TrackCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 700 });

  const interactionRef = useRef<{
    mode: "none" | "pan" | "drag";
    pointerId: number | null;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    dragTrackId: string | null;
    dragStartWorld: LocalPoint | null;
    dragTrackStartPos: { x: number; z: number } | null;
    isSpacePressed: boolean;
    pinchDistance: number | null;
    pinchCenter: { x: number; y: number } | null;
    touchPoints: Map<number, { x: number; y: number }>;
  }>({
    mode: "none",
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    dragTrackId: null,
    dragStartWorld: null,
    dragTrackStartPos: null,
    isSpacePressed: false,
    pinchDistance: null,
    pinchCenter: null,
    touchPoints: new Map(),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") interactionRef.current.isSpacePressed = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") interactionRef.current.isSpacePressed = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: Math.max(320, rect.width), height: Math.max(280, rect.height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const raf = requestAnimationFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTrackCanvas({
        ctx,
        width: size.width,
        height: size.height,
        board: state.board,
        tracks: state.tracks,
        catalog,
        selectedTrackId: state.selectedTrackId,
        hoveredTrackId: state.hoveredTrackId,
        transform,
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [canvasRef, catalog, size.height, size.width, state.board, state.hoveredTrackId, state.selectedTrackId, state.tracks, transform]);

  const hitTrack = (world: LocalPoint): PlacedTrack | null => {
    let best: PlacedTrack | null = null;
    let min = Infinity;
    for (const tr of state.tracks) {
      const piece = catalog[tr.pieceId];
      if (!piece) continue;
      const d = distancePointToTrackMm(world, tr, piece);
      if (d < min) {
        min = d;
        best = tr;
      }
    }

    if (min < 20) return best;
    return null;
  };

  const zoomAt = (screenX: number, screenY: number, factor: number) => {
    onTransformChange((prev) => {
      const nextZoom = Math.max(0.12, Math.min(2.8, prev.zoom * factor));
      const worldBefore = screenToWorld(screenX, screenY, prev);
      return {
        zoom: nextZoom,
        offsetX: screenX - worldBefore.x * nextZoom,
        offsetY: screenY - worldBefore.z * nextZoom,
      };
    });
  };

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const inter = interactionRef.current;
    inter.touchPoints.set(e.pointerId, { x, y });

    if (e.pointerType === "touch" && inter.touchPoints.size >= 2) {
      const points = [...inter.touchPoints.values()];
      const p1 = points[0];
      const p2 = points[1];
      inter.pinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      inter.pinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      inter.mode = "pan";
      inter.startOffsetX = transform.offsetX;
      inter.startOffsetY = transform.offsetY;
      return;
    }

    const world = screenToWorld(x, y, transform);
    const rightOrMiddle = e.button === 1 || e.button === 2;

    // Single finger touch without active piece = PAN
    if (e.pointerType === "touch" && inter.touchPoints.size === 1 && !activePiece) {
      inter.mode = "pan";
      inter.pointerId = e.pointerId;
      inter.startX = x;
      inter.startY = y;
      inter.startOffsetX = transform.offsetX;
      inter.startOffsetY = transform.offsetY;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (rightOrMiddle || inter.isSpacePressed) {
      inter.mode = "pan";
      inter.pointerId = e.pointerId;
      inter.startX = x;
      inter.startY = y;
      inter.startOffsetX = transform.offsetX;
      inter.startOffsetY = transform.offsetY;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const hit = hitTrack(world);
    if (hit && !activePiece) {
      onSetSelectedTrack(hit.instanceId);
      inter.mode = "drag";
      inter.pointerId = e.pointerId;
      inter.dragTrackId = hit.instanceId;
      inter.dragStartWorld = world;
      inter.dragTrackStartPos = { x: hit.position.x, z: hit.position.z };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (activePiece) {
      onPlaceTrack(activePiece, world.x, world.z, 0);
      // Deactivate piece after placing unless Shift is held (for repeated placement)
      if (!e.shiftKey) {
        onDeactivatePiece();
      }
      return;
    }

    onSetSelectedTrack(null);
  };

  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const inter = interactionRef.current;
    if (inter.touchPoints.has(e.pointerId)) inter.touchPoints.set(e.pointerId, { x, y });

    if (e.pointerType === "touch" && inter.touchPoints.size >= 2 && inter.pinchDistance && inter.pinchCenter) {
      const points = [...inter.touchPoints.values()];
      const p1 = points[0];
      const p2 = points[1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const factor = dist / inter.pinchDistance;
      if (Math.abs(factor - 1) > 0.01) {
        zoomAt(inter.pinchCenter.x, inter.pinchCenter.y, factor);
        inter.pinchDistance = dist;
      }
      return;
    }

    if (inter.mode === "pan" && inter.pointerId === e.pointerId) {
      const dx = x - inter.startX;
      const dy = y - inter.startY;
      onTransformChange((prev) => ({ ...prev, offsetX: inter.startOffsetX + dx, offsetY: inter.startOffsetY + dy }));
      return;
    }

    if (inter.mode === "drag" && inter.pointerId === e.pointerId && inter.dragTrackId && inter.dragStartWorld && inter.dragTrackStartPos) {
      const world = screenToWorld(x, y, transform);
      const dx = world.x - inter.dragStartWorld.x;
      const dz = world.z - inter.dragStartWorld.z;
      onUpdateTrack(inter.dragTrackId, {
        position: {
          x: inter.dragTrackStartPos.x + dx,
          y: 0,
          z: inter.dragTrackStartPos.z + dz,
        },
      });
      return;
    }

    const world = screenToWorld(x, y, transform);
    const hit = hitTrack(world);
    onSetHoveredTrack(hit?.instanceId ?? null);
  };

  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const inter = interactionRef.current;
    inter.touchPoints.delete(e.pointerId);

    if (inter.mode === "drag" && inter.dragTrackId) {
      const current = state.tracks.find((t) => t.instanceId === inter.dragTrackId);
      if (current) {
        const snapped = onSnapDraggedTrack(current);
        onUpdateTrack(current.instanceId, { position: snapped.position, rotation: snapped.rotation });
      }
    }

    inter.mode = "none";
    inter.pointerId = null;
    inter.dragTrackId = null;
    inter.dragStartWorld = null;
    inter.dragTrackStartPos = null;
    inter.pinchDistance = null;
    inter.pinchCenter = null;
  };

  const onWheel: React.WheelEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.shiftKey && state.selectedTrackId) {
      const dir = e.deltaY > 0 ? 1 : -1;
      const current = state.tracks.find((t) => t.instanceId === state.selectedTrackId);
      if (!current) return;
      onUpdateTrack(current.instanceId, {
        rotation: current.rotation + dir * ((15 * Math.PI) / 180),
      });
      return;
    }

    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    zoomAt(x, y, factor);
  };

  const onContextMenu: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
  };

  const boardBottomRight = worldToScreen(state.board.width * 10, state.board.depth * 10, transform);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: "var(--bg-page)" }}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-manipulation"
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />

      <div
        className="pointer-events-none absolute left-3 top-3 rounded-md border px-2 py-1 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-dim)" }}
      >
        Pan: pravé/prostřední tlačítko nebo mezerník + tah | Zoom: kolečko/pinch | Rotace: Shift+scroll
      </div>

      <div
        className="pointer-events-none absolute rounded border px-2 py-1 text-xs"
        style={{
          left: Math.max(8, boardBottomRight.x - 80),
          top: Math.max(8, boardBottomRight.y + 8),
          borderColor: "var(--border)",
          background: "var(--bg-card)",
          color: "var(--text-dim)",
        }}
      >
        Deska {state.board.width}×{state.board.depth} cm
      </div>
    </div>
  );
}
