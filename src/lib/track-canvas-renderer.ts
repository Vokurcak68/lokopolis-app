import type { BoardConfig, ElevationPoint, PlacedTrack, Portal, TerrainZone, TrackPoint } from "./track-designer-store";
import type { TrackPieceDefinition, TrackScale, ExplicitSegment } from "./track-library";

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
  terrainZones: TerrainZone[];
  portals?: Portal[];
  elevationPoints?: ElevationPoint[];
  catalog: Record<string, TrackPieceDefinition>;
  selectedTrackId: string | null;
  /** Multi-select track IDs */
  selectedTrackIds?: string[];
  hoveredTrackId: string | null;
  transform: ViewTransform;
  /** Skip clearing, grid and board — for overlay rendering (ghost) */
  skipBackground?: boolean;
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

function explicitToPathSegment(es: ExplicitSegment): PathSegment {
  if (es.kind === "line") {
    return { kind: "line", from: { x: es.fromX, z: es.fromZ }, to: { x: es.toX, z: es.toZ } };
  }
  return {
    kind: "arc",
    center: { x: es.centerX, z: es.centerZ },
    radius: es.radius,
    startAngle: (es.startAngleDeg * Math.PI) / 180,
    endAngle: (es.endAngleDeg * Math.PI) / 180,
    ccw: es.ccw,
  };
}

