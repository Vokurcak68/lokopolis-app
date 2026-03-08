"use client";

import React, { useState, useCallback, useRef } from "react";

/* ===========================
   TYPES
   =========================== */
type Scale = "H0" | "TT" | "N";
type TrackSystem = "roco-line" | "roco-geo" | "tillig" | "piko-a" | "fleischmann";
type BoardShape = "rectangle" | "l-shape" | "u-shape";
type LCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type LayoutCharacter =
  | "horska-trat"
  | "hlavni-koridor"
  | "stanice-vlecky"
  | "mala-diorama"
  | "prujezdna-stanice"
  | "prumyslova-vlecka";

interface TrackPiece {
  id: string;
  name: string;
  nameCz: string;
  length?: number;
  radius?: number;
  angle?: number;
  type: "straight" | "curve" | "turnout-left" | "turnout-right" | "crossing";
}

interface FormData {
  boardShape: BoardShape;
  width: number;
  height: number;
  width2: number;
  height2: number;
  lCorner: LCorner;
  uArmDepth: number;
  scale: Scale;
  trackSystem: TrackSystem;
  character: LayoutCharacter;
  prompt: string;
}

/* ===========================
   AI LAYOUT TYPES
   =========================== */
interface AISegment {
  type: "straight" | "curve" | "turnout" | "tunnel" | "bridge" | "merge" | "buffer";
  length?: number;
  direction?: "left" | "right";
  angle?: number;
  radius?: number;
  branch?: string;
  station?: string;
  into?: string;
  atSegment?: number;
}

interface AIRoute {
  id: string;
  name: string;
  color: string;
  segments: AISegment[];
  parentRoute?: string;
  branchFromSegment?: number;
}

interface AIFeature {
  type: string;
  name: string;
  routeId?: string;
  routeIds?: string[];
}

interface AILayoutData {
  name: string;
  routes: AIRoute[];
  features?: AIFeature[];
  bom_notes?: string;
}

/* ===========================
   TRACK CATALOGS
   =========================== */
const SCALE_FACTOR: Record<Scale, number> = { H0: 87, TT: 120, N: 160 };

