import type { BoardConfig, PlacedTrack } from "./track-designer-store";
import type { TrackPieceDefinition, TrackScale } from "./track-library";

export interface ViewTransform {
  zoom: number; // px per mm
  offsetX: number; // px
  offsetY: number; // px
}

export interface RenderTrackCanvasParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  board: BoardConfig;
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
  selectedTrackId: string | null;
  hoveredTrackId: string | null;
  transform: ViewTransform;
}

export type LocalPoint = { x: number; z: number };

export type PathSegment =
  | { kind: "line"; from: LocalPoint; to: LocalPoint }
  | {
      kind: "arc";
      center: LocalPoint;
      radius: number;
      startAngle: number;
      endAngle: number;
      ccw: boolean;
    };

export interface WorldConnectionDot {
  x: number;
  z: number;
  connected: boolean;
}

const COLOR = {
  rail: "#3a3a3a",
  sleeper: "#6f4e37",
  ballast: "#c9b89b",
  selected: "#ff9800",
  hover: "#ffd180",
  boardFill: "rgba(140, 120, 90, 0.05)",
  boardBorder: "rgba(120, 110, 90, 0.45)",
  gridMinor: "rgba(120, 120, 120, 0.12)",
  gridMajor: "rgba(160, 160, 160, 0.2)",
  bridge: "rgba(90, 90, 90, 0.75)",
};

export function getGaugeMm(scale: TrackScale): number {
  return scale === "H0" ? 16.5 : 12;
}

function worldToScreen(p: LocalPoint, transform: ViewTransform) {
  return {
    x: transform.offsetX + p.x * transform.zoom,
    y: transform.offsetY + p.z * transform.zoom,
  };
}

export function localToWorld(local: LocalPoint, track: Pick<PlacedTrack, "position" | "rotation" | "flipZ">): LocalPoint {
  const z = track.flipZ ? -local.z : local.z;
  const cos = Math.cos(track.rotation);
  const sin = Math.sin(track.rotation);
  return {
    x: track.position.x + local.x * cos - z * sin,
    z: track.position.z + local.x * sin + z * cos,
  };
}

function localDirToWorld(localDir: LocalPoint, rotation: number, flipZ?: boolean): LocalPoint {
  const z = flipZ ? -localDir.z : localDir.z;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: localDir.x * cos - z * sin,
    z: localDir.x * sin + z * cos,
  };
}

function getPieceSegmentsLocal(piece: TrackPieceDefinition): PathSegment[] {
  if (piece.type === "straight") {
    const b = piece.connections.find((c) => c.id === "b");
    return [{ kind: "line", from: { x: 0, z: 0 }, to: { x: b?.position.x ?? piece.length ?? 0, z: 0 } }];
  }

  if (piece.type === "curve") {
    const angle = ((piece.angle ?? 0) * Math.PI) / 180;
    const radius = piece.radius ?? 0;
    return [
      {
        kind: "arc",
        center: { x: 0, z: radius },
        radius,
        startAngle: -Math.PI / 2,
        endAngle: -Math.PI / 2 + angle,
        ccw: false,
      },
    ];
  }

  if (piece.type === "turnout") {
    const angle = ((piece.angle ?? 0) * Math.PI) / 180;
    const radius = piece.radius ?? 0;
    const sign = piece.direction === "right" ? -1 : 1;
    const straightLen = piece.length ?? 0;

    return [
      { kind: "line", from: { x: 0, z: 0 }, to: { x: straightLen, z: 0 } },
      {
        kind: "arc",
        center: { x: 0, z: sign * radius },
        radius,
        startAngle: sign > 0 ? -Math.PI / 2 : Math.PI / 2,
        endAngle: (sign > 0 ? -Math.PI / 2 : Math.PI / 2) + sign * angle,
        ccw: sign < 0,
      },
    ];
  }

  if (piece.type === "crossing") {
    const a = piece.connections.find((c) => c.id === "a");
    const b = piece.connections.find((c) => c.id === "b");
    const c = piece.connections.find((c0) => c0.id === "c");
    const d = piece.connections.find((c0) => c0.id === "d");

    return [
      {
        kind: "line",
        from: { x: a?.position.x ?? 0, z: a?.position.z ?? 0 },
        to: { x: b?.position.x ?? piece.length ?? 0, z: b?.position.z ?? 0 },
      },
      {
        kind: "line",
        from: { x: c?.position.x ?? 0, z: c?.position.z ?? 0 },
        to: { x: d?.position.x ?? piece.length ?? 0, z: d?.position.z ?? 0 },
      },
    ];
  }

  return [];
}

