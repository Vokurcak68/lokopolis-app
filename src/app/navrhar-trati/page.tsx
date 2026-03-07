"use client";

import { useState, useCallback, useRef } from "react";

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
}

/* ===========================
   AI TRACK TYPES
   =========================== */
interface TrackStraight {
  type: "straight";
  x1: number; y1: number; x2: number; y2: number;
  label?: string;
  secondary?: boolean;
}
interface TrackCurve {
  type: "curve";
  cx: number; cy: number; r: number;
  startAngle: number; endAngle: number;
  label?: string;
  secondary?: boolean;
}
interface TrackTurnout {
  type: "turnout";
  x: number; y: number;
  angle: number;
  direction: "left" | "right";
  label?: string;
}
interface TrackStation {
  type: "station";
  x: number; y: number;
  width: number;
  tracks: number;
  label?: string;
}
interface TrackBuffer {
  type: "buffer";
  x: number; y: number;
  angle: number;
}
interface TrackTunnel {
  type: "tunnel";
  x1: number; y1: number; x2: number; y2: number;
  label?: string;
  secondary?: boolean;
}
interface TrackBridge {
  type: "bridge";
  x1: number; y1: number; x2: number; y2: number;
  label?: string;
  secondary?: boolean;
}

type TrackSegment = TrackStraight | TrackCurve | TrackTurnout | TrackStation | TrackBuffer | TrackTunnel | TrackBridge;

interface TrackLabel {
  x: number; y: number;
  text: string;
  fontSize?: number;
}