const TRACK_CATALOGS: Record<TrackSystem, { name: string; pieces: TrackPiece[] }> = {
  "roco-line": {
    name: "ROCO GeoLine",
    pieces: [
      { id: "roco-g230", name: "G230", nameCz: "Rovná 230mm", length: 230, type: "straight" },
      { id: "roco-g200", name: "G200", nameCz: "Rovná 200mm", length: 200, type: "straight" },
      { id: "roco-g100", name: "G100", nameCz: "Rovná 100mm", length: 100, type: "straight" },
      { id: "roco-r2", name: "R2 (358mm)", nameCz: "Oblouk R2 (30°)", radius: 358, angle: 30, type: "curve" },
      { id: "roco-r3", name: "R3 (419mm)", nameCz: "Oblouk R3 (30°)", radius: 419, angle: 30, type: "curve" },
      { id: "roco-r4", name: "R4 (481mm)", nameCz: "Oblouk R4 (30°)", radius: 481, angle: 30, type: "curve" },
      { id: "roco-wl15", name: "WL15", nameCz: "Výhybka levá 15°", length: 230, type: "turnout-left" },
      { id: "roco-wr15", name: "WR15", nameCz: "Výhybka pravá 15°", length: 230, type: "turnout-right" },
    ],
  },
  "roco-geo": {
    name: "ROCO Line",
    pieces: [
      { id: "roco2-st228", name: "ST228", nameCz: "Rovná 228,9mm", length: 228.9, type: "straight" },
      { id: "roco2-st115", name: "ST115", nameCz: "Rovná 114,5mm", length: 114.5, type: "straight" },
      { id: "roco2-r2", name: "R2 (358mm)", nameCz: "Oblouk R2 (30°)", radius: 358, angle: 30, type: "curve" },
      { id: "roco2-r3", name: "R3 (419mm)", nameCz: "Oblouk R3 (30°)", radius: 419, angle: 30, type: "curve" },
      { id: "roco2-wl", name: "WL", nameCz: "Výhybka levá", length: 230, type: "turnout-left" },
      { id: "roco2-wr", name: "WR", nameCz: "Výhybka pravá", length: 230, type: "turnout-right" },
    ],
  },
  tillig: {
    name: "Tillig (TT)",
    pieces: [
      { id: "tillig-st166", name: "G1", nameCz: "Rovná 166mm", length: 166, type: "straight" },
      { id: "tillig-st83", name: "G2", nameCz: "Rovná 83mm", length: 83, type: "straight" },
      { id: "tillig-st41", name: "G3", nameCz: "Rovná 41,5mm", length: 41.5, type: "straight" },
      { id: "tillig-r310", name: "R310 (15°)", nameCz: "Oblouk R310 (15°)", radius: 310, angle: 15, type: "curve" },
      { id: "tillig-r353", name: "R353 (15°)", nameCz: "Oblouk R353 (15°)", radius: 353, angle: 15, type: "curve" },
      { id: "tillig-r396", name: "R396 (15°)", nameCz: "Oblouk R396 (15°)", radius: 396, angle: 15, type: "curve" },
      { id: "tillig-wl15", name: "EWL", nameCz: "Výhybka levá 15°", length: 166, type: "turnout-left" },
      { id: "tillig-wr15", name: "EWR", nameCz: "Výhybka pravá 15°", length: 166, type: "turnout-right" },
    ],
  },
  "piko-a": {
    name: "PIKO A",
    pieces: [
      { id: "piko-g231", name: "G231", nameCz: "Rovná 231mm", length: 231, type: "straight" },
      { id: "piko-g115", name: "G115", nameCz: "Rovná 115mm", length: 115, type: "straight" },
      { id: "piko-r1", name: "R1 (360mm)", nameCz: "Oblouk R1 (30°)", radius: 360, angle: 30, type: "curve" },
      { id: "piko-r2", name: "R2 (422mm)", nameCz: "Oblouk R2 (30°)", radius: 422, angle: 30, type: "curve" },
      { id: "piko-r3", name: "R3 (484mm)", nameCz: "Oblouk R3 (30°)", radius: 484, angle: 30, type: "curve" },
      { id: "piko-wl", name: "WL", nameCz: "Výhybka levá 15°", length: 239, type: "turnout-left" },
      { id: "piko-wr", name: "WR", nameCz: "Výhybka pravá 15°", length: 239, type: "turnout-right" },
    ],
  },
  fleischmann: {
    name: "Fleischmann Profi",
    pieces: [
      { id: "fl-st200", name: "6101", nameCz: "Rovná 200mm", length: 200, type: "straight" },
      { id: "fl-st100", name: "6103", nameCz: "Rovná 100mm", length: 100, type: "straight" },
      { id: "fl-st50", name: "6104", nameCz: "Rovná 50mm", length: 50, type: "straight" },
      { id: "fl-r1", name: "R1 (356mm)", nameCz: "Oblouk R1 (30°)", radius: 356.5, angle: 30, type: "curve" },
      { id: "fl-r2", name: "R2 (420mm)", nameCz: "Oblouk R2 (30°)", radius: 420, angle: 30, type: "curve" },
      { id: "fl-wl", name: "6170", nameCz: "Výhybka levá 15°", length: 200, type: "turnout-left" },
      { id: "fl-wr", name: "6171", nameCz: "Výhybka pravá 15°", length: 200, type: "turnout-right" },
    ],
  },
};

/* ===========================
   CHARACTER DEFINITIONS
   =========================== */
const CHARACTER_OPTIONS: { value: LayoutCharacter; label: string; icon: string; desc: string }[] = [
  { value: "horska-trat", label: "Horská trať", icon: "🏔️", desc: "Jednokolejka, tunely, stoupání" },
  { value: "hlavni-koridor", label: "Hlavní koridor", icon: "🚄", desc: "Dvoukolejná trať, rychlé vlaky" },
  { value: "stanice-vlecky", label: "Stanice + vlečky", icon: "🏛️", desc: "Stanice, vlečky, posun" },
  { value: "mala-diorama", label: "Malá dioráma", icon: "🏠", desc: "Kompaktní scéna, jednoduchý ovál" },
  { value: "prujezdna-stanice", label: "Průjezdná stanice", icon: "🔄", desc: "Ovál s výhybnou stanicí" },
  { value: "prumyslova-vlecka", label: "Průmyslová vlečka", icon: "🏭", desc: "Vlečky, rampy, posun" },
];

/* ===========================
   BOARD SHAPE OPTIONS
   =========================== */
const BOARD_SHAPES: { value: BoardShape; label: string; icon: string }[] = [
  { value: "rectangle", label: "Obdélník", icon: "▬" },
  { value: "l-shape", label: "Tvar L", icon: "⌐" },
  { value: "u-shape", label: "Tvar U", icon: "⊔" },
];

const L_CORNERS: { value: LCorner; label: string }[] = [
  { value: "top-left", label: "Vlevo nahoře" },
  { value: "top-right", label: "Vpravo nahoře" },
  { value: "bottom-left", label: "Vlevo dole" },
  { value: "bottom-right", label: "Vpravo dole" },
];

/* ===========================
   DETERMINISTIC SVG RENDERER
   =========================== */

interface RenderedPoint {
  x: number;
  y: number;
}

interface RenderedSegment {
  type: "line" | "arc";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // For arcs
  cx?: number;
  cy?: number;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  sweepCW?: boolean;
  // Metadata
  color: string;
  dashed?: boolean; // tunnel
  stationLabel?: string;
  isBridge?: boolean;
  isBuffer?: boolean;
  routeName?: string;
}