function segmentLength(seg: PathSegment): number {
  if (seg.kind === "line") {
    const dx = seg.to.x - seg.from.x;
    const dz = seg.to.z - seg.from.z;
    return Math.hypot(dx, dz);
  }

  return seg.radius * Math.abs(seg.endAngle - seg.startAngle);
}

function pointAndTangentAt(seg: PathSegment, t: number): { point: LocalPoint; tangent: LocalPoint } {
  if (seg.kind === "line") {
    const x = seg.from.x + (seg.to.x - seg.from.x) * t;
    const z = seg.from.z + (seg.to.z - seg.from.z) * t;
    const tx = seg.to.x - seg.from.x;
    const tz = seg.to.z - seg.from.z;
    const len = Math.hypot(tx, tz) || 1;
    return { point: { x, z }, tangent: { x: tx / len, z: tz / len } };
  }

  const a = seg.startAngle + (seg.endAngle - seg.startAngle) * t;
  const x = seg.center.x + Math.cos(a) * seg.radius;
  const z = seg.center.z + Math.sin(a) * seg.radius;
  const tx = -Math.sin(a);
  const tz = Math.cos(a);
  const orient = seg.endAngle >= seg.startAngle ? 1 : -1;
  const len = Math.hypot(tx, tz) || 1;
  return { point: { x, z }, tangent: { x: (tx / len) * orient, z: (tz / len) * orient } };
}

function drawPolyline(ctx: CanvasRenderingContext2D, points: LocalPoint[], transform: ViewTransform) {
  if (!points.length) return;
  const p0 = worldToScreen(points[0], transform);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < points.length; i++) {
    const p = worldToScreen(points[i], transform);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function sampleSegmentWorld(
  seg: PathSegment,
  track: Pick<PlacedTrack, "position" | "rotation" | "flipZ">,
  stepMm: number,
): LocalPoint[] {
  const len = segmentLength(seg);
  const samples = Math.max(2, Math.ceil(len / Math.max(stepMm, 1)));
  const out: LocalPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const local = pointAndTangentAt(seg, t).point;
    out.push(localToWorld(local, track));
  }
  return out;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: ViewTransform,
  minorMm = 100,
  majorMm = 500,
) {
  const leftWorld = (0 - transform.offsetX) / transform.zoom;
  const rightWorld = (width - transform.offsetX) / transform.zoom;
  const topWorld = (0 - transform.offsetY) / transform.zoom;
  const bottomWorld = (height - transform.offsetY) / transform.zoom;

  const startX = Math.floor(leftWorld / minorMm) * minorMm;
  const endX = Math.ceil(rightWorld / minorMm) * minorMm;
  const startZ = Math.floor(topWorld / minorMm) * minorMm;
  const endZ = Math.ceil(bottomWorld / minorMm) * minorMm;

  for (let x = startX; x <= endX; x += minorMm) {
    const sx = transform.offsetX + x * transform.zoom;
    const major = x % majorMm === 0;
    ctx.strokeStyle = major ? COLOR.gridMajor : COLOR.gridMinor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
  }

  for (let z = startZ; z <= endZ; z += minorMm) {
    const sy = transform.offsetY + z * transform.zoom;
    const major = z % majorMm === 0;
    ctx.strokeStyle = major ? COLOR.gridMajor : COLOR.gridMinor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
  }
}

export function getBoardPathMm(board: BoardConfig): LocalPoint[] {
  const widthMm = Math.max(1, board.width * 10);
  const depthMm = Math.max(1, board.depth * 10);

  if (board.shape === "l-shape") {
    const corner = board.lCorner ?? "bottom-right";
    const armW = Math.min(widthMm - 1, Math.max(1, (board.lArmWidth ?? board.width / 2) * 10));
    const armD = Math.min(depthMm - 1, Math.max(1, (board.lArmDepth ?? board.depth / 2) * 10));

    switch (corner) {
      case "top-left":
        return [
          { x: armW, z: 0 },
          { x: widthMm, z: 0 },
          { x: widthMm, z: depthMm },
          { x: 0, z: depthMm },
          { x: 0, z: armD },
          { x: armW, z: armD },
        ];
      case "top-right":
        return [
          { x: 0, z: 0 },
          { x: widthMm - armW, z: 0 },
          { x: widthMm - armW, z: armD },
          { x: widthMm, z: armD },
          { x: widthMm, z: depthMm },
          { x: 0, z: depthMm },
        ];
      case "bottom-left":
        return [
          { x: 0, z: 0 },
          { x: widthMm, z: 0 },
          { x: widthMm, z: depthMm },
          { x: armW, z: depthMm },
          { x: armW, z: depthMm - armD },
          { x: 0, z: depthMm - armD },
        ];
      default:
        return [
          { x: 0, z: 0 },
          { x: widthMm, z: 0 },
          { x: widthMm, z: depthMm - armD },
          { x: widthMm - armW, z: depthMm - armD },
          { x: widthMm - armW, z: depthMm },
          { x: 0, z: depthMm },
        ];
    }
  }

  if (board.shape === "u-shape") {
    const armDepthMm = Math.min(depthMm - 1, Math.max(1, (board.uArmDepth ?? board.depth / 2) * 10));
    const sideArmWidthMm = Math.min(
      Math.floor(widthMm / 2) - 1,
      Math.max(1, (board.uArmWidth ?? board.width / 4) * 10),
    );

    return [
      { x: 0, z: 0 },
      { x: sideArmWidthMm, z: 0 },
      { x: sideArmWidthMm, z: armDepthMm },
      { x: widthMm - sideArmWidthMm, z: armDepthMm },
      { x: widthMm - sideArmWidthMm, z: 0 },
      { x: widthMm, z: 0 },
      { x: widthMm, z: depthMm },
      { x: 0, z: depthMm },
    ];
  }

  return [
    { x: 0, z: 0 },
    { x: widthMm, z: 0 },
    { x: widthMm, z: depthMm },
    { x: 0, z: depthMm },
  ];
}