export function getPieceSegmentsLocal(piece: TrackPieceDefinition): PathSegment[] {
  // Use explicit segments when defined (IBW, ABW, DW, DKW Baeseler etc.)
  if (piece.explicitSegments && piece.explicitSegments.length > 0) {
    return piece.explicitSegments.map(explicitToPathSegment);
  }

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
    // Must match turnout geometry in track-library.ts (left=-Z, right=+Z)
    const sign = piece.direction === "right" ? 1 : -1;
    const straightLen = piece.length ?? 0;

    // Diverging branch: straight lead + arc so endpoint is near main-line end
    const arcChordX = radius * Math.sin(angle);
    const divergeLeadX = Math.max(0, straightLen - arcChordX);

    return [
      { kind: "line", from: { x: 0, z: 0 }, to: { x: straightLen, z: 0 } },
      {
        kind: "arc",
        center: { x: divergeLeadX, z: sign * radius },
        radius,
        startAngle: sign > 0 ? -Math.PI / 2 : Math.PI / 2,
        endAngle: (sign > 0 ? -Math.PI / 2 : Math.PI / 2) + sign * angle,
        ccw: sign < 0,
      },
    ];
  }

  if (piece.type === "turntable") {
    // Return a full circle as arc segment for correct bounds + hit-testing
    const r = (piece.pitDiameter ?? 228) / 2;
    return [{
      kind: "arc" as const,
      center: { x: r, z: r },
      radius: r,
      startAngle: 0,
      endAngle: Math.PI * 2 - 0.001,
      ccw: false,
    }];
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

export function pointAndTangentAt(seg: PathSegment, t: number): { point: LocalPoint; tangent: LocalPoint } {
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

function drawTurntable(
  ctx: CanvasRenderingContext2D,
  track: PlacedTrack,
  piece: TrackPieceDefinition,
  transform: ViewTransform,
  state: "normal" | "selected" | "hover",
) {
  const pitDiameter = piece.pitDiameter ?? 228;
  const bridgeLength = piece.bridgeLength ?? 183;
  const positions = piece.positions ?? 24;
  const posAngle = piece.positionAngle ?? 15;
  const radius = pitDiameter / 2;
  const gaugeMm = getGaugeMm(piece.scale);

  // Center of turntable in world coords (piece origin is at the center of the bounding box)
  const center = localToWorld({ x: radius, z: radius }, track);
  const cs = worldToScreen(center, transform);
  const rPx = radius * transform.zoom;
  const bridgeHalf = (bridgeLength / 2) * transform.zoom;
  const gaugePx = Math.max(3, gaugeMm * transform.zoom);
  const railOffset = (gaugeMm / 2) * transform.zoom;

  const highlight = state === "selected" ? COLOR.selected : state === "hover" ? COLOR.hover : null;

  // Selection highlight ring
  if (highlight) {
    ctx.beginPath();
    ctx.arc(cs.x, cs.y, rPx + 5, 0, Math.PI * 2);
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Pit (dark circle)
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, rPx, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40,35,30,0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgba(100,90,75,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pit inner ring (rails run on this)
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, rPx * 0.92, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(120,110,95,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Track position indicators (small ticks on pit edge)
  for (let i = 0; i < positions; i++) {
    const angleDeg = i * posAngle;
    const angleRad = (angleDeg * Math.PI) / 180 + track.rotation;
    const outerX = cs.x + rPx * Math.cos(angleRad);
    const outerY = cs.y + rPx * Math.sin(angleRad);
    const innerX = cs.x + rPx * 0.85 * Math.cos(angleRad);
    const innerY = cs.y + rPx * 0.85 * Math.sin(angleRad);

    ctx.beginPath();
    ctx.moveTo(outerX, outerY);
    ctx.lineTo(innerX, innerY);
    ctx.strokeStyle = "rgba(160,145,120,0.6)";
    ctx.lineWidth = i % 6 === 0 ? 2 : 1; // Every 90° thicker
    ctx.stroke();
  }

  // Bridge (the rotating part) — draw at 0° rotation (default position)
  const bridgeAngle = track.rotation; // Bridge default = facing right
  const cosA = Math.cos(bridgeAngle);
  const sinA = Math.sin(bridgeAngle);

  // Bridge deck
  const deckWidth = gaugePx * 2;
  ctx.save();
  ctx.translate(cs.x, cs.y);
  ctx.rotate(bridgeAngle);

  // Bridge base plate
  ctx.fillStyle = "rgba(80,75,65,0.7)";
  ctx.fillRect(-bridgeHalf, -deckWidth / 2, bridgeHalf * 2, deckWidth);

  // Sleepers on bridge
  ctx.strokeStyle = COLOR.sleeper;
  ctx.lineWidth = Math.max(1.2, gaugePx * 0.22);
  const sleeperWidth = gaugeMm * 1.8 * transform.zoom;
  const sleeperCount = Math.max(4, Math.floor(bridgeLength * transform.zoom / 6));
  for (let i = 0; i <= sleeperCount; i++) {
    const x = -bridgeHalf + (i / sleeperCount) * bridgeHalf * 2;
    ctx.beginPath();
    ctx.moveTo(x, -sleeperWidth / 2);
    ctx.lineTo(x, sleeperWidth / 2);
    ctx.stroke();
  }

  // Rails on bridge
  ctx.strokeStyle = COLOR.rail;
  ctx.lineWidth = Math.max(1.1, gaugePx * 0.16);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-bridgeHalf, side * railOffset);
    ctx.lineTo(bridgeHalf, side * railOffset);
    ctx.stroke();
  }

  ctx.restore();

  // Center pivot
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, Math.max(3, rPx * 0.06), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(140,130,110,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(100,90,75,0.8)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Outer wall (decorative)
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, rPx + 1, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(90,80,65,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTrackPiece(
  ctx: CanvasRenderingContext2D,
  track: PlacedTrack,
  piece: TrackPieceDefinition,
  transform: ViewTransform,
  state: "normal" | "selected" | "hover",
) {
  // Turntable has its own renderer
  if (piece.type === "turntable") {
    drawTurntable(ctx, track, piece, transform, state);
    return;
  }

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

function drawElevationMarkers(
  ctx: CanvasRenderingContext2D,
  elevationPoints: ElevationPoint[],
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
  transform: ViewTransform,
) {
  const getPrimarySegments = (piece: TrackPieceDefinition): PathSegment[] => {
    const all = getPieceSegmentsLocal(piece);
    if (piece.type === "straight" || piece.type === "curve") return all;
    if (piece.type === "turnout" || piece.type === "crossing") return all.length > 0 ? [all[0]] : all;
    return all.length > 0 ? [all[0]] : all;
  };

  const pointForElevation = (ep: ElevationPoint): LocalPoint | null => {
    const track = tracks.find((t) => t.instanceId === ep.trackId);
    if (!track) return null;
    const piece = catalog[track.pieceId];
    if (!piece) return null;

    const segs = getPrimarySegments(piece);
    if (segs.length === 0) return null;

    const segLens = segs.map((s) => segmentLength(s));
    const totalLen = segLens.reduce((a, b) => a + b, 0);
    if (totalLen < 0.001) return null;

    let target = Math.max(0, Math.min(1, ep.t)) * totalLen;
    for (let i = 0; i < segs.length; i++) {
      const len = segLens[i];
      if (target <= len || i === segs.length - 1) {
        const segT = len > 0 ? Math.max(0, Math.min(1, target / len)) : 0;
        const local = pointAndTangentAt(segs[i], segT).point;
        return localToWorld(local, track);
      }
      target -= len;
    }

    return null;
  };

  const byTrack = new Map<string, ElevationPoint[]>();
  for (const ep of elevationPoints) {
    if (!byTrack.has(ep.trackId)) byTrack.set(ep.trackId, []);
    byTrack.get(ep.trackId)!.push(ep);
  }

  // Slope labels/lines between neighboring points on same track
  for (const [, points] of byTrack) {
    const sorted = [...points].sort((a, b) => a.t - b.t);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const wa = pointForElevation(a);
      const wb = pointForElevation(b);
      if (!wa || !wb) continue;

      const pa = worldToScreen(wa, transform);
      const pb = worldToScreen(wb, transform);
      const run = Math.max(1, Math.hypot(wb.x - wa.x, wb.z - wa.z));
      const rise = b.elevation - a.elevation;
      const slopePct = (rise / run) * 100;

      ctx.save();
      ctx.strokeStyle = "rgba(96,165,250,0.65)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const label = `${slopePct >= 0 ? "+" : ""}${slopePct.toFixed(1)}%`;
      ctx.font = "11px system-ui, sans-serif";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(17,24,39,0.78)";
      ctx.fillRect(mx - tw / 2 - 4, my - 9, tw + 8, 16);
      ctx.fillStyle = "#e5e7eb";
      ctx.fillText(label, mx - tw / 2, my + 3);
      ctx.restore();
    }
  }

  // Point markers
  for (const ep of elevationPoints) {
    const wp = pointForElevation(ep);
    if (!wp) continue;
    const p = worldToScreen(wp, transform);
    const color = ep.elevation === 0 ? "#22c55e" : ep.elevation > 0 ? "#3b82f6" : "#ef4444";

    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "10px system-ui, sans-serif";
    const txt = `${Math.round(ep.elevation)} mm`;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = "rgba(17,24,39,0.82)";
    ctx.fillRect(p.x - tw / 2 - 3, p.y - 18, tw + 6, 12);
    ctx.fillStyle = "#f3f4f6";
    ctx.fillText(txt, p.x - tw / 2, p.y - 8);
  }
}

export function renderTrackCanvas(params: RenderTrackCanvasParams) {
  const { ctx, width, height, board, tracks, terrainZones, elevationPoints = [], catalog, selectedTrackId, selectedTrackIds, hoveredTrackId, transform, skipBackground } = params;
  const multiSelected = new Set(selectedTrackIds ?? []);

  if (!skipBackground) {
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, width, height, transform);
    drawBoard(ctx, board, transform);
  }

  // Z-order: tunnels (bottom) → normal → bridges (top).
  // Overlays (tunnel green, bridge steel) are drawn AFTER all tracks,
  // EXCEPT tracks with elevation that cross a tunnel — those are redrawn on top.
  const tunnels: PlacedTrack[] = [];
  const normal: PlacedTrack[] = [];
  const bridges: PlacedTrack[] = [];
  for (const t of tracks) {
    if (t.isTunnel) tunnels.push(t);
    else if (t.isBridge) bridges.push(t);
    else normal.push(t);
  }

  // Within each layer, draw selected tracks last so their highlight is on top
  const isSelected = (id: string) => id === selectedTrackId || multiSelected.has(id);
  const sortSelected = (arr: PlacedTrack[]) =>
    [...arr].sort((a, b) => {
      const aS = isSelected(a.instanceId) ? 1 : 0;
      const bS = isSelected(b.instanceId) ? 1 : 0;
      return aS - bS;
    });

  const drawLayer = (layer: PlacedTrack[]) => {
    for (const track of layer) {
      const piece = catalog[track.pieceId];
      if (!piece) continue;
      const state: "normal" | "selected" | "hover" =
        isSelected(track.instanceId)
          ? "selected"
          : track.instanceId === hoveredTrackId
            ? "hover"
            : "normal";
      drawTrackPiece(ctx, track, piece, transform, state);
    }
  };

  // Build set of track ids that have non-zero elevation (elevated tracks cross over tunnels)
  const elevatedTrackIds = new Set<string>();
  if (elevationPoints.length > 0) {
    for (const ep of elevationPoints) {
      if (ep.elevation !== 0) elevatedTrackIds.add(ep.trackId);
    }
    // Also mark connected tracks that inherit elevation via snap connections
    // (simple: any track connected to a track with non-zero elevation marker is potentially elevated)
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of tracks) {
        if (elevatedTrackIds.has(t.instanceId)) continue;
        for (const snap of Object.values(t.snappedConnections)) {
          const neighborId = snap.split(":")[0];
          if (elevatedTrackIds.has(neighborId)) {
            elevatedTrackIds.add(t.instanceId);
            changed = true;
            break;
          }
        }
      }
    }
    // Remove tracks that have an explicit 0 elevation marker and no non-zero markers
    // (track with only elev=0 markers is at ground level)
    for (const t of tracks) {
      if (!elevatedTrackIds.has(t.instanceId)) continue;
      const ownMarkers = elevationPoints.filter((ep) => ep.trackId === t.instanceId);
      if (ownMarkers.length > 0 && ownMarkers.every((ep) => ep.elevation === 0)) {
        elevatedTrackIds.delete(t.instanceId);
      }
    }
  }

  // Split normal tracks into ground-level and elevated
  const normalGround = normal.filter((t) => !elevatedTrackIds.has(t.instanceId));
  const normalElevated = normal.filter((t) => elevatedTrackIds.has(t.instanceId));

  // Draw ground-level tracks
  for (const layer of [sortSelected(tunnels), sortSelected(normalGround)]) {
    drawLayer(layer);
  }

  // Overlays on top of ground-level tracks (tunnel green covers tracks inside tunnel)
  const portals = params.portals ?? [];
  if (!skipBackground && terrainZones.length > 0) {
    drawTerrainZones(ctx, terrainZones, tracks, catalog, transform);
  }
  if (!skipBackground && portals.length > 0) {
    drawPortals(ctx, portals, tracks, catalog, transform);
  }

  // Elevated tracks + bridge tracks on top of overlays (crossing over tunnels)
  if (normalElevated.length > 0) {
    drawLayer(sortSelected(normalElevated));
  }
  if (bridges.length > 0) {
    drawLayer(sortSelected(bridges));
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

  if (!skipBackground && elevationPoints.length > 0) {
    drawElevationMarkers(ctx, elevationPoints, tracks, catalog, transform);
  }
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

/**
 * Get the bounding extent (max of width/height in mm) of a track piece.
 * Used to compute a shared reference zoom for consistent preview sizing.
 */
export function getTrackPieceExtentMm(piece: TrackPieceDefinition): number {
  const segs = getPieceSegmentsLocal(piece);
  const bounds = getSegmentsBounds(segs);
  // Include gauge width in Z extent so straight pieces have non-zero height
  const gaugeMm = getGaugeMm(piece.scale);
  const extentX = bounds.maxX - bounds.minX;
  const extentZ = Math.max(bounds.maxZ - bounds.minZ, gaugeMm * 2.5);
  return Math.max(extentX, extentZ);
}

/**
 * Draw a track piece preview in a catalog canvas.
 * @param maxExtentMm — if provided, used as the reference extent for zoom so all pieces
 *   in the same group render at consistent scale (short pieces look short, long pieces look long).
 *   The piece is always fit-to-canvas but zoom is capped at the group reference so
 *   short pieces appear proportionally shorter than long ones.
 */
export function drawTrackPiecePreview(canvas: HTMLCanvasElement, piece: TrackPieceDefinition, active = false, maxExtentMm?: number) {
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

  // Include gauge so straight pieces have visible height
  const gaugeMm = getGaugeMm(piece.scale);
  const pieceW = Math.max(bounds.maxX - bounds.minX, 1);
  const pieceH = Math.max(bounds.maxZ - bounds.minZ, gaugeMm * 2.5);

  // Fit-to-canvas zoom for THIS piece
  const fitScaleX = (width - pad * 2) / pieceW;
  const fitScaleY = (height - pad * 2) / pieceH;
  const fitScale = Math.min(fitScaleX, fitScaleY);

  // If we have a group reference, cap the zoom so short pieces look shorter
  // but also ensure a minimum visibility (at least 30% of canvas width)
  let scale = fitScale;
  if (maxExtentMm && maxExtentMm > 0) {
    const refScale = (width - pad * 2) / maxExtentMm;
    // Use the reference scale but don't let pieces become too tiny
    // Minimum: piece should fill at least 25% of canvas width
    const minScale = (width - pad * 2) * 0.25 / pieceW;
    scale = Math.max(Math.min(fitScale, refScale), minScale);
  }

  // Center the piece in the canvas
  const drawnW = pieceW * scale;
  const drawnH = pieceH * scale;
  const minBoundsZ = Math.min(bounds.minZ, -gaugeMm * 1.25);
  const transform: ViewTransform = {
    zoom: scale,
    offsetX: (width - drawnW) / 2 - bounds.minX * scale,
    offsetY: (height - drawnH) / 2 - minBoundsZ * scale,
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

// ============================================================
// Terrain zones (tunnels & bridges) — point-on-track utilities
// ============================================================

/** Get the SINGLE primary path for a piece (the straight-through route A→B).
 *  For curves/straights = all segments. For turnouts = ONLY straight branch.
 *  For crossings = ONLY first path (A→B). This ensures t maps 0→1 along one path only. */
function getPrimarySegments(piece: TrackPieceDefinition): PathSegment[] {
  const all = getPieceSegmentsLocal(piece);

  if (piece.type === "straight" || piece.type === "curve") {
    return all; // single segment
  }

  if (piece.type === "turnout") {
    // First segment = straight through, second = diverging branch
    return all.length > 0 ? [all[0]] : all;
  }

  if (piece.type === "crossing") {
    // First path = A→B
    return all.length > 0 ? [all[0]] : all;
  }

  // Explicit segments (IBW, ABW etc.) — take first only
  return all.length > 0 ? [all[0]] : all;
}

/**
 * Find the closest point on any track to a world coordinate.
 * Returns trackId, parameter t (0..1 along primary path), distance, and world position.
 * Searches ALL segments (all branches) but maps t onto the primary path only.
 */
export function closestPointOnAnyTrack(
  worldPoint: LocalPoint,
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
): { trackId: string; t: number; distance: number; worldPos: LocalPoint } | null {
  let best: { trackId: string; t: number; distance: number; worldPos: LocalPoint } | null = null;

  for (const track of tracks) {
    const piece = catalog[track.pieceId];
    if (!piece) continue;

    // Search on primary path (for t mapping)
    const primarySegs = getPrimarySegments(piece);
    let totalLen = 0;
    const segLens: number[] = [];
    for (const seg of primarySegs) {
      const len = segmentLength(seg);
      segLens.push(len);
      totalLen += len;
    }
    if (totalLen < 0.01) continue;

    let cumLen = 0;
    for (let si = 0; si < primarySegs.length; si++) {
      const seg = primarySegs[si];
      const len = segLens[si];
      const samples = Math.max(20, Math.ceil(len / 1.5));
      for (let i = 0; i <= samples; i++) {
        const segT = i / samples;
        const localPt = pointAndTangentAt(seg, segT).point;
        const worldPt = localToWorld(localPt, track);
        const dist = Math.hypot(worldPt.x - worldPoint.x, worldPt.z - worldPoint.z);
        const globalT = (cumLen + segT * len) / totalLen;

        if (!best || dist < best.distance) {
          best = { trackId: track.instanceId, t: globalT, distance: dist, worldPos: worldPt };
        }
      }
      cumLen += len;
    }

    // Also search secondary paths (diverging branches) — but map to nearest primary t
    const allSegs = getPieceSegmentsLocal(piece);
    if (allSegs.length > primarySegs.length) {
      for (let si = primarySegs.length; si < allSegs.length; si++) {
        const seg = allSegs[si];
        const len = segmentLength(seg);
        const samples = Math.max(20, Math.ceil(len / 1.5));
        for (let i = 0; i <= samples; i++) {
          const segT = i / samples;
          const localPt = pointAndTangentAt(seg, segT).point;
          const worldPt = localToWorld(localPt, track);
          const dist = Math.hypot(worldPt.x - worldPoint.x, worldPt.z - worldPoint.z);

          if (!best || dist < best.distance) {
            // Map to closest point on primary path
            let bestPrimaryT = 0;
            let bestPrimaryDist = Infinity;
            let cum2 = 0;
            for (let psi = 0; psi < primarySegs.length; psi++) {
              const pSeg = primarySegs[psi];
              const pLen = segLens[psi];
              for (let j = 0; j <= 20; j++) {
                const pt = j / 20;
                const pp = pointAndTangentAt(pSeg, pt).point;
                const d = Math.hypot(pp.x - localPt.x, pp.z - localPt.z);
                if (d < bestPrimaryDist) {
                  bestPrimaryDist = d;
                  bestPrimaryT = (cum2 + pt * pLen) / totalLen;
                }
              }
              cum2 += pLen;
            }
            best = { trackId: track.instanceId, t: bestPrimaryT, distance: dist, worldPos: worldPt };
          }
        }
      }
    }
  }

  return best;
}

/**
 * Compute world position for a TrackPoint (trackId + t).
 * Uses cached worldX/worldZ if available.
 */
export function trackPointToWorld(
  tp: TrackPoint,
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
): LocalPoint | null {
  // Use cached world position if set
  if (tp.worldX !== undefined && tp.worldZ !== undefined) {
    return { x: tp.worldX, z: tp.worldZ };
  }
  const r = computeTrackPointFromT(tp, tracks, catalog);
  return r ? r.pos : null;
}

/**
 * Compute world position AND tangent direction for a TrackPoint.
 * Uses cached world pos but always computes tangent from t.
 */
function trackPointToWorldWithTangent(
  tp: TrackPoint,
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
): { pos: LocalPoint; tangent: LocalPoint } | null {
  const computed = computeTrackPointFromT(tp, tracks, catalog);
  if (!computed) return null;

  // Use cached world position if available, otherwise computed
  const pos = (tp.worldX !== undefined && tp.worldZ !== undefined)
    ? { x: tp.worldX, z: tp.worldZ }
    : computed.pos;

  return { pos, tangent: computed.tangent };
}

/**
 * Internal: compute position + tangent from track + t parameter.
 */
function computeTrackPointFromT(
  tp: TrackPoint,
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
): { pos: LocalPoint; tangent: LocalPoint } | null {
  const track = tracks.find((t) => t.instanceId === tp.trackId);
  if (!track) return null;
  const piece = catalog[track.pieceId];
  if (!piece) return null;

  const segs = getPrimarySegments(piece);
  let totalLen = 0;
  const segLens: number[] = [];
  for (const seg of segs) {
    const len = segmentLength(seg);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen < 0.01) return null;

  const targetLen = tp.t * totalLen;
  let cumLen = 0;
  for (let si = 0; si < segs.length; si++) {
    const len = segLens[si];
    if (cumLen + len >= targetLen || si === segs.length - 1) {
      const segT = Math.min(1, Math.max(0, (targetLen - cumLen) / Math.max(0.01, len)));
      const { point: localPt, tangent: localTan } = pointAndTangentAt(segs[si], segT);
      const pos = localToWorld(localPt, track);
      // Rotate tangent by track rotation (and flip if flipZ)
      const cos = Math.cos(track.rotation);
      const sin = Math.sin(track.rotation);
      let tx = localTan.x, tz = localTan.z;
      if (track.flipZ) tz = -tz;
      const worldTan = { x: tx * cos - tz * sin, z: tx * sin + tz * cos };
      const tLen = Math.hypot(worldTan.x, worldTan.z) || 1;
      return { pos, tangent: { x: worldTan.x / tLen, z: worldTan.z / tLen } };
    }
    cumLen += len;
  }
  return null;
}

/**
 * Find path of (trackId, tStart, tEnd) segments between two TrackPoints,
 * following snapped connections. BFS over track graph.
 */
function findTrackPathSegments(
  start: TrackPoint,
  end: TrackPoint,
  tracks: PlacedTrack[],
): { trackId: string; tFrom: number; tTo: number }[] {
  // Same track — trivial
  if (start.trackId === end.trackId) {
    return [{ trackId: start.trackId, tFrom: start.t, tTo: end.t }];
  }

  // Build adjacency: trackId → [{connId, neighborTrackId, neighborConnId}]
  const trackMap = new Map<string, PlacedTrack>();
  for (const t of tracks) trackMap.set(t.instanceId, t);

  type Edge = { connId: string; neighborId: string; neighborConnId: string };
  const adj = new Map<string, Edge[]>();
  for (const t of tracks) {
    const edges: Edge[] = [];
    for (const [connId, snap] of Object.entries(t.snappedConnections)) {
      const [neighborId, neighborConnId] = snap.split(":");
      edges.push({ connId, neighborId, neighborConnId });
    }
    adj.set(t.instanceId, edges);
  }

  // BFS from start track to end track
  const visited = new Set<string>([start.trackId]);
  const parent = new Map<string, { fromTrackId: string; viaConnId: string; entryConnId: string }>();
  const queue = [start.trackId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === end.trackId) break;

    for (const edge of adj.get(current) ?? []) {
      if (!visited.has(edge.neighborId)) {
        visited.add(edge.neighborId);
        parent.set(edge.neighborId, {
          fromTrackId: current,
          viaConnId: edge.connId,
          entryConnId: edge.neighborConnId,
        });
        queue.push(edge.neighborId);
      }
    }
  }

  if (!parent.has(end.trackId)) {
    // No connected path — just straight between portals
    return [
      { trackId: start.trackId, tFrom: start.t, tTo: start.t > 0.5 ? 1 : 0 },
      { trackId: end.trackId, tFrom: end.t > 0.5 ? 1 : 0, tTo: end.t },
    ];
  }

  // Reconstruct path
  const path: string[] = [];
  let cur = end.trackId;
  while (cur !== start.trackId) {
    path.unshift(cur);
    cur = parent.get(cur)!.fromTrackId;
  }
  path.unshift(start.trackId);

  // Build segments with t-ranges
  // Connection "a" = t=0 end, connection "b"/"c"/"d" = t=1 end (simplified)
  const connToT = (connId: string) => (connId === "a" ? 0 : 1);

  const segments: { trackId: string; tFrom: number; tTo: number }[] = [];

  for (let i = 0; i < path.length; i++) {
    const tid = path[i];

    if (i === 0) {
      // First track: from start.t to the connection leading to next track
      if (path.length === 1) {
        segments.push({ trackId: tid, tFrom: start.t, tTo: end.t });
      } else {
        const p = parent.get(path[i + 1])!;
        const exitT = connToT(p.viaConnId);
        segments.push({ trackId: tid, tFrom: start.t, tTo: exitT });
      }
    } else if (i === path.length - 1) {
      // Last track: from entry connection to end.t
      const p = parent.get(tid)!;
      const entryT = connToT(p.entryConnId);
      segments.push({ trackId: tid, tFrom: entryT, tTo: end.t });
    } else {
      // Middle track: traverse fully from entry to exit
      const pEntry = parent.get(tid)!;
      const pExit = parent.get(path[i + 1])!;
      const entryT = connToT(pEntry.entryConnId);
      const exitT = connToT(pExit.viaConnId);
      segments.push({ trackId: tid, tFrom: entryT, tTo: exitT });
    }
  }

  return segments;
}

/**
 * Sample world points along connected tracks between two TrackPoints.
 */
function sampleTrackPath(
  zone: TerrainZone,
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
  numSamples: number,
): LocalPoint[] {
  const segments = findTrackPathSegments(zone.start, zone.end, tracks);
  const points: LocalPoint[] = [];

  // Distribute samples proportionally to segment t-ranges
  const totalSpan = segments.reduce((sum, s) => sum + Math.abs(s.tTo - s.tFrom), 0) || 1;

  for (const seg of segments) {
    const span = Math.abs(seg.tTo - seg.tFrom);
    const n = Math.max(2, Math.round((span / totalSpan) * numSamples));
    for (let i = 0; i <= n; i++) {
      const t = seg.tFrom + (seg.tTo - seg.tFrom) * (i / n);
      const wp = computeTrackPointFromT({ trackId: seg.trackId, t }, tracks, catalog);
      if (wp) points.push(wp.pos);
    }
  }

  return points;
}

/**
 * Draw a portal (tunnel mouth or bridge pillar) perpendicular to the track.
 */
function drawPortal(
  ctx: CanvasRenderingContext2D,
  screenPos: { x: number; y: number },
  tangent: LocalPoint,
  radius: number,
  kind: "tunnel" | "bridge",
  transform: ViewTransform,
) {
  // Normal perpendicular to tangent (in screen space: tangent.x→screen X, tangent.z→screen Y)
  const nx = -tangent.z;
  const ny = tangent.x;
  const angle = Math.atan2(ny, nx);

  ctx.save();
  ctx.translate(screenPos.x, screenPos.y);
  ctx.rotate(angle);

  if (kind === "tunnel") {
    // Outer stone ring (bright, visible on dark backgrounds)
    ctx.beginPath();
    ctx.arc(0, 0, radius + 3, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = "rgba(160, 140, 100, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 180, 120, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dark tunnel mouth
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.75, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = "rgba(25, 20, 15, 0.95)";
    ctx.fill();

    // Stone blocks on arch (3 decorative lines)
    ctx.strokeStyle = "rgba(130, 115, 80, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.9, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.stroke();

    // Keystone at top
    ctx.fillStyle = "rgba(180, 160, 110, 0.9)";
    ctx.fillRect(-3, -radius - 2, 6, 6);
  } else {
    // Bridge pillar — steel blue
    const pw = Math.max(5, radius * 0.4);

    // Vertical pillar
    ctx.beginPath();
    ctx.rect(-pw / 2, -radius, pw, radius * 2);
    ctx.fillStyle = "rgba(70, 100, 150, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 140, 200, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cross braces (X shape)
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, -radius * 0.6);
    ctx.lineTo(radius * 0.7, radius * 0.6);
    ctx.moveTo(radius * 0.7, -radius * 0.6);
    ctx.lineTo(-radius * 0.7, radius * 0.6);
    ctx.strokeStyle = "rgba(80, 120, 180, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Horizontal beam at top
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, -radius * 0.15);
    ctx.lineTo(radius * 0.8, -radius * 0.15);
    ctx.strokeStyle = "rgba(100, 140, 200, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rivets / bolts
    for (const y of [-radius * 0.5, 0, radius * 0.5]) {
      ctx.beginPath();
      ctx.arc(0, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(140, 170, 210, 0.8)";
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draw terrain zone portals and path along the track.
 */
export function drawTerrainZones(
  ctx: CanvasRenderingContext2D,
  zones: TerrainZone[],
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
  transform: ViewTransform,
) {
  for (const zone of zones) {
    const startData = trackPointToWorldWithTangent(zone.start, tracks, catalog);
    const endData = trackPointToWorldWithTangent(zone.end, tracks, catalog);
    if (!startData || !endData) continue;

    const startScreen = worldToScreen(startData.pos, transform);
    const endScreen = worldToScreen(endData.pos, transform);

    // Sample path along the track between portals
    const pathPoints = sampleTrackPath(zone, tracks, catalog, 40);
    const screenPath = pathPoints.map((p) => worldToScreen(p, transform));

    const portalRadius = Math.max(14, 22 * transform.zoom);
    const pathWidth = Math.max(10, 22 * transform.zoom);

    ctx.save();

    if (zone.kind === "tunnel") {
      // Green hill/mountain overlay along the tunnel path
      if (screenPath.length >= 2) {
        // Wide green hill shape
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x, screenPath[0].y);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x, screenPath[i].y);
        }
        ctx.strokeStyle = "rgba(60, 120, 50, 0.5)";
        ctx.lineWidth = pathWidth * 1.8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Darker core
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x, screenPath[0].y);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x, screenPath[i].y);
        }
        ctx.strokeStyle = "rgba(45, 90, 35, 0.55)";
        ctx.lineWidth = pathWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Dashed track hint through the hill
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x, screenPath[0].y);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x, screenPath[i].y);
        }
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = "rgba(200, 190, 160, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Grass texture dots along the path
        for (let i = 0; i < screenPath.length; i += 3) {
          const pt = screenPath[i];
          const prev = screenPath[Math.max(0, i - 1)];
          const next = screenPath[Math.min(screenPath.length - 1, i + 1)];
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const offset = (Math.sin(i * 1.7) * 0.5 + 0.5) * pathWidth * 0.6;
          const side = i % 2 === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.arc(pt.x + nx * offset * side, pt.y + ny * offset * side, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${40 + (i % 30)}, ${100 + (i % 40)}, ${30 + (i % 20)}, 0.5)`;
          ctx.fill();
        }
      }

      // Portals (drawn AFTER hill so they sit on top)
      // End portal faces opposite direction (180° flip)
      const endTanFlipped = { x: -endData.tangent.x, z: -endData.tangent.z };
      drawPortal(ctx, startScreen, startData.tangent, portalRadius, "tunnel", transform);
      drawPortal(ctx, endScreen, endTanFlipped, portalRadius, "tunnel", transform);

      // Label at midpoint — bright, readable
      if (screenPath.length > 2) {
        const mid = screenPath[Math.floor(screenPath.length / 2)];
        const fontSize = Math.max(11, 14 * transform.zoom);
        ctx.font = `bold ${fontSize}px sans-serif`;
        // Text shadow for readability on any background
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.textAlign = "center";
        ctx.fillText("🏔️ TUNEL", mid.x + 1, mid.y - portalRadius - 5);
        ctx.fillStyle = "rgba(230, 220, 180, 0.95)";
        ctx.fillText("🏔️ TUNEL", mid.x, mid.y - portalRadius - 6);
      }
    } else {
      // Bridge — steel/blue-gray color scheme
      if (screenPath.length >= 2) {
        // Shadow underneath the bridge (slightly offset down)
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x + 2, screenPath[0].y + 3);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x + 2, screenPath[i].y + 3);
        }
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = pathWidth * 1.3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Main deck — steel blue
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x, screenPath[0].y);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x, screenPath[i].y);
        }
        ctx.strokeStyle = "rgba(70, 100, 140, 0.55)";
        ctx.lineWidth = pathWidth * 1.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Lighter deck core
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x, screenPath[0].y);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x, screenPath[i].y);
        }
        ctx.strokeStyle = "rgba(90, 125, 170, 0.45)";
        ctx.lineWidth = pathWidth * 0.7;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Steel railing lines (both sides) — bright and visible
        for (const side of [-1, 1]) {
          ctx.beginPath();
          for (let i = 0; i < screenPath.length; i++) {
            const prev = screenPath[Math.max(0, i - 1)];
            const next = screenPath[Math.min(screenPath.length - 1, i + 1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const offset = pathWidth * 0.6 + 2;
            const nx = (-dy / len) * offset * side;
            const ny = (dx / len) * offset * side;
            if (i === 0) ctx.moveTo(screenPath[i].x + nx, screenPath[i].y + ny);
            else ctx.lineTo(screenPath[i].x + nx, screenPath[i].y + ny);
          }
          ctx.strokeStyle = "rgba(100, 140, 190, 0.8)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Vertical railing posts every ~20px
        for (let i = 0; i < screenPath.length; i += Math.max(3, Math.floor(screenPath.length / 8))) {
          const pt = screenPath[i];
          const prev = screenPath[Math.max(0, i - 1)];
          const next = screenPath[Math.min(screenPath.length - 1, i + 1)];
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          const offset = pathWidth * 0.6 + 2;
          const nx = -dy / len;
          const ny = dx / len;

          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(pt.x + nx * offset * side, pt.y + ny * offset * side);
            ctx.lineTo(pt.x + nx * (offset + 5) * side, pt.y + ny * (offset + 5) * side);
            ctx.strokeStyle = "rgba(80, 120, 170, 0.7)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        // Cross-hatch pattern on deck (structural girders)
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(screenPath[0].x, screenPath[0].y);
        for (let i = 1; i < screenPath.length; i++) {
          ctx.lineTo(screenPath[i].x, screenPath[i].y);
        }
        ctx.strokeStyle = "rgba(140, 170, 210, 0.25)";
        ctx.lineWidth = pathWidth * 0.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Steel bridge pillars — end portal faces opposite
      const endTanFlippedBridge = { x: -endData.tangent.x, z: -endData.tangent.z };
      drawPortal(ctx, startScreen, startData.tangent, portalRadius, "bridge", transform);
      drawPortal(ctx, endScreen, endTanFlippedBridge, portalRadius, "bridge", transform);

      // Label — bright on dark
      if (screenPath.length > 2) {
        const mid = screenPath[Math.floor(screenPath.length / 2)];
        const fontSize = Math.max(11, 14 * transform.zoom);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.textAlign = "center";
        ctx.fillText("🌉 MOST", mid.x + 1, mid.y - portalRadius - 5);
        ctx.fillStyle = "rgba(160, 200, 255, 0.95)";
        ctx.fillText("🌉 MOST", mid.x, mid.y - portalRadius - 6);
      }
    }

    ctx.restore();
  }
}

// ── Portal rendering (new system) ──

/** Get world position and tangent at a TrackPoint.
 *  Uses primary segments only (consistent with closestPointOnAnyTrack t mapping). */
function resolveTrackPoint(
  tp: TrackPoint,
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
): { worldPos: { x: number; z: number }; tangent: LocalPoint } | null {
  const track = tracks.find((t) => t.instanceId === tp.trackId);
  if (!track) return null;
  const piece = catalog[track.pieceId];
  if (!piece) return null;

  const segments = getPrimarySegments(piece);
  if (segments.length === 0) return null;

  // Find the right segment and local t
  let totalLen = 0;
  const segLengths = segments.map((s) => segmentLength(s));
  for (const l of segLengths) totalLen += l;

  const targetDist = tp.t * totalLen;
  let accum = 0;
  for (let i = 0; i < segments.length; i++) {
    const sl = segLengths[i];
    if (accum + sl >= targetDist || i === segments.length - 1) {
      const localT = sl > 0 ? (targetDist - accum) / sl : 0;
      const data = pointAndTangentAt(segments[i], localT);
      const worldPos = localToWorld(data.point, track);
      const worldDir = localDirToWorld(data.tangent, track.rotation, track.flipZ);
      return { worldPos, tangent: worldDir };
    }
    accum += sl;
  }
  return null;
}

/**
 * Draw new-style portals (single and double width).
 * Paired portals are connected with a dashed line.
 */
export function drawPortals(
  ctx: CanvasRenderingContext2D,
  portals: Portal[],
  tracks: PlacedTrack[],
  catalog: Record<string, TrackPieceDefinition>,
  transform: ViewTransform,
) {
  const portalRadius = Math.max(16, 24 * transform.zoom); // trošku větší než terrain default
  const pathWidth = Math.max(10, 22 * transform.zoom);

  const byId = new Map(portals.map((p) => [p.id, p]));
  const drawnPairs = new Set<string>();

  const drawTunnelPathStyle = (screenPath: { x: number; y: number }[]) => {
    if (screenPath.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x, screenPath[0].y);
    for (let i = 1; i < screenPath.length; i++) ctx.lineTo(screenPath[i].x, screenPath[i].y);
    ctx.strokeStyle = "rgba(60, 120, 50, 0.5)";
    ctx.lineWidth = pathWidth * 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x, screenPath[0].y);
    for (let i = 1; i < screenPath.length; i++) ctx.lineTo(screenPath[i].x, screenPath[i].y);
    ctx.strokeStyle = "rgba(45, 90, 35, 0.55)";
    ctx.lineWidth = pathWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x, screenPath[0].y);
    for (let i = 1; i < screenPath.length; i++) ctx.lineTo(screenPath[i].x, screenPath[i].y);
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = "rgba(200, 190, 160, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawBridgePathStyle = (screenPath: { x: number; y: number }[]) => {
    if (screenPath.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x + 2, screenPath[0].y + 3);
    for (let i = 1; i < screenPath.length; i++) ctx.lineTo(screenPath[i].x + 2, screenPath[i].y + 3);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = pathWidth * 1.3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x, screenPath[0].y);
    for (let i = 1; i < screenPath.length; i++) ctx.lineTo(screenPath[i].x, screenPath[i].y);
    ctx.strokeStyle = "rgba(70, 100, 140, 0.55)";
    ctx.lineWidth = pathWidth * 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenPath[0].x, screenPath[0].y);
    for (let i = 1; i < screenPath.length; i++) ctx.lineTo(screenPath[i].x, screenPath[i].y);
    ctx.strokeStyle = "rgba(90, 125, 170, 0.45)";
    ctx.lineWidth = pathWidth * 0.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const drawBetween = (a: TrackPoint, b: TrackPoint, kind: "tunnel" | "bridge") => {
    const zone: TerrainZone = { id: "tmp", kind, start: a, end: b };
    const pathPoints = sampleTrackPath(zone, tracks, catalog, 40);

    // Snap first and last path point to the actual cached world positions of the portals
    // (avoids mismatch when t maps to a slightly different point, e.g. on turnout primary vs all segments)
    if (pathPoints.length > 0 && a.worldX !== undefined && a.worldZ !== undefined) {
      pathPoints[0] = { x: a.worldX, z: a.worldZ };
    }
    if (pathPoints.length > 0 && b.worldX !== undefined && b.worldZ !== undefined) {
      pathPoints[pathPoints.length - 1] = { x: b.worldX, z: b.worldZ };
    }

    const screenPath = pathPoints.map((p) => worldToScreen(p, transform));
    if (kind === "tunnel") drawTunnelPathStyle(screenPath);
    else drawBridgePathStyle(screenPath);
  };

  const drawSinglePortal = (portal: Portal, tp: TrackPoint, flip: boolean) => {
    const data = trackPointToWorldWithTangent(tp, tracks, catalog);
    if (!data) return;
    const screen = worldToScreen(data.pos, transform);
    const tan = flip ? { x: -data.tangent.x, z: -data.tangent.z } : data.tangent;
    drawPortal(ctx, screen, tan, portalRadius, portal.kind, transform);
  };

  const drawDoublePortal = (portal: Portal, p1: TrackPoint, p2: TrackPoint, flip: boolean) => {
    const d1 = trackPointToWorldWithTangent(p1, tracks, catalog);
    const d2 = trackPointToWorldWithTangent(p2, tracks, catalog);
    if (!d1 || !d2) return;
    const s1 = worldToScreen(d1.pos, transform);
    const s2 = worldToScreen(d2.pos, transform);

    const cx = (s1.x + s2.x) / 2;
    const cy = (s1.y + s2.y) / 2;
    const dx = s2.x - s1.x;
    const dy = s2.y - s1.y;
    const dist = Math.hypot(dx, dy);

    // If the two tracks are too far apart, draw two single portals instead of one giant double
    const maxDoubleSpan = portalRadius * 5;
    if (dist > maxDoubleSpan) {
      drawSinglePortal(portal, p1, flip);
      drawSinglePortal(portal, p2, flip);
      return;
    }

    let avgTan = {
      x: (d1.tangent.x + d2.tangent.x) / 2,
      z: (d1.tangent.z + d2.tangent.z) / 2,
    };
    const l = Math.hypot(avgTan.x, avgTan.z) || 1;
    avgTan = { x: avgTan.x / l, z: avgTan.z / l };
    if (flip) avgTan = { x: -avgTan.x, z: -avgTan.z };

    const nx = -avgTan.z;
    const ny = avgTan.x;
    const angle = Math.atan2(ny, nx);
    const doubleRadius = dist / 2 + portalRadius;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    if (portal.kind === "tunnel") {
      ctx.beginPath();
      ctx.ellipse(0, 0, doubleRadius + 4, portalRadius + 4, 0, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = "rgba(160, 140, 100, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(200, 180, 120, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, doubleRadius * 0.82, portalRadius * 0.72, 0, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = "rgba(25, 20, 15, 0.95)";
      ctx.fill();

      ctx.fillStyle = "rgba(180, 160, 110, 0.9)";
      ctx.fillRect(-4, -portalRadius - 3, 8, 8);
      ctx.fillStyle = "rgba(120, 105, 75, 0.7)";
      ctx.fillRect(-2, -portalRadius * 0.6, 4, portalRadius * 0.6);
    } else {
      ctx.beginPath();
      ctx.rect(-doubleRadius, -portalRadius, doubleRadius * 2, portalRadius * 2);
      ctx.fillStyle = "rgba(70, 100, 150, 0.85)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 140, 200, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  };

  // 1) paired portals: draw path + properly oriented mouths (start and end flipped 180°)
  for (const portal of portals) {
    if (!portal.pairedPortalId) continue;
    const partner = byId.get(portal.pairedPortalId);
    if (!partner) continue;

    const pairKey = [portal.id, partner.id].sort().join("|");
    if (drawnPairs.has(pairKey)) continue;
    drawnPairs.add(pairKey);

    // path highlight like classic terrain tunnel/bridge
    drawBetween(portal.track1, partner.track1, portal.kind);
    if (portal.width === "double" || partner.width === "double") {
      const a2 = portal.track2 ?? portal.track1;
      const b2 = partner.track2 ?? partner.track1;
      drawBetween(a2, b2, portal.kind);
    }

    // start portal — flipped 180° (same as end, both face inward toward the tunnel)
    if (portal.width === "double" && portal.track2) drawDoublePortal(portal, portal.track1, portal.track2, true);
    else drawSinglePortal(portal, portal.track1, true);

    // end portal — flipped 180° (was already correct before, restoring)
    if (partner.width === "double" && partner.track2) drawDoublePortal(partner, partner.track1, partner.track2, true);
    else drawSinglePortal(partner, partner.track1, true);
  }

  // 2) unpaired portals: draw standalone
  for (const portal of portals) {
    if (portal.pairedPortalId) continue;
    if (portal.width === "double" && portal.track2) drawDoublePortal(portal, portal.track1, portal.track2, false);
    else drawSinglePortal(portal, portal.track1, false);
  }
}