interface RenderedTurnout {
  x: number;
  y: number;
  color: string;
}

interface RenderedBuffer {
  x: number;
  y: number;
  angle: number; // heading in radians at the buffer
  color: string;
}

interface RenderedStation {
  x: number;
  y: number;
  angle: number;
  length: number;
  label: string;
  color: string;
}

interface RenderedTunnelPortal {
  x: number;
  y: number;
  angle: number;
}

interface RenderedLayout {
  segments: RenderedSegment[];
  turnouts: RenderedTurnout[];
  buffers: RenderedBuffer[];
  stations: RenderedStation[];
  tunnelPortals: RenderedTunnelPortal[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Process AI route data into rendered geometry.
 * Coordinate system: heading 0 = right (+x), angles increase clockwise.
 * 1mm = 0.5 SVG units (px).
 */
function renderLayout(data: AILayoutData): RenderedLayout {
  const S = 0.5; // mm to SVG scale
  const segments: RenderedSegment[] = [];
  const turnouts: RenderedTurnout[] = [];
  const buffers: RenderedBuffer[] = [];
  const stations: RenderedStation[] = [];
  const tunnelPortals: RenderedTunnelPortal[] = [];

  // Track position/heading after each segment for each route
  // Map: routeId -> array of { x, y, heading } after each segment
  const routeStates: Map<string, { x: number; y: number; heading: number }[]> = new Map();

  // First pass: render main route (no parentRoute), then branches
  const mainRoutes = data.routes.filter((r) => !r.parentRoute);
  const branchRoutes = data.routes.filter((r) => r.parentRoute);

  // Render a route starting from (startX, startY, startHeading)
  function renderRoute(
    route: AIRoute,
    startX: number,
    startY: number,
    startHeading: number
  ) {
    let x = startX;
    let y = startY;
    let heading = startHeading; // radians, 0 = right
    const stateHistory: { x: number; y: number; heading: number }[] = [{ x, y, heading }];

    for (const seg of route.segments) {
      switch (seg.type) {
        case "straight": {
          const len = (seg.length ?? 200) * S;
          const x2 = x + len * Math.cos(heading);
          const y2 = y + len * Math.sin(heading);
          segments.push({
            type: "line",
            x1: x,
            y1: y,
            x2,
            y2,
            color: route.color,
            stationLabel: seg.station,
            routeName: route.name,
          });
          if (seg.station) {
            stations.push({
              x: (x + x2) / 2,
              y: (y + y2) / 2,
              angle: heading,
              length: len,
              label: seg.station,
              color: route.color,
            });
          }
          x = x2;
          y = y2;
          break;
        }

        case "tunnel": {
          const len = (seg.length ?? 300) * S;
          const x2 = x + len * Math.cos(heading);
          const y2 = y + len * Math.sin(heading);
          // Entry portal
          tunnelPortals.push({ x, y, angle: heading });
          segments.push({
            type: "line",
            x1: x,
            y1: y,
            x2,
            y2,
            color: route.color,
            dashed: true,
            routeName: route.name,
          });
          // Exit portal
          tunnelPortals.push({ x: x2, y: y2, angle: heading + Math.PI });
          x = x2;
          y = y2;
          break;
        }

        case "bridge": {
          const len = (seg.length ?? 200) * S;
          const x2 = x + len * Math.cos(heading);
          const y2 = y + len * Math.sin(heading);
          segments.push({
            type: "line",
            x1: x,
            y1: y,
            x2,
            y2,
            color: route.color,
            isBridge: true,
            routeName: route.name,
          });
          x = x2;
          y = y2;
          break;
        }

        case "curve": {
          const radius = (seg.radius ?? 380) * S;
          const angleDeg = seg.angle ?? 30;
          const angleRad = (angleDeg * Math.PI) / 180;
          const dir = seg.direction ?? "right";

          // Center of the arc is perpendicular to heading
          // Right turn: center is to the right (+90° from heading)
          // Left turn: center is to the left (-90° from heading)
          const perpAngle = dir === "right" ? heading + Math.PI / 2 : heading - Math.PI / 2;
          const cx = x + radius * Math.cos(perpAngle);
          const cy = y + radius * Math.sin(perpAngle);

          // Start angle (from center to start point)
          const startAngle = Math.atan2(y - cy, x - cx);

          // End angle depends on direction
          let endAngle: number;
          if (dir === "right") {
            // CW sweep
            endAngle = startAngle + angleRad;
          } else {
            // CCW sweep
            endAngle = startAngle - angleRad;
          }

          const x2 = cx + radius * Math.cos(endAngle);
          const y2 = cy + radius * Math.sin(endAngle);

          segments.push({
            type: "arc",
            x1: x,
            y1: y,
            x2,
            y2,
            cx,
            cy,
            radius,
            startAngle,
            endAngle,
            sweepCW: dir === "right",
            color: route.color,
            routeName: route.name,
          });

          // Update heading
          if (dir === "right") {
            heading += angleRad;
          } else {
            heading -= angleRad;
          }
          // Normalize heading
          heading = ((heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

          x = x2;
          y = y2;
          break;
        }

        case "turnout": {
          // A turnout acts like a straight on the main route (the branch starts a separate route)
          // Mark the junction point
          turnouts.push({ x, y, color: route.color });
          // The turnout itself is a short straight (approx 100mm)
          const tLen = 100 * S;
          const x2 = x + tLen * Math.cos(heading);
          const y2 = y + tLen * Math.sin(heading);
          segments.push({
            type: "line",
            x1: x,
            y1: y,
            x2,
            y2,
            color: route.color,
            routeName: route.name,
          });
          x = x2;
          y = y2;
          break;
        }

        case "buffer": {
          buffers.push({ x, y, angle: heading, color: route.color });
          break;
        }

        case "merge": {
          // End of branch route — just stop here, the visual merging is implicit
          break;
        }
      }

      stateHistory.push({ x, y, heading });
    }

    routeStates.set(route.id, stateHistory);
  }

  // Render main routes starting from a sensible position
  // Start in the upper-left area, heading right
  for (const route of mainRoutes) {
    const startX = 100;
    const startY = 150;
    renderRoute(route, startX, startY, 0);
  }

  // Render branch routes
  for (const route of branchRoutes) {
    const parentStates = routeStates.get(route.parentRoute ?? "");
    if (!parentStates) continue;

    const branchIdx = (route.branchFromSegment ?? 0) + 1; // +1 because state[0] = initial
    const clampedIdx = Math.min(branchIdx, parentStates.length - 1);
    const branchPoint = parentStates[clampedIdx];

    // Branch starts at the turnout point with a slight divergence
    // Find the turnout segment in the parent to get the direction
    const parentRoute = data.routes.find((r) => r.id === route.parentRoute);
    const turnoutSeg = parentRoute?.segments[route.branchFromSegment ?? 0];
    let branchHeading = branchPoint.heading;
    if (turnoutSeg?.type === "turnout") {
      const divergeAngle = (15 * Math.PI) / 180; // standard 15° divergence
      if (turnoutSeg.direction === "left") {
        branchHeading -= divergeAngle;
      } else {
        branchHeading += divergeAngle;
      }
    }

    renderRoute(route, branchPoint.x, branchPoint.y, branchHeading);
  }

  // Compute bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const seg of segments) {
    minX = Math.min(minX, seg.x1, seg.x2);
    minY = Math.min(minY, seg.y1, seg.y2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    maxY = Math.max(maxY, seg.y1, seg.y2);
    if (seg.type === "arc" && seg.cx != null && seg.radius != null) {
      // Arc bounds approximation — include the center ± radius
      minX = Math.min(minX, seg.cx - seg.radius);
      minY = Math.min(minY, seg.cy! - seg.radius);
      maxX = Math.max(maxX, seg.cx + seg.radius);
      maxY = Math.max(maxY, seg.cy! + seg.radius);
    }
  }
  for (const b of buffers) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x);
    maxY = Math.max(maxY, b.y);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 400;
    maxY = 300;
  }

  return { segments, turnouts, buffers, stations, tunnelPortals, bounds: { minX, minY, maxX, maxY } };
}

/* ===========================
   AI TRACK PLAN SVG COMPONENT
   =========================== */
function AITrackPlanSVG({
  layout,
  data,
  form,
}: {
  layout: RenderedLayout;
  data: AILayoutData;
  form: FormData;
}) {
  const { segments, turnouts, buffers, stations, tunnelPortals, bounds } = layout;

  const margin = 80;
  const legendHeight = 90;
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;

  // SVG dimensions
  const svgW = contentW + margin * 2;
  const svgH = contentH + margin * 2 + legendHeight;
  const offX = margin - bounds.minX;
  const offY = margin - bounds.minY;

  // Grid dots (every 50 SVG units = 100mm)
  const gridStep = 50;
  const gridDotsX = Math.floor(contentW / gridStep) + 2;
  const gridDotsY = Math.floor(contentH / gridStep) + 2;

  // Board rectangle dimensions in SVG units
  const boardSvgW = form.width * 10 * 0.5;
  const boardSvgH = form.height * 10 * 0.5;

  // Sleeper marks along a line
  const renderLineSleepers = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return null;
    const nx = -dy / len;
    const ny = dx / len;
    const spacing = 15;
    const count = Math.max(1, Math.floor(len / spacing));
    const halfW = 5;
    const sleepers: React.ReactElement[] = [];
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      sleepers.push(
        <line
          key={`sl${i}`}
          x1={px - nx * halfW}
          y1={py - ny * halfW}
          x2={px + nx * halfW}
          y2={py + ny * halfW}
          stroke={color}
          strokeWidth={0.8}
          opacity={0.3}
        />
      );
    }
    return sleepers;
  };