export function isPointInsidePolygon(point: LocalPoint, polygon: LocalPoint[]): boolean {
  const onSegment = (a: LocalPoint, b: LocalPoint) => {
    const cross = (point.z - a.z) * (b.x - a.x) - (point.x - a.x) * (b.z - a.z);
    if (Math.abs(cross) > 1e-6) return false;
    const dot = (point.x - a.x) * (b.x - a.x) + (point.z - a.z) * (b.z - a.z);
    if (dot < 0) return false;
    const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
    return dot <= len2;
  };

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j];
    const b = polygon[i];

    if (onSegment(a, b)) return true;

    const intersects = b.z > point.z !== a.z > point.z
      && point.x < ((a.x - b.x) * (point.z - b.z)) / ((a.z - b.z) || Number.EPSILON) + b.x;

    if (intersects) inside = !inside;
  }
  return inside;
}

function drawBoard(ctx: CanvasRenderingContext2D, board: BoardConfig, transform: ViewTransform) {
  const path = getBoardPathMm(board);

  ctx.fillStyle = COLOR.boardFill;
  ctx.strokeStyle = COLOR.boardBorder;
  ctx.lineWidth = 1.5;

  if (!path.length) return;
  const first = worldToScreen(path[0], transform);

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i++) {
    const p = worldToScreen(path[i], transform);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawTrackPiece(
  ctx: CanvasRenderingContext2D,
  track: PlacedTrack,
  piece: TrackPieceDefinition,
  transform: ViewTransform,
  state: "normal" | "selected" | "hover",
) {
  const gaugeMm = getGaugeMm(piece.scale);
  const gaugePx = Math.max(3, gaugeMm * transform.zoom);
  const ballastPx = Math.max(gaugePx * 1.8, 8);
  const railOffsetMm = gaugeMm / 2;
  const sleeperSpacingPx = Math.min(8, Math.max(5, gaugePx * 0.9));
  const sleeperSpacingMm = sleeperSpacingPx / transform.zoom;
  const sleeperWidthMm = gaugeMm * 2;
  const sleeperThicknessPx = Math.max(1.2, gaugePx * 0.22);

  const segments = getPieceSegmentsLocal(piece);

  const highlight = state === "selected" ? COLOR.selected : state === "hover" ? COLOR.hover : null;

  if (track.isTunnel) {
    ctx.save();
    ctx.globalAlpha = 0.55;
  }

  // Highlight underlay
  if (highlight) {
    ctx.strokeStyle = highlight;
    ctx.lineWidth = ballastPx + 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const seg of segments) {
      const pts = sampleSegmentWorld(seg, track, 8 / transform.zoom);
      drawPolyline(ctx, pts, transform);
    }
  }

  // Ballast
  ctx.strokeStyle = COLOR.ballast;
  ctx.lineWidth = ballastPx;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (track.isTunnel) ctx.setLineDash([7, 6]);
  for (const seg of segments) {
    const pts = sampleSegmentWorld(seg, track, 6 / transform.zoom);
    drawPolyline(ctx, pts, transform);
  }
  ctx.setLineDash([]);

  // Sleepers
  ctx.strokeStyle = COLOR.sleeper;
  ctx.lineWidth = sleeperThicknessPx;
  for (const seg of segments) {
    const len = segmentLength(seg);
    const count = Math.max(2, Math.floor(len / sleeperSpacingMm));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const { point, tangent } = pointAndTangentAt(seg, t);
      const worldPoint = localToWorld(point, track);
      const tangentWorld = localDirToWorld(tangent, track.rotation, track.flipZ);
      const nLen = Math.hypot(tangentWorld.x, tangentWorld.z) || 1;
      const nx = -tangentWorld.z / nLen;
      const nz = tangentWorld.x / nLen;
      const p1 = {
        x: worldPoint.x - nx * sleeperWidthMm * 0.5,
        z: worldPoint.z - nz * sleeperWidthMm * 0.5,
      };
      const p2 = {
        x: worldPoint.x + nx * sleeperWidthMm * 0.5,
        z: worldPoint.z + nz * sleeperWidthMm * 0.5,
      };
      const s1 = worldToScreen(p1, transform);
      const s2 = worldToScreen(p2, transform);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
    }
  }

  // Rails (2 pásy)
  ctx.strokeStyle = COLOR.rail;
  ctx.lineWidth = Math.max(1.1, gaugePx * 0.16);
  if (track.isTunnel) ctx.setLineDash([4, 4]);

  for (const side of [-1, 1] as const) {
    for (const seg of segments) {
      const len = segmentLength(seg);
      const samples = Math.max(10, Math.ceil(len / 10));
      const pts: LocalPoint[] = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const { point, tangent } = pointAndTangentAt(seg, t);
        const tangentWorld = localDirToWorld(tangent, track.rotation, track.flipZ);
        const l = Math.hypot(tangentWorld.x, tangentWorld.z) || 1;
        const nx = -tangentWorld.z / l;
        const nz = tangentWorld.x / l;
        const centerWorld = localToWorld(point, track);
        pts.push({
          x: centerWorld.x + nx * railOffsetMm * side,
          z: centerWorld.z + nz * railOffsetMm * side,
        });
      }
      drawPolyline(ctx, pts, transform);
    }
  }
  ctx.setLineDash([]);

  // Bridge side supports
  if (track.isBridge) {
    ctx.strokeStyle = COLOR.bridge;
    ctx.lineWidth = Math.max(1, gaugePx * 0.2);
    const supportOffsetMm = gaugeMm * 1.35;

    for (const side of [-1, 1] as const) {
      for (const seg of segments) {
        const len = segmentLength(seg);
        const samples = Math.max(8, Math.ceil(len / 16));
        const sidePts: LocalPoint[] = [];

        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          const { point, tangent } = pointAndTangentAt(seg, t);
          const tangentWorld = localDirToWorld(tangent, track.rotation, track.flipZ);
          const l = Math.hypot(tangentWorld.x, tangentWorld.z) || 1;
          const nx = -tangentWorld.z / l;
          const nz = tangentWorld.x / l;
          const centerWorld = localToWorld(point, track);
          const edge = {
            x: centerWorld.x + nx * supportOffsetMm * side,
            z: centerWorld.z + nz * supportOffsetMm * side,
          };
          sidePts.push(edge);

          if (i % 3 === 0) {
            const base = { x: edge.x + nx * side * 3, z: edge.z + nz * side * 3 };
            const s1 = worldToScreen(edge, transform);
            const s2 = worldToScreen(base, transform);
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
          }
        }

        drawPolyline(ctx, sidePts, transform);
      }
    }
  }

  if (track.isTunnel) {
    ctx.restore();
  }
}

