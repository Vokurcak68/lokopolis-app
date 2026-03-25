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
  terrainMode: boolean;
  selectedZoneId: string | null;
  placementRotation: number;
  onTransformChange: (fn: (prev: ViewTransform) => ViewTransform) => void;
  onSetSelectedTrack: (instanceId: string | null) => void;
  onToggleSelectTrack: (instanceId: string) => void;
  onSelectTracks: (instanceIds: string[]) => void;
  onMoveSelectedTracks: (dx: number, dz: number) => void;
  onHitTestTerrainZone: (worldX: number, worldZ: number) => string | null;
  onSetSelectedZone: (zoneId: string | null) => void;
  onSetHoveredTrack: (instanceId: string | null) => void;
  onPlaceTrack: (piece: TrackPieceDefinition, worldX: number, worldZ: number, preferredRotation?: number) => void;
  onPlaceTerrainPoint: (worldX: number, worldZ: number) => boolean;
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
  terrainMode,
  selectedZoneId,
  placementRotation,
  onTransformChange,
  onSetSelectedTrack,
  onToggleSelectTrack,
  onSelectTracks,
  onMoveSelectedTracks,
  onHitTestTerrainZone,
  onSetSelectedZone,
  onSetHoveredTrack,
  onPlaceTrack,
  onPlaceTerrainPoint,
  onUpdateTrack,
  onSnapDraggedTrack,
  onDeactivatePiece,
}: TrackCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 700 });
  const [mouseWorld, setMouseWorld] = useState<LocalPoint | null>(null);

  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const interactionRef = useRef<{
    mode: "none" | "pan" | "drag" | "group-drag" | "marquee" | "touch-pending";
    pointerId: number | null;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    dragTrackId: string | null;
    dragStartWorld: LocalPoint | null;
    dragTrackStartPos: { x: number; z: number } | null;
    /** Group drag: starting positions of all selected tracks */
    groupDragStarts: Map<string, { x: number; z: number }>;
    isSpacePressed: boolean;
    pinchDistance: number | null;
    pinchCenter: { x: number; y: number } | null;
    touchPoints: Map<number, { x: number; y: number }>;
    touchStartTime: number;
    touchMoved: boolean;
    ctrlOrShift: boolean;
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
    groupDragStarts: new Map(),
    isSpacePressed: false,
    pinchDistance: null,
    pinchCenter: null,
    touchPoints: new Map(),
    touchStartTime: 0,
    touchMoved: false,
    ctrlOrShift: false,
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
        terrainZones: state.terrainZones ?? [],
        catalog,
        selectedTrackId: state.selectedTrackId,
        selectedTrackIds: state.selectedTrackIds,
        hoveredTrackId: state.hoveredTrackId,
        transform,
      });

      // Ghost preview of piece being placed
      if (activePiece && mouseWorld) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        const ghostTrack: PlacedTrack = {
          instanceId: "__ghost__",
          pieceId: activePiece.id,
          position: { x: mouseWorld.x, y: 0, z: mouseWorld.z },
          rotation: placementRotation,
          elevation: 0,
          snappedConnections: {},
        };
        renderTrackCanvas({
          ctx,
          width: size.width,
          height: size.height,
          board: state.board,
          tracks: [ghostTrack],
          terrainZones: [],
          catalog,
          selectedTrackId: null,
          hoveredTrackId: null,
          transform,
          skipBackground: true,
        });
        ctx.restore();
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [activePiece, canvasRef, catalog, mouseWorld, placementRotation, size.height, size.width, state.board, state.hoveredTrackId, state.selectedTrackId, state.selectedTrackIds, state.tracks, state.terrainZones, transform]);

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

    // Single finger touch without active piece = wait to decide (tap vs pan)
    if (e.pointerType === "touch" && inter.touchPoints.size === 1 && !activePiece) {
      inter.mode = "touch-pending";
      inter.pointerId = e.pointerId;
      inter.startX = x;
      inter.startY = y;
      inter.startOffsetX = transform.offsetX;
      inter.startOffsetY = transform.offsetY;
      inter.touchStartTime = Date.now();
      inter.touchMoved = false;
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

    // Terrain zone placement mode — click places portal
    if (terrainMode) {
      const handled = onPlaceTerrainPoint(world.x, world.z);
      if (handled) return;
      // If not near a track, ignore click
      return;
    }

    // Check if clicking on a terrain zone portal
    const zoneHit = onHitTestTerrainZone(world.x, world.z);
    if (zoneHit && !activePiece) {
      onSetSelectedZone(zoneHit);
      onSetSelectedTrack(null);
      return;
    }

    const hit = hitTrack(world);
    const multiKey = e.ctrlKey || e.metaKey || e.shiftKey;
    inter.ctrlOrShift = multiKey;

    if (hit && !activePiece) {
      onSetSelectedZone(null);

      if (multiKey) {
        // Ctrl/Shift+click → toggle this track in multi-selection
        onToggleSelectTrack(hit.instanceId);
        return;
      }

      // If clicking on an already-selected track in a group → start group drag
      if (state.selectedTrackIds.length > 1 && state.selectedTrackIds.includes(hit.instanceId)) {
        inter.mode = "group-drag";
        inter.pointerId = e.pointerId;
        inter.dragStartWorld = world;
        inter.groupDragStarts = new Map();
        for (const id of state.selectedTrackIds) {
          const t = state.tracks.find((tr) => tr.instanceId === id);
          if (t) inter.groupDragStarts.set(id, { x: t.position.x, z: t.position.z });
        }
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Single select + start drag
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
      return;
    }

    // No hit, no active piece → start marquee select (rectangle)
    if (!multiKey) {
      inter.mode = "marquee";
      inter.pointerId = e.pointerId;
      inter.startX = x;
      inter.startY = y;
      setMarquee({ startX: x, startY: y, endX: x, endY: y });
      canvas.setPointerCapture(e.pointerId);
      onSetSelectedTrack(null);
      onSetSelectedZone(null);
      return;
    }

    onSetSelectedTrack(null);
    onSetSelectedZone(null);
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

    // Promote touch-pending to pan after 8px movement
    if (inter.mode === "touch-pending" && inter.pointerId === e.pointerId) {
      const dx = x - inter.startX;
      const dy = y - inter.startY;
      if (Math.hypot(dx, dy) > 8) {
        inter.mode = "pan";
        inter.touchMoved = true;
      }
      // Don't move yet — wait for promotion
      if (inter.mode === "touch-pending") return;
    }

    if (inter.mode === "pan" && inter.pointerId === e.pointerId) {
      const dx = x - inter.startX;
      const dy = y - inter.startY;
      onTransformChange((prev) => ({ ...prev, offsetX: inter.startOffsetX + dx, offsetY: inter.startOffsetY + dy }));
      return;
    }

    if (inter.mode === "marquee" && inter.pointerId === e.pointerId) {
      setMarquee((prev) => prev ? { ...prev, endX: x, endY: y } : null);
      return;
    }

    if (inter.mode === "group-drag" && inter.pointerId === e.pointerId && inter.dragStartWorld) {
      const world = screenToWorld(x, y, transform);
      const dx = world.x - inter.dragStartWorld.x;
      const dz = world.z - inter.dragStartWorld.z;
      for (const [id, startPos] of inter.groupDragStarts) {
        onUpdateTrack(id, {
          position: { x: startPos.x + dx, y: 0, z: startPos.z + dz },
        });
      }
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
    // Track mouse for ghost preview
    if (activePiece) setMouseWorld(world);
    const hit = hitTrack(world);
    onSetHoveredTrack(hit?.instanceId ?? null);
  };

  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const inter = interactionRef.current;
    const canvas = canvasRef.current;
    inter.touchPoints.delete(e.pointerId);

    // Touch-pending that didn't move = TAP → terrain mode or select/deselect track
    if (inter.mode === "touch-pending" && !inter.touchMoved) {
      const rect = canvas?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const world = screenToWorld(x, y, transform);

        if (terrainMode) {
          onPlaceTerrainPoint(world.x, world.z);
        } else {
          const zoneHit = onHitTestTerrainZone(world.x, world.z);
          if (zoneHit) {
            onSetSelectedZone(zoneHit);
            onSetSelectedTrack(null);
          } else {
            const hit = hitTrack(world);
            onSetSelectedTrack(hit?.instanceId ?? null);
            onSetSelectedZone(null);
          }
        }
      }
    }

    if (inter.mode === "marquee") {
      // Finalize rectangle select — find all tracks inside marquee
      if (marquee) {
        const minSX = Math.min(marquee.startX, marquee.endX);
        const maxSX = Math.max(marquee.startX, marquee.endX);
        const minSY = Math.min(marquee.startY, marquee.endY);
        const maxSY = Math.max(marquee.startY, marquee.endY);

        // Only select if marquee is larger than 5px (not accidental click)
        if (maxSX - minSX > 5 || maxSY - minSY > 5) {
          const worldTL = screenToWorld(minSX, minSY, transform);
          const worldBR = screenToWorld(maxSX, maxSY, transform);
          const selected: string[] = [];
          for (const tr of state.tracks) {
            // Check if track center is inside marquee
            if (
              tr.position.x >= worldTL.x && tr.position.x <= worldBR.x &&
              tr.position.z >= worldTL.z && tr.position.z <= worldBR.z
            ) {
              selected.push(tr.instanceId);
            }
          }
          if (selected.length > 0) {
            onSelectTracks(selected);
          }
        }
        setMarquee(null);
      }
    }

    if (inter.mode === "drag" && inter.dragTrackId) {
      const current = state.tracks.find((t) => t.instanceId === inter.dragTrackId);
      if (current) {
        const snapped = onSnapDraggedTrack(current);
        onUpdateTrack(current.instanceId, { position: snapped.position, rotation: snapped.rotation });
      }
    }

    if (inter.mode === "group-drag") {
      // Snap the first selected track, apply delta to all
      // (simplified — just leave them where they are for now)
    }

    inter.mode = "none";
    inter.pointerId = null;
    inter.dragTrackId = null;
    inter.dragStartWorld = null;
    inter.dragTrackStartPos = null;
    inter.groupDragStarts = new Map();
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

      {/* Marquee rectangle overlay */}
      {marquee && (
        <div
          className="pointer-events-none absolute border-2 border-dashed"
          style={{
            left: Math.min(marquee.startX, marquee.endX),
            top: Math.min(marquee.startY, marquee.endY),
            width: Math.abs(marquee.endX - marquee.startX),
            height: Math.abs(marquee.endY - marquee.startY),
            borderColor: "var(--accent)",
            background: "rgba(240,160,48,0.1)",
          }}
        />
      )}

      <div
        className="pointer-events-none absolute left-3 top-3 rounded-md border px-2 py-1 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-dim)" }}
      >
        Pan: pravé/prostřední tlačítko nebo mezerník + tah | Zoom: kolečko/pinch | Rotace: Shift+scroll | Multi-select: Ctrl+klik nebo tažení
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