  // Sleeper marks along an arc
  const renderArcSleepers = (seg: RenderedSegment) => {
    if (!seg.cx || !seg.cy || !seg.radius || seg.startAngle == null || seg.endAngle == null) return null;
    const r = seg.radius;
    let startA = seg.startAngle;
    let endA = seg.endAngle;
    let angleDiff = endA - startA;
    if (seg.sweepCW && angleDiff < 0) angleDiff += Math.PI * 2;
    if (!seg.sweepCW && angleDiff > 0) angleDiff -= Math.PI * 2;
    const absAngleDiff = Math.abs(angleDiff);
    const arcLen = r * absAngleDiff;
    const spacing = 15;
    const count = Math.max(1, Math.floor(arcLen / spacing));
    const halfW = 5;
    const sleepers: React.ReactElement[] = [];
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const a = startA + angleDiff * t;
      const px = seg.cx + r * Math.cos(a);
      const py = seg.cy + r * Math.sin(a);
      // Radial direction for sleeper
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      sleepers.push(
        <line
          key={`csl${i}`}
          x1={px - nx * halfW}
          y1={py - ny * halfW}
          x2={px + nx * halfW}
          y2={py + ny * halfW}
          stroke={seg.color}
          strokeWidth={0.8}
          opacity={0.3}
        />
      );
    }
    return sleepers;
  };

  // Render a segment
  const renderSegment = (seg: RenderedSegment, i: number) => {
    const strokeW = 3.5;
    const dashArray = seg.dashed ? "8,5" : undefined;
    const sx = seg.x1 + offX;
    const sy = seg.y1 + offY;
    const ex = seg.x2 + offX;
    const ey = seg.y2 + offY;

    if (seg.type === "line") {
      return (
        <g key={`seg${i}`}>
          {renderLineSleepers(sx, sy, ex, ey, seg.color)}
          <line
            x1={sx}
            y1={sy}
            x2={ex}
            y2={ey}
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={dashArray}
          />
          {/* Bridge pillars */}
          {seg.isBridge && (
            <>
              <line
                x1={sx + (ex - sx) * 0.25}
                y1={sy + (ey - sy) * 0.25 - 6}
                x2={sx + (ex - sx) * 0.25}
                y2={sy + (ey - sy) * 0.25 + 6}
                stroke={seg.color}
                strokeWidth={2}
                opacity={0.5}
              />
              <line
                x1={sx + (ex - sx) * 0.75}
                y1={sy + (ey - sy) * 0.75 - 6}
                x2={sx + (ex - sx) * 0.75}
                y2={sy + (ey - sy) * 0.75 + 6}
                stroke={seg.color}
                strokeWidth={2}
                opacity={0.5}
              />
            </>
          )}
        </g>
      );
    }

    if (seg.type === "arc" && seg.cx != null && seg.cy != null && seg.radius != null && seg.startAngle != null && seg.endAngle != null) {
      const r = seg.radius;
      const cxo = seg.cx + offX;
      const cyo = seg.cy + offY;

      // Compute start/end points on the arc
      const ax1 = cxo + r * Math.cos(seg.startAngle);
      const ay1 = cyo + r * Math.sin(seg.startAngle);
      const ax2 = cxo + r * Math.cos(seg.endAngle);
      const ay2 = cyo + r * Math.sin(seg.endAngle);

      let angleDiff = seg.endAngle - seg.startAngle;
      if (seg.sweepCW && angleDiff < 0) angleDiff += Math.PI * 2;
      if (!seg.sweepCW && angleDiff > 0) angleDiff -= Math.PI * 2;
      const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;
      const sweepFlag = seg.sweepCW ? 1 : 0;

      const pathD = `M ${ax1} ${ay1} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ax2} ${ay2}`;

      // For sleepers, create an offset version of the segment
      const offsetSeg = { ...seg, cx: cxo, cy: cyo };

      return (
        <g key={`seg${i}`}>
          {renderArcSleepers(offsetSeg)}
          <path
            d={pathD}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={dashArray}
          />
        </g>
      );
    }

    return null;
  };

  // Unique route colors for legend
  const routeColors = data.routes.map((r) => ({ id: r.id, name: r.name, color: r.color }));

  return (
    <svg
      viewBox={`0 0 ${Math.max(svgW, 300)} ${Math.max(svgH, 250)}`}
      style={{
        width: "100%",
        maxWidth: "900px",
        background: "var(--bg-card)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
      }}
    >
      {/* Board background */}
      <rect
        x={offX + (bounds.minX < 0 ? 0 : 0)}
        y={offY + (bounds.minY < 0 ? 0 : 0)}
        width={Math.max(boardSvgW, contentW + 40)}
        height={Math.max(boardSvgH, contentH + 40)}
        rx={4}
        fill="var(--bg-input)"
        stroke="var(--border-hover)"
        strokeWidth={2}
        opacity={0.5}
      />

      {/* Grid dots */}
      {Array.from({ length: gridDotsX }, (_, xi) =>
        Array.from({ length: gridDotsY }, (_, yi) => (
          <circle
            key={`gd${xi}-${yi}`}
            cx={offX + bounds.minX + xi * gridStep}
            cy={offY + bounds.minY + yi * gridStep}
            r={1}
            fill="var(--border)"
            opacity={0.3}
          />
        ))
      )}

      {/* Track segments */}
      {segments.map((seg, i) => renderSegment(seg, i))}

      {/* Turnout markers */}
      {turnouts.map((t, i) => (
        <g key={`to${i}`}>
          <circle
            cx={t.x + offX}
            cy={t.y + offY}
            r={4}
            fill={t.color}
            opacity={0.8}
          />
          <circle
            cx={t.x + offX}
            cy={t.y + offY}
            r={6}
            fill="none"
            stroke={t.color}
            strokeWidth={1}
            opacity={0.4}
          />
        </g>
      ))}

      {/* Buffer stops */}
      {buffers.map((b, i) => {
        const bx = b.x + offX;
        const by = b.y + offY;
        const perpAngle = b.angle + Math.PI / 2;
        const halfLen = 6;
        return (
          <g key={`buf${i}`}>
            <line
              x1={bx + halfLen * Math.cos(perpAngle)}
              y1={by + halfLen * Math.sin(perpAngle)}
              x2={bx - halfLen * Math.cos(perpAngle)}
              y2={by - halfLen * Math.sin(perpAngle)}
              stroke={b.color}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={bx} cy={by} r={2.5} fill={b.color} />
          </g>
        );
      })}

      {/* Station labels & platforms */}
      {stations.map((st, i) => {
        const sx = st.x + offX;
        const sy = st.y + offY;
        const perpAngle = st.angle + Math.PI / 2;
        const platformOffset = 10;
        // Platform rectangle (parallel to track)
        const pw = st.length * 0.7;
        const ph = 6;
        const pcx = sx + platformOffset * Math.cos(perpAngle);
        const pcy = sy + platformOffset * Math.sin(perpAngle);
        const angleDeg = (st.angle * 180) / Math.PI;

        return (
          <g key={`sta${i}`}>
            <rect
              x={pcx - pw / 2}
              y={pcy - ph / 2}
              width={pw}
              height={ph}
              rx={2}
              fill="#8b7355"
              opacity={0.5}
              transform={`rotate(${angleDeg}, ${pcx}, ${pcy})`}
            />
            <text
              x={pcx}
              y={pcy - ph - 4}
              fill="var(--text-muted)"
              fontSize={10}
              fontWeight={600}
              textAnchor="middle"
            >
              🏛️ {st.label}
            </text>
          </g>
        );
      })}

      {/* Tunnel portals */}
      {tunnelPortals.map((tp, i) => {
        const px = tp.x + offX;
        const py = tp.y + offY;
        return (
          <g key={`tp${i}`}>
            <path
              d={`M ${px - 7} ${py + 3} Q ${px - 7} ${py - 7} ${px} ${py - 9} Q ${px + 7} ${py - 7} ${px + 7} ${py + 3} Z`}
              fill="var(--text-dim)"
              opacity={0.25}
              stroke="var(--text-dim)"
              strokeWidth={0.8}
            />
          </g>
        );
      })}

      {/* Dimension labels */}
      <text
        x={offX + contentW / 2}
        y={offY + bounds.minY - 10}
        fill="var(--text-dim)"
        fontSize={11}
        textAnchor="middle"
        fontWeight={600}
      >
        {form.width} × {form.height} cm
      </text>

      {/* Legend */}
      <g transform={`translate(${margin}, ${offY + contentH + 30})`}>
        <text fill="var(--text-dim)" fontSize={10} fontWeight={700} y={0}>
          LEGENDA
        </text>
        {routeColors.map((rc, i) => (
          <g key={rc.id} transform={`translate(${i * 150}, 14)`}>
            <line x1={0} y1={0} x2={25} y2={0} stroke={rc.color} strokeWidth={3.5} strokeLinecap="round" />
            <text x={30} y={4} fill="var(--text-dim)" fontSize={9}>
              {rc.name}
            </text>
          </g>
        ))}
      </g>

      {/* Scale indicator */}
      <text
        x={margin}
        y={offY + contentH + 55}
        fill="var(--text-faint)"
        fontSize={9}
      >
        Měřítko {form.scale} (1:{SCALE_FACTOR[form.scale]}) · {TRACK_CATALOGS[form.trackSystem].name}
      </text>
    </svg>
  );
}