function drawConnectionDots(
  ctx: CanvasRenderingContext2D,
  dots: WorldConnectionDot[],
  transform: ViewTransform,
) {
  for (const dot of dots) {
    const p = worldToScreen({ x: dot.x, z: dot.z }, transform);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = dot.connected ? "#4caf50" : "#f44336";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function renderTrackCanvas(params: RenderTrackCanvasParams) {
  const { ctx, width, height, board, tracks, catalog, selectedTrackId, hoveredTrackId, transform } = params;
  ctx.clearRect(0, 0, width, height);

  drawGrid(ctx, width, height, transform);
  drawBoard(ctx, board, transform);

  // Draw non-selected first, selected last
  const ordered = [...tracks].sort((a, b) => {
    if (a.instanceId === selectedTrackId) return 1;
    if (b.instanceId === selectedTrackId) return -1;
    return 0;
  });

  for (const track of ordered) {
    const piece = catalog[track.pieceId];
    if (!piece) continue;

    const state: "normal" | "selected" | "hover" =
      track.instanceId === selectedTrackId
        ? "selected"
        : track.instanceId === hoveredTrackId
          ? "hover"
          : "normal";

    drawTrackPiece(ctx, track, piece, transform, state);
  }

  const dots: WorldConnectionDot[] = [];
  for (const track of tracks) {
    const piece = catalog[track.pieceId];
    if (!piece) continue;

    for (const conn of piece.connections) {
      const world = localToWorld({ x: conn.position.x, z: conn.position.z }, track);
      dots.push({ x: world.x, z: world.z, connected: Boolean(track.snappedConnections[conn.id]) });
    }
  }

  drawConnectionDots(ctx, dots, transform);
}

export function distancePointToTrackMm(
  worldPoint: LocalPoint,
  track: Pick<PlacedTrack, "position" | "rotation" | "flipZ">,
  piece: TrackPieceDefinition,
): number {
  const segs = getPieceSegmentsLocal(piece);
  let min = Infinity;

  for (const seg of segs) {
    if (seg.kind === "line") {
      const p1 = localToWorld(seg.from, track);
      const p2 = localToWorld(seg.to, track);
      min = Math.min(min, distancePointToSegment(worldPoint, p1, p2));
      continue;
    }

    const center = localToWorld(seg.center, track);
    const distCenter = Math.hypot(worldPoint.x - center.x, worldPoint.z - center.z);
    const angle = Math.atan2(worldPoint.z - center.z, worldPoint.x - center.x);

    // When flipZ, local angles are mirrored: localAngle -> -localAngle, ccw flips
    const effStartAngle = track.flipZ ? -seg.startAngle : seg.startAngle;
    const effEndAngle = track.flipZ ? -seg.endAngle : seg.endAngle;
    const effCcw = track.flipZ ? !seg.ccw : seg.ccw;

    const start = normalizeAngle(effStartAngle + track.rotation);
    const end = normalizeAngle(effEndAngle + track.rotation);
    const a = normalizeAngle(angle);
    const between = isAngleBetween(a, start, end, effCcw);

    if (between) {
      min = Math.min(min, Math.abs(distCenter - seg.radius));
    } else {
      const pStart = {
        x: center.x + Math.cos(start) * seg.radius,
        z: center.z + Math.sin(start) * seg.radius,
      };
      const pEnd = {
        x: center.x + Math.cos(end) * seg.radius,
        z: center.z + Math.sin(end) * seg.radius,
      };
      min = Math.min(min, Math.hypot(worldPoint.x - pStart.x, worldPoint.z - pStart.z));
      min = Math.min(min, Math.hypot(worldPoint.x - pEnd.x, worldPoint.z - pEnd.z));
    }
  }

  return min;
}

function distancePointToSegment(p: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apz = p.z - a.z;
  const ab2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / ab2));
  const cx = a.x + abx * t;
  const cz = a.z + abz * t;
  return Math.hypot(p.x - cx, p.z - cz);
}