interface AIResult {
  description: string;
  bom: { name: string; nameCz: string; type: string; count: number }[];
  warnings: string[];
  tracks: TrackSegment[];
  labels?: TrackLabel[];
  board: { width: number; height: number };
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
   AI TRACK PLAN SVG RENDERER
   =========================== */
function AITrackPlanSVG({ tracks, labels, board, form }: {
  tracks: TrackSegment[];
  labels?: TrackLabel[];
  board: { width: number; height: number };
  form: FormData;
}) {
  const boardW = board.width;
  const boardH = board.height;
  const padding = 60;
  const svgW = 800;

  // Compute total SVG area based on board shape
  let totalW = boardW;
  let totalH = boardH;
  if (form.boardShape === "l-shape") {
    totalW = Math.max(boardW, form.width2 * 10);
    totalH = boardH + form.height2 * 10;
  } else if (form.boardShape === "u-shape") {
    totalW = boardW + 2 * form.uArmDepth * 10;
  }

  const svgH = (totalH / totalW) * (svgW - padding * 2) + padding * 2;
  const sc = (svgW - padding * 2) / totalW;
  const offX = padding;
  const offY = padding / 2;

  // Transform mm coordinates to SVG coordinates
  const tx = (x: number) => offX + x * sc;
  const ty = (y: number) => offY + y * sc;

  // Board polygon path
  let boardPath = "";
  if (form.boardShape === "rectangle") {
    boardPath = `M ${offX} ${offY} h ${boardW * sc} v ${boardH * sc} h ${-boardW * sc} Z`;
  } else if (form.boardShape === "l-shape") {
    const w1 = boardW * sc, h1 = boardH * sc;
    const w2 = form.width2 * 10 * sc, h2 = form.height2 * 10 * sc;
    if (form.lCorner === "bottom-left" || form.lCorner === "top-left") {
      boardPath = `M ${offX} ${offY} h ${w1} v ${h1} h ${-(w1 - w2)} v ${h2} h ${-w2} Z`;
    } else {
      boardPath = `M ${offX} ${offY} h ${w1} v ${h1 + h2} h ${-w2} v ${-h2} h ${-(w1 - w2)} Z`;
    }
  } else if (form.boardShape === "u-shape") {
    const armW = form.uArmDepth * 10 * sc;
    const w = boardW * sc, h = boardH * sc;
    boardPath = `M ${offX} ${offY} h ${armW} v ${h * 0.4} h ${w} v ${-h * 0.4} h ${armW} v ${h} h ${-(w + 2 * armW)} Z`;
  }

  // Grid lines
  const gridLinesV = Math.floor(totalW / 100) + 1;
  const gridLinesH = Math.floor(totalH / 100) + 1;

  // Helper: SVG arc path for a curve segment
  const curveArcPath = (seg: TrackCurve): string => {
    const r = seg.r * sc;
    const cxs = tx(seg.cx);
    const cys = ty(seg.cy);
    // Convert angles to radians (0° = right/east, clockwise)
    const startRad = (seg.startAngle * Math.PI) / 180;
    const endRad = (seg.endAngle * Math.PI) / 180;
    const sx = cxs + r * Math.cos(startRad);
    const sy = cys + r * Math.sin(startRad);
    const ex = cxs + r * Math.cos(endRad);
    const ey = cys + r * Math.sin(endRad);

    // Determine sweep
    let angleDiff = seg.endAngle - seg.startAngle;
    if (angleDiff < 0) angleDiff += 360;
    const largeArc = angleDiff > 180 ? 1 : 0;
    const sweepFlag = 1; // clockwise

    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ex} ${ey}`;
  };

  // Render individual track segments
  const renderSegment = (seg: TrackSegment, i: number) => {
    const isSecondary = "secondary" in seg && seg.secondary;

    switch (seg.type) {
      case "straight": {
        return (
          <g key={`t${i}`}>
            <line
              x1={tx(seg.x1)} y1={ty(seg.y1)}
              x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke="var(--accent)"
              strokeWidth={isSecondary ? 2 : 3.5}
              strokeLinecap="round"
              opacity={isSecondary ? 0.5 : 1}
            />
            {seg.label && (
              <text
                x={(tx(seg.x1) + tx(seg.x2)) / 2}
                y={(ty(seg.y1) + ty(seg.y2)) / 2 - 8}
                fill="var(--text-dim)" fontSize="9" textAnchor="middle"
              >
                {seg.label}
              </text>
            )}
          </g>
        );
      }

      case "curve": {
        const pathD = curveArcPath(seg);
        return (
          <g key={`t${i}`}>
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={isSecondary ? 2 : 3.5}
              strokeLinecap="round"
              opacity={isSecondary ? 0.5 : 1}
            />
            {seg.label && (() => {
              const midAngle = ((seg.startAngle + seg.endAngle) / 2 * Math.PI) / 180;
              const lx = tx(seg.cx) + seg.r * sc * Math.cos(midAngle);
              const ly = ty(seg.cy) + seg.r * sc * Math.sin(midAngle);
              return (
                <text x={lx} y={ly - 8} fill="var(--text-dim)" fontSize="9" textAnchor="middle">
                  {seg.label}
                </text>
              );
            })()}
          </g>
        );
      }

      case "turnout": {
        // Draw turnout: main straight + diverging branch
        const len = 30 * sc;
        const angleRad = (seg.angle * Math.PI) / 180;
        // Assume the turnout is oriented horizontally (0° = east) for now
        // We draw a short straight and a diverging line
        const sx = tx(seg.x);
        const sy = ty(seg.y);
        const dirMul = seg.direction === "left" ? -1 : 1;

        return (
          <g key={`t${i}`}>
            {/* Main straight path through turnout */}
            <line
              x1={sx - len / 2} y1={sy}
              x2={sx + len / 2} y2={sy}
              stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round"
            />
            {/* Diverging path */}
            <line
              x1={sx} y1={sy}
              x2={sx + len / 2} y2={sy + dirMul * len * Math.tan(angleRad)}
              stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.6"
            />
            {/* Turnout marker dot */}
            <circle cx={sx} cy={sy} r={3} fill="var(--accent)" opacity="0.8" />
            {seg.label && (
              <text x={sx} y={sy - 10} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
                {seg.label}
              </text>
            )}
          </g>
        );
      }

      case "station": {
        const sx = tx(seg.x);
        const sy = ty(seg.y);
        const sw = seg.width * sc;
        const trackSpacing = 12;
        const stationH = (seg.tracks + 1) * trackSpacing;

        return (
          <g key={`t${i}`}>
            {/* Station platform background */}
            <rect
              x={sx} y={sy}
              width={sw} height={stationH}
              fill="var(--accent)" opacity="0.08"
              stroke="var(--accent)" strokeWidth="0.8"
              rx="4" strokeDasharray="4,2"
            />
            {/* Station tracks */}
            {Array.from({ length: seg.tracks }, (_, ti) => (
              <line
                key={`st${i}-${ti}`}
                x1={sx + 8} y1={sy + (ti + 1) * trackSpacing}
                x2={sx + sw - 8} y2={sy + (ti + 1) * trackSpacing}
                stroke="var(--accent)"
                strokeWidth={ti === 0 ? 3 : 2}
                strokeLinecap="round"
                opacity={ti === 0 ? 1 : 0.4 + 0.1 * ti}
              />
            ))}
            {/* Platform rectangle between tracks */}
            {seg.tracks >= 2 && (
              <rect
                x={sx + sw * 0.15} y={sy + trackSpacing + 3}
                width={sw * 0.7} height={trackSpacing - 6}
                fill="var(--accent)" opacity="0.12" rx="2"
              />
            )}
            {/* Station label */}
            {seg.label && (
              <text
                x={sx + sw / 2} y={sy - 6}
                fill="var(--accent)" fontSize="11" textAnchor="middle" fontWeight="600"
              >
                🏛️ {seg.label}
              </text>
            )}
          </g>
        );
      }

      case "buffer": {
        const bx = tx(seg.x);
        const by = ty(seg.y);
        const angleRad = (seg.angle * Math.PI) / 180;
        // Perpendicular line
        const perpLen = 8;
        const px = Math.cos(angleRad + Math.PI / 2) * perpLen;
        const py = Math.sin(angleRad + Math.PI / 2) * perpLen;

        return (
          <g key={`t${i}`}>
            <line
              x1={bx - px} y1={by - py}
              x2={bx + px} y2={by + py}
              stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
            />
            <circle cx={bx} cy={by} r={2.5} fill="var(--accent)" />
          </g>
        );
      }

      case "tunnel": {
        return (
          <g key={`t${i}`}>
            <line
              x1={tx(seg.x1)} y1={ty(seg.y1)}
              x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke="var(--accent)"
              strokeWidth={isSecondary ? 2 : 3.5}
              strokeLinecap="round"
              strokeDasharray="8,4"
              opacity={isSecondary ? 0.4 : 0.7}
            />
            {/* Tunnel portal markers */}
            <rect
              x={tx(seg.x1) - 4} y={ty(seg.y1) - 4}
              width="8" height="8" rx="2"
              fill="var(--text-dim)" opacity="0.4"
            />
            <rect
              x={tx(seg.x2) - 4} y={ty(seg.y2) - 4}
              width="8" height="8" rx="2"
              fill="var(--text-dim)" opacity="0.4"
            />
            {seg.label && (
              <text
                x={(tx(seg.x1) + tx(seg.x2)) / 2}
                y={(ty(seg.y1) + ty(seg.y2)) / 2 - 10}
                fill="var(--text-dim)" fontSize="9" textAnchor="middle"
              >
                🚇 {seg.label}
              </text>
            )}
          </g>
        );
      }

      case "bridge": {
        const bx1 = tx(seg.x1), by1 = ty(seg.y1);
        const bx2 = tx(seg.x2), by2 = ty(seg.y2);
        const dx = bx2 - bx1;
        const dy = by2 - by1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const pierCount = Math.max(2, Math.round(len / 30));
        // Perpendicular direction for piers
        const nx = -dy / len;
        const ny = dx / len;
        const pierH = 10;

        return (
          <g key={`t${i}`}>
            {/* Track line */}
            <line
              x1={bx1} y1={by1} x2={bx2} y2={by2}
              stroke="var(--accent)"
              strokeWidth={isSecondary ? 2 : 3.5}
              strokeLinecap="round"
              opacity={isSecondary ? 0.5 : 1}
            />
            {/* Pier supports */}
            {Array.from({ length: pierCount }, (_, pi) => {
              const t = (pi + 0.5) / pierCount;
              const px = bx1 + dx * t;
              const py = by1 + dy * t;
              return (
                <line
                  key={`pier${i}-${pi}`}
                  x1={px} y1={py}
                  x2={px + nx * pierH} y2={py + ny * pierH}
                  stroke="var(--accent)" strokeWidth="1.5" opacity="0.4"
                />
              );
            })}
            {/* Base line connecting pier bottoms */}
            <line
              x1={bx1 + nx * pierH} y1={by1 + ny * pierH}
              x2={bx2 + nx * pierH} y2={by2 + ny * pierH}
              stroke="var(--accent)" strokeWidth="1" opacity="0.25"
            />
            {seg.label && (
              <text
                x={(bx1 + bx2) / 2} y={(by1 + by2) / 2 - 10}
                fill="var(--text-dim)" fontSize="9" textAnchor="middle"
              >
                🌉 {seg.label}
              </text>
            )}
          </g>
        );
      }

      default:
        return null;
    }
  };

  return (
    <svg
      viewBox={`0 0 ${svgW} ${Math.max(svgH + 10, 200)}`}
      style={{
        width: "100%",
        maxWidth: "800px",
        background: "var(--bg-card)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
      }}
    >
      {/* Board shape background */}
      <path
        d={boardPath}
        fill="var(--bg-input)"
        stroke="var(--border-hover)"
        strokeWidth="2"
      />

      {/* Grid lines every 100mm */}
      {Array.from({ length: gridLinesV }, (_, i) => (
        <line
          key={`gv${i}`}
          x1={offX + i * 100 * sc} y1={offY}
          x2={offX + i * 100 * sc} y2={offY + totalH * sc}
          stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4"
        />
      ))}
      {Array.from({ length: gridLinesH }, (_, i) => (
        <line
          key={`gh${i}`}
          x1={offX} y1={offY + i * 100 * sc}
          x2={offX + totalW * sc} y2={offY + i * 100 * sc}
          stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4"
        />
      ))}

      {/* Dimension labels on edges */}
      <text x={offX + boardW * sc / 2} y={offY - 10} fill="var(--text-dim)" fontSize="12" textAnchor="middle">
        {form.width} cm ({boardW} mm)
      </text>
      <text
        x={offX - 10} y={offY + boardH * sc / 2}
        fill="var(--text-dim)" fontSize="12" textAnchor="middle"
        transform={`rotate(-90, ${offX - 10}, ${offY + boardH * sc / 2})`}
      >
        {form.height} cm ({boardH} mm)
      </text>

      {/* Track segments */}
      {tracks.map((seg, i) => renderSegment(seg, i))}

      {/* Labels from AI */}
      {labels?.map((lbl, i) => (
        <text
          key={`lbl${i}`}
          x={tx(lbl.x)} y={ty(lbl.y)}
          fill="var(--text-dim)"
          fontSize={lbl.fontSize ? lbl.fontSize * sc * 1.5 : 10}
          textAnchor="middle"
        >
          {lbl.text}
        </text>
      ))}

      {/* Scale indicator */}
      <text x={offX + totalW * sc - 5} y={Math.max(svgH, 190) - 5} fill="var(--text-faint)" fontSize="10" textAnchor="end">
        {form.scale} 1:{SCALE_FACTOR[form.scale]} · {TRACK_CATALOGS[form.trackSystem].name} · AI návrh
      </text>
    </svg>
  );
}

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
  });
  const [prompt, setPrompt] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setAiGenerating(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await fetch("/api/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || "Navrhni optimální kolejiště podle zadaných parametrů.",
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

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || "Neznámá chyba");
      } else if (data.result) {
        setAiResult(data.result);
      } else {
        setAiError("AI nevrátila výsledek");
      }
    } catch {
      setAiError("Chyba připojení k serveru");
    } finally {
      setAiGenerating(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [form, prompt]);

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
          Zadejte rozměry a charakter — AI navrhne kolejový plán i seznam dílů
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
          <div style={{ marginBottom: "28px" }}>
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

          {/* AI Prompt */}
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>
              ✨ Popište svou představu (volitelné)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Např.: Chci horskou trať s jedním tunelem, malou stanicí a odstavnou kolejí. Preferuji větší poloměry oblouků. Vlak by měl jezdit v kruhu bez nutnosti vracení."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                minHeight: "70px",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Single generate button */}
          <button
            onClick={handleGenerate}
            disabled={aiGenerating}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "10px",
              border: "none",
              background: aiGenerating ? "var(--border-hover)" : "linear-gradient(135deg, #667eea, #764ba2)",
              color: aiGenerating ? "var(--text-dim)" : "#fff",
              fontSize: "17px",
              fontWeight: 700,
              cursor: aiGenerating ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.3px",
            }}
          >
            {aiGenerating ? "🤖 AI navrhuje kolejiště..." : "🤖 Navrhnout kolejiště"}
          </button>
        </div>

        {/* Results area */}
        <div ref={resultRef} style={{ marginTop: "32px" }}>
          {/* Loading state */}
          {aiGenerating && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
              <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 20px" }}>
                {/* Animated train track circle */}
                <svg width="80" height="80" viewBox="0 0 80 80" style={{ animation: "spin 3s linear infinite" }}>
                  <circle cx="40" cy="40" r="30" fill="none" stroke="var(--border)" strokeWidth="3" strokeDasharray="6,4" />
                  <circle cx="40" cy="10" r="5" fill="var(--accent)">
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "28px" }}>
                  🚂
                </div>
              </div>
              <p style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: 600 }}>AI navrhuje kolejiště...</p>
              <p style={{ fontSize: "13px", color: "var(--text-faint)", marginTop: "8px" }}>Generování geometrie tratě, obvykle 10-20 sekund</p>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error state */}
          {aiError && (
            <div style={{ ...cardStyle, borderColor: "var(--danger)" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--danger)", marginBottom: "12px" }}>
                ❌ Chyba
              </h2>
              <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>{aiError}</p>
              <p style={{ fontSize: "13px", color: "var(--text-faint)", marginTop: "8px" }}>
                Zkuste to znovu — AI občas neodpoví napoprvé.
              </p>
            </div>
          )}

          {/* Results */}
          {aiResult && (
            <>
              {/* 1. SVG Track Plan */}
              <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", textAlign: "left" }}>
                  📐 Kolejový plán
                </h2>
                <AITrackPlanSVG
                  tracks={aiResult.tracks ?? []}
                  labels={aiResult.labels}
                  board={aiResult.board ?? { width: form.width * 10, height: form.height * 10 }}
                  form={form}
                />
              </div>

              {/* 2. Warnings */}
              {aiResult.warnings && aiResult.warnings.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: "20px", borderColor: "rgba(255, 193, 7, 0.4)" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#ffc107", marginBottom: "12px" }}>
                    ⚠️ Upozornění
                  </h2>
                  {aiResult.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: "14px", color: "var(--text-secondary)", margin: i > 0 ? "8px 0 0" : "0", lineHeight: 1.6 }}>
                      • {w}
                    </p>
                  ))}
                </div>
              )}

              {/* 3. BOM Table */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                  🛒 Seznam dílů
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Typ", "Díl", "Označení", "Počet"].map((header, hi) => (
                          <th key={hi} style={{
                            textAlign: hi === 3 ? "center" : "left",
                            padding: "10px 12px",
                            borderBottom: "2px solid var(--border)",
                            color: "var(--accent)",
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aiResult.bom.map((item, i) => {
                        const typeIcons: Record<string, string> = {
                          straight: "➖", curve: "↪️", "turnout-left": "↙️", "turnout-right": "↗️", crossing: "✖️",
                        };
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                            <td style={{ padding: "10px 12px", fontSize: "14px" }}>
                              {typeIcons[item.type] || "🔧"}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "14px", color: "var(--text-body)" }}>
                              {item.nameCz}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-dim)" }}>
                              {item.name}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "16px", fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>
                              {item.count}×
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{
                  marginTop: "16px", paddingTop: "12px",
                  borderTop: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>Celkem dílů</span>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {aiResult.bom.reduce((sum, item) => sum + item.count, 0)}×
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