/* ===========================
   MAIN PAGE
   =========================== */
export default function TrackDesignerPage() {
  const [form, setForm] = useState<FormData>({
    boardShape: "rectangle",
    width: 200,
    height: 100,
    width2: 80,
    height2: 60,
    lCorner: "bottom-right",
    uArmDepth: 40,
    scale: "H0",
    trackSystem: "roco-line",
    character: "prujezdna-stanice",
    prompt: "",
  });
  const [aiData, setAiData] = useState<AILayoutData | null>(null);
  const [renderedLayout, setRenderedLayout] = useState<RenderedLayout | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setAiData(null);
    setRenderedLayout(null);

    try {
      const res = await fetch("/api/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: form.prompt,
          boardShape: form.boardShape,
          width: form.width,
          height: form.height,
          width2: form.width2,
          height2: form.height2,
          uArmDepth: form.uArmDepth,
          lCorner: form.lCorner,
          scale: form.scale,
          trackSystem: form.trackSystem,
          character: form.character,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || `Chyba serveru (${res.status})`);
        return;
      }

      const layoutData: AILayoutData = json.result;
      setAiData(layoutData);

      // Stage 2: deterministic render
      const rendered = renderLayout(layoutData);
      setRenderedLayout(rendered);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setError("Chyba při komunikaci se serverem: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }, [form]);

  const update = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-input)",
    borderRadius: "8px",
    color: "var(--text-body)",
    fontSize: "14px",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8ea0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "36px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: "6px",
    display: "block",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "24px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-hero-start) 0%, var(--bg-hero-mid) 50%, var(--bg-hero-end) 100%)",
          padding: "48px 20px 40px",
          textAlign: "center",
          borderBottom: "1px solid var(--border)",
          position: "relative",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🛤️</div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Návrhář tratí
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-dim)", maxWidth: "500px", margin: "0 auto" }}>
          AI navrhne koncept kolejiště, renderer ho vykreslí s přesnou geometrií
        </p>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Form */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
            ⚙️ Parametry kolejiště
          </h2>

          {/* Board shape selector */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Tvar desky</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {BOARD_SHAPES.map((bs) => (
                <button
                  key={bs.value}
                  onClick={() => update("boardShape", bs.value)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: `2px solid ${form.boardShape === bs.value ? "var(--accent)" : "var(--border)"}`,
                    background: form.boardShape === bs.value ? "var(--accent-bg)" : "var(--bg-input)",
                    color: form.boardShape === bs.value ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: form.boardShape === bs.value ? 700 : 500,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ marginRight: "6px" }}>{bs.icon}</span>
                  {bs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={labelStyle}>
                {form.boardShape === "rectangle" ? "Šířka desky (cm)" : "Šířka hlavní části (cm)"}
              </label>
              <input
                type="number" value={form.width}
                onChange={(e) => update("width", Number(e.target.value))}
                min={60} max={600} style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                {form.boardShape === "rectangle" ? "Hloubka desky (cm)" : "Hloubka hlavní části (cm)"}
              </label>
              <input
                type="number" value={form.height}
                onChange={(e) => update("height", Number(e.target.value))}
                min={40} max={400} style={inputStyle}
              />
            </div>

            {form.boardShape === "l-shape" && (
              <>
                <div>
                  <label style={labelStyle}>Šířka ramene L (cm)</label>
                  <input
                    type="number" value={form.width2}
                    onChange={(e) => update("width2", Number(e.target.value))}
                    min={30} max={300} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Hloubka ramene L (cm)</label>
                  <input
                    type="number" value={form.height2}
                    onChange={(e) => update("height2", Number(e.target.value))}
                    min={30} max={300} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Roh L</label>
                  <select
                    value={form.lCorner}
                    onChange={(e) => update("lCorner", e.target.value as LCorner)}
                    style={selectStyle}
                  >
                    {L_CORNERS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {form.boardShape === "u-shape" && (
              <div>
                <label style={labelStyle}>Hloubka ramen U (cm)</label>
                <input
                  type="number" value={form.uArmDepth}
                  onChange={(e) => update("uArmDepth", Number(e.target.value))}
                  min={20} max={200} style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Scale & Track system */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label style={labelStyle}>Měřítko</label>
              <select value={form.scale} onChange={(e) => update("scale", e.target.value as Scale)} style={selectStyle}>
                <option value="H0">H0 (1:87)</option>
                <option value="TT">TT (1:120)</option>
                <option value="N">N (1:160)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Systém kolejí</label>
              <select value={form.trackSystem} onChange={(e) => update("trackSystem", e.target.value as TrackSystem)} style={selectStyle}>
                <option value="roco-line">ROCO GeoLine</option>
                <option value="roco-geo">ROCO Line</option>
                <option value="piko-a">PIKO A</option>
                <option value="fleischmann">Fleischmann Profi</option>
                <option value="tillig">Tillig (TT)</option>
              </select>
            </div>
          </div>

          {/* Layout character picker */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Charakter tratě</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "10px" }}>
              {CHARACTER_OPTIONS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => update("character", ch.value)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: "10px",
                    border: `2px solid ${form.character === ch.value ? "var(--accent)" : "var(--border)"}`,
                    background: form.character === ch.value ? "var(--accent-bg)" : "var(--bg-input)",
                    color: form.character === ch.value ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: form.character === ch.value ? 700 : 500,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "4px" }}>{ch.icon}</div>
                  <div>{ch.label}</div>
                  <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.7, fontWeight: 400 }}>{ch.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* User prompt */}
          <div style={{ marginBottom: "28px" }}>
            <label style={labelStyle}>Vlastní požadavky (volitelné)</label>
            <textarea
              value={form.prompt}
              onChange={(e) => update("prompt", e.target.value)}
              placeholder="Např.: chci horskou trať s tunelem a malou stanicí, dvě smyčky propojené mostem..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "10px",
              border: "none",
              background: generating ? "var(--border-hover)" : "linear-gradient(135deg, #667eea, #764ba2)",
              color: generating ? "var(--text-dim)" : "#fff",
              fontSize: "17px",
              fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.3px",
            }}
          >
            {generating ? (
              <span>
                <span style={{
                  display: "inline-block",
                  animation: "trainMove 2s linear infinite",
                }}>
                  🚂
                </span>
                {" "}AI navrhuje kolejiště...
              </span>
            ) : (
              "🤖 Navrhnout kolejiště"
            )}
          </button>

          {/* Train animation keyframes */}
          {generating && (
            <style>{`
              @keyframes trainMove {
                0% { transform: translateX(-20px); }
                50% { transform: translateX(20px); }
                100% { transform: translateX(-20px); }
              }
            `}</style>
          )}
        </div>

        {/* Results area */}
        <div ref={resultRef} style={{ marginTop: "32px" }}>
          {/* Error */}
          {error && (
            <div style={{ ...cardStyle, marginBottom: "20px", borderColor: "rgba(244, 67, 54, 0.4)" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f44336", marginBottom: "12px" }}>
                ❌ Chyba
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {error}
              </p>
              <button
                onClick={handleGenerate}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-body)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                🔄 Zkusit znovu
              </button>
            </div>
          )}

          {/* Results */}
          {aiData && renderedLayout && (
            <>
              {/* Layout name */}
              <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                  🚂 {aiData.name}
                </h2>
                {aiData.features && aiData.features.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "12px" }}>
                    {aiData.features.map((f, i) => {
                      const featureIcons: Record<string, string> = {
                        station: "🏛️",
                        tunnel: "🚇",
                        bridge: "🌉",
                        depot: "🏗️",
                        yard: "📦",
                      };
                      return (
                        <span
                          key={i}
                          style={{
                            padding: "4px 12px",
                            borderRadius: "20px",
                            background: "var(--accent-bg)",
                            border: "1px solid var(--border)",
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {featureIcons[f.type] || "📍"} {f.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SVG Track Plan */}
              <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", textAlign: "left" }}>
                  📐 Kolejový plán
                </h2>
                <AITrackPlanSVG layout={renderedLayout} data={aiData} form={form} />
              </div>

              {/* BOM notes from AI */}
              {aiData.bom_notes && (
                <div style={{ ...cardStyle, marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                    🛒 Odhad materiálu (AI)
                  </h2>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {aiData.bom_notes}
                  </p>
                </div>
              )}

              {/* Route details */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                  🗂️ Trasy
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Barva", "Název", "Typ", "Segmenty"].map((header, hi) => (
                          <th key={hi} style={{
                            textAlign: hi === 3 ? "center" : "left",
                            padding: "10px 12px",
                            borderBottom: "2px solid var(--border)",
                            color: "var(--accent)",
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.5px",
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aiData.routes.map((route, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light, var(--border))" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{
                              width: "20px",
                              height: "4px",
                              borderRadius: "2px",
                              background: route.color,
                            }} />
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "14px", color: "var(--text-body)", fontWeight: 600 }}>
                            {route.name}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-dim)" }}>
                            {route.parentRoute ? "Odbočka" : "Hlavní"}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "16px", fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>
                            {route.segments.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{
                  marginTop: "16px", paddingTop: "12px",
                  borderTop: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>Celkem tras</span>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {aiData.routes.length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