function normalizeAngle(a: number): number {
  const t = Math.PI * 2;
  let out = a % t;
  if (out < 0) out += t;
  return out;
}

function isAngleBetween(a: number, start: number, end: number, ccw: boolean): boolean {
  if (!ccw) {
    if (start <= end) return a >= start && a <= end;
    return a >= start || a <= end;
  }
  if (end <= start) return a <= start && a >= end;
  return a <= start || a >= end;
}

export function drawTrackPiecePreview(canvas: HTMLCanvasElement, piece: TrackPieceDefinition, active = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 74;
  const height = canvas.clientHeight || 36;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, width, height);

  const segs = getPieceSegmentsLocal(piece);
  const bounds = getSegmentsBounds(segs);
  const pad = 4;
  const scaleX = (width - pad * 2) / Math.max(1, bounds.maxX - bounds.minX);
  const scaleY = (height - pad * 2) / Math.max(1, bounds.maxZ - bounds.minZ);
  const scale = Math.min(scaleX, scaleY);

  const transform: ViewTransform = {
    zoom: scale,
    offsetX: pad - bounds.minX * scale,
    offsetY: pad - bounds.minZ * scale,
  };

  const fakeTrack: PlacedTrack = {
    instanceId: "preview",
    pieceId: piece.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    elevation: 0,
    snappedConnections: {},
  };

  drawTrackPiece(ctx, fakeTrack, piece, transform, active ? "selected" : "normal");
}

function getSegmentsBounds(segs: PathSegment[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const seg of segs) {
    const points: LocalPoint[] = [];
    if (seg.kind === "line") {
      points.push(seg.from, seg.to);
    } else {
      const samples = 24;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        points.push(pointAndTangentAt(seg, t).point);
      }
    }

    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 1;
    minZ = 0;
    maxZ = 1;
  }

  return { minX, maxX, minZ, maxZ };
}
