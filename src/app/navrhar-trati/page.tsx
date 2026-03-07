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

interface PlacedPiece {
  piece: TrackPiece;
  x: number;
  y: number;
  rotation: number;
}

interface LayoutResult {
  pieces: PlacedPiece[];
  bom: { piece: TrackPiece; count: number }[];
  description: string;
  warnings: string[];
  dimensions: { width: number; height: number };
}

interface FormData {
  boardShape: BoardShape;
  width: number;       // cm — main width
  height: number;      // cm — main depth
  width2: number;      // cm — L-shape side arm width
  height2: number;     // cm — L-shape side arm depth
  lCorner: LCorner;    // L-shape corner position
  uArmDepth: number;   // cm — U-shape arm depth (both sides)
  scale: Scale;
  trackSystem: TrackSystem;
  character: LayoutCharacter;
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
   LAYOUT GENERATOR
   =========================== */
function generateLayout(form: FormData): LayoutResult {
  const catalog = TRACK_CATALOGS[form.trackSystem];
  const pieces: PlacedPiece[] = [];
  const bomMap = new Map<string, { piece: TrackPiece; count: number }>();
  const warnings: string[] = [];

  // Board dimensions in mm
  const boardW = form.width * 10;
  const boardH = form.height * 10;

  // Area factor — scale piece counts to board area relative to a 200×100cm reference
  const refArea = 2000 * 1000; // 200cm × 100cm in mm²
  let effectiveArea: number;
  if (form.boardShape === "l-shape") {
    const mainArea = boardW * boardH;
    const sideArea = form.width2 * 10 * form.height2 * 10;
    effectiveArea = mainArea + sideArea;
  } else if (form.boardShape === "u-shape") {
    const mainArea = boardW * boardH;
    const armsArea = 2 * form.uArmDepth * 10 * boardH;
    effectiveArea = mainArea + armsArea;
  } else {
    effectiveArea = boardW * boardH;
  }
  const areaFactor = Math.max(0.5, Math.min(3, effectiveArea / refArea));

  // Find track pieces by type
  const straights = catalog.pieces.filter((p) => p.type === "straight");
  const curves = catalog.pieces.filter((p) => p.type === "curve");
  const turnoutL = catalog.pieces.find((p) => p.type === "turnout-left");
  const turnoutR = catalog.pieces.find((p) => p.type === "turnout-right");

  const mainStraight = straights[0];
  const shortStraight = straights.length > 1 ? straights[1] : straights[0];
  const tightCurve = curves[0]; // smallest radius
  const wideCurve = curves.length > 1 ? curves[curves.length - 1] : curves[0]; // widest radius
  const mediumCurve = curves.length > 2 ? curves[1] : curves[0];

  if (!mainStraight || !tightCurve) {
    return {
      pieces,
      bom: [],
      description: "Nelze vygenerovat — chybí díly v katalogu.",
      warnings: ["Katalog nemá potřebné díly."],
      dimensions: { width: 0, height: 0 },
    };
  }

  const addToBom = (piece: TrackPiece, count: number = 1) => {
    const c = Math.max(1, Math.round(count));
    const existing = bomMap.get(piece.id);
    if (existing) existing.count += c;
    else bomMap.set(piece.id, { piece, count: c });
  };

  const scaledCount = (base: number) => Math.max(1, Math.round(base * areaFactor));

  let description = "";
  const scaleInfo = `Měřítko ${form.scale} (1:${SCALE_FACTOR[form.scale]}), systém ${catalog.name}.`;

  switch (form.character) {
    case "horska-trat": {
      // Mountain line: single-track, tight curves, tunnels, passing loops
      const curvesFor180 = Math.ceil(180 / (tightCurve.angle ?? 30));
      addToBom(mainStraight, scaledCount(6));
      if (shortStraight.id !== mainStraight.id) addToBom(shortStraight, scaledCount(4));
      addToBom(tightCurve, scaledCount(curvesFor180 * 2 + 4));
      if (turnoutL) addToBom(turnoutL, Math.max(1, Math.round(areaFactor)));
      if (turnoutR) addToBom(turnoutR, Math.max(1, Math.round(areaFactor)));

      description = `${scaleInfo} Horská jednokolejná trať s těsnými oblouky (R=${tightCurve.radius}mm), výhybnou pro míjení a tunely. Trať stoupá a klesá — výškové rozdíly je třeba řešit ručně podložkami (doporučeno 3–4 % stoupání).`;
      warnings.push("Výškové rozdíly (stoupání/klesání) je nutné vyřešit ručně pomocí podložek nebo stoupacích modulů.");
      if (boardW < 1200 || boardH < 600) {
        warnings.push("Pro horskou trať doporučujeme alespoň 120 × 60 cm.");
      }
      break;
    }

    case "hlavni-koridor": {
      // Main corridor: double track, wide curves, long straights, station
      const curvesFor180 = Math.ceil(180 / (wideCurve.angle ?? 30));
      // Double track = 2× everything for main line
      addToBom(mainStraight, scaledCount(12)); // double the straights
      addToBom(wideCurve, scaledCount(curvesFor180 * 2 * 2)); // double curves for both loops
      if (mediumCurve.id !== wideCurve.id) addToBom(mediumCurve, scaledCount(curvesFor180 * 2)); // parallel inner track
      // Station with through tracks
      if (turnoutL) addToBom(turnoutL, Math.max(2, scaledCount(2)));
      if (turnoutR) addToBom(turnoutR, Math.max(2, scaledCount(2)));
      addToBom(mainStraight, scaledCount(6)); // station straights

      description = `${scaleInfo} Dvoukolejný hlavní koridor s plynulými oblouky (R=${wideCurve.radius}mm), dlouhými rovnými úseky a průjezdnou stanicí. Vhodné pro rychlíky a IC vlaky.`;
      if (boardW < 1800) {
        warnings.push("Dvoukolejná trať s velkými poloměry vyžaduje ideálně alespoň 180 cm šířky.");
      }
      break;
    }

    case "stanice-vlecky": {
      // Station + sidings: many turnouts, complex track
      addToBom(mainStraight, scaledCount(10));
      if (shortStraight.id !== mainStraight.id) addToBom(shortStraight, scaledCount(8));
      const curvesFor90 = Math.ceil(90 / (mediumCurve.angle ?? 30));
      addToBom(mediumCurve, scaledCount(curvesFor90 * 4));
      // Lots of turnouts for station and sidings
      const turnoutCount = Math.max(3, scaledCount(4));
      if (turnoutL) addToBom(turnoutL, turnoutCount);
      if (turnoutR) addToBom(turnoutR, turnoutCount);

      description = `${scaleInfo} Centrální stanice s ${turnoutCount * 2}× výhybkami, průjezdními kolejemi, vlečkami k průmyslovým objektům a odstavnou skupinou. Ideální pro posunovací operace.`;
      if (boardW < 1500) {
        warnings.push("Složitá stanice s vlečkami vyžaduje ideálně alespoň 150 cm šířky pro pohodlné uspořádání.");
      }
      break;
    }

    case "mala-diorama": {
      // Small diorama: minimal, compact, simple oval or point-to-point
      const curvesFor180 = Math.ceil(180 / (tightCurve.angle ?? 30));
      addToBom(mainStraight, scaledCount(4));
      addToBom(tightCurve, scaledCount(curvesFor180 * 2));
      if (areaFactor > 0.8 && turnoutL) {
        addToBom(turnoutL, 1);
        if (turnoutR) addToBom(turnoutR, 1);
        addToBom(mainStraight, 2);
        description = `${scaleInfo} Kompaktní dioráma — jednoduchý ovál s jednou zastávkou a krátkou odstavnou kolejí. Optimalizováno pro malý prostor.`;
      } else {
        description = `${scaleInfo} Minimalistická dioráma — jednoduchý ovál bez výhybek. Ideální pro začátečníky nebo výstavní účely.`;
      }
      break;
    }

    case "prujezdna-stanice": {
      // Oval with passing station: 2+ station tracks + through track
      const curvesFor180 = Math.ceil(180 / (mediumCurve.angle ?? 30));
      addToBom(mainStraight, scaledCount(8));
      addToBom(mediumCurve, scaledCount(curvesFor180 * 2));
      // Station throat: 2 turnouts each side = 4 total
      if (turnoutL) addToBom(turnoutL, 2);
      if (turnoutR) addToBom(turnoutR, 2);
      // Station track straights
      addToBom(mainStraight, scaledCount(4));
      if (shortStraight.id !== mainStraight.id) addToBom(shortStraight, scaledCount(2));

      description = `${scaleInfo} Ovál s průjezdnou stanicí — hlavní trať (průjezdní kolej) + 2 staniční koleje s výhybkami v obou zhlavích. Umožňuje míjení a předjíždění vlaků.`;
      break;
    }

    case "prumyslova-vlecka": {
      // Industrial spur: point-to-point, many turnouts for spurs
      addToBom(mainStraight, scaledCount(8));
      if (shortStraight.id !== mainStraight.id) addToBom(shortStraight, scaledCount(6));
      const curvesFor90 = Math.ceil(90 / (mediumCurve.angle ?? 30));
      addToBom(mediumCurve, scaledCount(curvesFor90 * 2));
      // Industrial turnouts
      const turnoutCount = Math.max(2, scaledCount(3));
      if (turnoutL) addToBom(turnoutL, turnoutCount);
      if (turnoutR) addToBom(turnoutR, turnoutCount);

      description = `${scaleInfo} Průmyslová vlečka — bod-bod trať s ${turnoutCount * 2}× výhybkami, nakládacími rampami, skladovými kolejemi. Zaměřeno na posunovací operace s motorovými lokomotivami.`;
      break;
    }
  }

  // Board shape notes
  if (form.boardShape === "l-shape") {
    description += ` Deska tvaru L (${form.width}×${form.height} cm + rameno ${form.width2}×${form.height2} cm).`;
  } else if (form.boardShape === "u-shape") {
    description += ` Deska tvaru U (${form.width}×${form.height} cm + 2× ramena hloubky ${form.uArmDepth} cm).`;
  }

  return {
    pieces,
    bom: Array.from(bomMap.values()).sort((a, b) => {
      const order: Record<string, number> = { straight: 0, curve: 1, "turnout-left": 2, "turnout-right": 3, crossing: 4 };
      return (order[a.piece.type] ?? 5) - (order[b.piece.type] ?? 5);
    }),
    description,
    warnings,
    dimensions: { width: boardW, height: boardH },
  };
}

/* ===========================
   SVG RENDERER
   =========================== */
function LayoutSVG({ result, form }: { result: LayoutResult; form: FormData }) {
  const boardW = form.width * 10;
  const boardH = form.height * 10;
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
    totalH = boardH;
  }

  const svgH = (totalH / totalW) * (svgW - padding * 2) + padding * 2;
  const scale = (svgW - padding * 2) / totalW;

  // Offsets for centering within the SVG
  const offX = padding;
  const offY = padding / 2;

  // Board polygon path
  let boardPath = "";
  if (form.boardShape === "rectangle") {
    boardPath = `M ${offX} ${offY} h ${boardW * scale} v ${boardH * scale} h ${-boardW * scale} Z`;
  } else if (form.boardShape === "l-shape") {
    const w1 = boardW * scale;
    const h1 = boardH * scale;
    const w2 = form.width2 * 10 * scale;
    const h2 = form.height2 * 10 * scale;
    // L-shape depends on corner
    if (form.lCorner === "top-right") {
      boardPath = `M ${offX} ${offY} h ${w1} v ${h1} h ${-(w1 - w2)} v ${h2} h ${-w2} Z`;
    } else if (form.lCorner === "top-left") {
      boardPath = `M ${offX + w2} ${offY} h ${w1 - w2} v ${h1 + h2} h ${-w1} v ${-h1} h ${w2 - 0} Z`;
      // Simpler: draw from top-left
      boardPath = `M ${offX} ${offY} h ${w1} v ${h1 + h2} h ${-w2} v ${-h2} h ${-(w1 - w2)} Z`;
    } else if (form.lCorner === "bottom-right") {
      boardPath = `M ${offX} ${offY} h ${w1} v ${h1 + h2} h ${-w2} v ${-h2} h ${-(w1 - w2)} Z`;
    } else {
      // bottom-left
      boardPath = `M ${offX} ${offY} h ${w1} v ${h1} h ${-(w1 - w2)} v ${h2} h ${-w2} Z`;
    }
  } else if (form.boardShape === "u-shape") {
    const armW = form.uArmDepth * 10 * scale;
    const w = boardW * scale;
    const h = boardH * scale;
    // U opens upward: main bar at bottom, two arms going up
    boardPath = `M ${offX} ${offY} h ${armW} v ${h * 0.4} h ${w - 0} v ${-h * 0.4} h ${armW} v ${h} h ${-(w + 2 * armW)} Z`;
  }

  // Grid generation based on board area
  const gridLinesV = Math.floor(totalW / 100) + 1;
  const gridLinesH = Math.floor(totalH / 100) + 1;

  // Track schematic rendering helper
  const renderTrackSchematic = () => {
    const cx = offX + (boardW / 2) * scale;
    const cy = offY + (boardH / 2) * scale;
    const bw = boardW * scale;
    const bh = boardH * scale;

    // For non-rectangle shapes, adjust cx/cy to account for the full board
    const fullCx = form.boardShape === "u-shape" ? offX + (totalW / 2) * scale : cx;

    switch (form.character) {
      case "mala-diorama": {
        // Simple oval
        const rx = Math.min(bw * 0.35, bh * 0.8);
        const ry = Math.min(bh * 0.3, bw * 0.3);
        return (
          <g>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--accent)" strokeWidth="3.5" />
            {/* Small halt */}
            <rect
              x={cx - rx * 0.4} y={cy - ry - 12} width={rx * 0.8} height={10}
              fill="var(--accent)" opacity="0.15" stroke="var(--accent)" strokeWidth="0.5" rx="2"
            />
            <text x={cx} y={cy - ry - 16} fill="var(--accent)" fontSize="9" textAnchor="middle" fontWeight="600">
              Zastávka
            </text>
            {/* Direction arrow */}
            <polygon
              points={`${cx + rx * 0.5 - 5},${cy - ry - 1} ${cx + rx * 0.5 + 5},${cy - ry - 1} ${cx + rx * 0.5},${cy - ry - 8}`}
              fill="var(--accent)"
            />
          </g>
        );
      }

      case "horska-trat": {
        // Single-track mainline with tight curves, tunnel, passing loop
        const rx = Math.min(bw * 0.38, bh * 0.9);
        const ry = Math.min(bh * 0.32, bw * 0.35);
        return (
          <g>
            {/* Main oval track */}
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--accent)" strokeWidth="3" />
            {/* Tunnel section (dashed) on top left */}
            <path
              d={`M ${cx - rx * 0.7} ${cy - ry * 0.7} A ${rx} ${ry} 0 0 1 ${cx - rx * 0.2} ${cy - ry}`}
              fill="none" stroke="var(--accent)" strokeWidth="4" strokeDasharray="8,6" opacity="0.7"
            />
            {/* Tunnel portal markers */}
            <rect x={cx - rx * 0.72 - 4} y={cy - ry * 0.72 - 4} width="8" height="8" rx="2" fill="var(--text-dim)" opacity="0.6" />
            <text x={cx - rx * 0.72} y={cy - ry * 0.72 - 8} fill="var(--text-dim)" fontSize="8" textAnchor="middle">🚇</text>
            {/* Passing loop */}
            <path
              d={`M ${cx + rx * 0.1} ${cy + ry} Q ${cx + rx * 0.3} ${cy + ry + 18} ${cx + rx * 0.6} ${cy + ry}`}
              fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.6"
            />
            <text x={cx + rx * 0.35} y={cy + ry + 28} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              Výhybna
            </text>
            {/* Elevation indicator */}
            <text x={cx + rx + 8} y={cy - ry * 0.3} fill="var(--text-dim)" fontSize="9" textAnchor="start" opacity="0.7">
              ↗ 3%
            </text>
            <text x={cx - rx - 8} y={cy + ry * 0.3} fill="var(--text-dim)" fontSize="9" textAnchor="end" opacity="0.7">
              ↘ 3%
            </text>
          </g>
        );
      }

      case "hlavni-koridor": {
        // Double-track mainline with station
        const rx = Math.min(bw * 0.38, bh * 0.9);
        const ry = Math.min(bh * 0.28, bw * 0.3);
        const trackGap = 8;
        return (
          <g>
            {/* Outer track */}
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--accent)" strokeWidth="3" />
            {/* Inner track (parallel) */}
            <ellipse cx={cx} cy={cy} rx={rx - trackGap} ry={ry - trackGap} fill="none" stroke="var(--accent)" strokeWidth="2.5" opacity="0.6" />
            {/* Station area */}
            <rect
              x={cx - rx * 0.45} y={cy - ry - 28} width={rx * 0.9} height={24}
              fill="var(--accent)" opacity="0.08" stroke="var(--accent)" strokeWidth="0.5" rx="3"
              strokeDasharray="4,2"
            />
            {/* Station tracks (extra parallel lines in station area) */}
            <line
              x1={cx - rx * 0.35} y1={cy - ry - 10} x2={cx + rx * 0.35} y2={cy - ry - 10}
              stroke="var(--accent)" strokeWidth="2" opacity="0.4"
            />
            <line
              x1={cx - rx * 0.3} y1={cy - ry - 18} x2={cx + rx * 0.3} y2={cy - ry - 18}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.3"
            />
            <text x={cx} y={cy - ry - 32} fill="var(--accent)" fontSize="10" textAnchor="middle" fontWeight="600">
              🏛️ Stanice
            </text>
            {/* Direction arrows on both tracks */}
            <polygon
              points={`${cx + rx * 0.4 - 4},${cy - ry} ${cx + rx * 0.4 + 4},${cy - ry} ${cx + rx * 0.4},${cy - ry - 7}`}
              fill="var(--accent)"
            />
            <polygon
              points={`${cx - rx * 0.4 - 4},${cy + ry} ${cx - rx * 0.4 + 4},${cy + ry} ${cx - rx * 0.4},${cy + ry + 7}`}
              fill="var(--accent)" opacity="0.6"
            />
          </g>
        );
      }

      case "stanice-vlecky": {
        // Complex station with sidings and freight yard
        const trackY = cy;
        const leftX = offX + bw * 0.08;
        const rightX = offX + bw * 0.92;
        const stationLeft = offX + bw * 0.25;
        const stationRight = offX + bw * 0.75;
        return (
          <g>
            {/* Main through line */}
            <line x1={leftX} y1={trackY} x2={rightX} y2={trackY} stroke="var(--accent)" strokeWidth="3.5" />
            {/* Station area background */}
            <rect
              x={stationLeft} y={trackY - 45} width={stationRight - stationLeft} height={90}
              fill="var(--accent)" opacity="0.06" stroke="var(--accent)" strokeWidth="0.5" rx="4"
              strokeDasharray="4,2"
            />
            {/* Station tracks (parallel) */}
            <line x1={stationLeft + 15} y1={trackY - 14} x2={stationRight - 15} y2={trackY - 14}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={stationLeft + 25} y1={trackY - 28} x2={stationRight - 25} y2={trackY - 28}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            {/* Turnout lines (throat) */}
            <line x1={stationLeft} y1={trackY} x2={stationLeft + 15} y2={trackY - 14}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={stationRight} y1={trackY} x2={stationRight - 15} y2={trackY - 14}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={stationLeft + 10} y1={trackY - 14} x2={stationLeft + 25} y2={trackY - 28}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            <line x1={stationRight - 10} y1={trackY - 14} x2={stationRight - 25} y2={trackY - 28}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            {/* Industrial sidings (below main line) */}
            <line x1={stationRight - 30} y1={trackY} x2={rightX - 10} y2={trackY + 20}
              stroke="var(--accent)" strokeWidth="2" opacity="0.4" />
            <line x1={rightX - 10} y1={trackY + 20} x2={rightX - 5} y2={trackY + 20}
              stroke="var(--accent)" strokeWidth="2" opacity="0.4" />
            <line x1={rightX - 30} y1={trackY + 20} x2={rightX - 10} y2={trackY + 35}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
            <line x1={rightX - 10} y1={trackY + 35} x2={rightX - 5} y2={trackY + 35}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
            {/* Labels */}
            <text x={(stationLeft + stationRight) / 2} y={trackY - 50} fill="var(--accent)" fontSize="10" textAnchor="middle" fontWeight="600">
              🏛️ Stanice
            </text>
            <text x={rightX - 15} y={trackY + 50} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              🏭 Vlečky
            </text>
            {/* Freight yard */}
            <line x1={stationLeft - 10} y1={trackY} x2={leftX + 15} y2={trackY + 22}
              stroke="var(--accent)" strokeWidth="2" opacity="0.4" />
            <line x1={leftX + 15} y1={trackY + 22} x2={leftX + 60} y2={trackY + 22}
              stroke="var(--accent)" strokeWidth="2" opacity="0.4" />
            <line x1={leftX + 25} y1={trackY + 22} x2={leftX + 15} y2={trackY + 36}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
            <line x1={leftX + 15} y1={trackY + 36} x2={leftX + 55} y2={trackY + 36}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
            <text x={leftX + 35} y={trackY + 50} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              Nákladní dvůr
            </text>
          </g>
        );
      }

      case "prujezdna-stanice": {
        // Oval with proper passing station
        const rx = Math.min(bw * 0.38, bh * 0.9);
        const ry = Math.min(bh * 0.3, bw * 0.3);
        return (
          <g>
            {/* Main oval */}
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--accent)" strokeWidth="3.5" />
            {/* Station area */}
            <rect
              x={cx - rx * 0.5} y={cy - ry - 35} width={rx * 1.0} height={32}
              fill="var(--accent)" opacity="0.08" stroke="var(--accent)" strokeWidth="0.5" rx="3"
              strokeDasharray="4,2"
            />
            {/* Through track (part of oval top) is already there */}
            {/* Station track 1 */}
            <line
              x1={cx - rx * 0.4} y1={cy - ry - 10} x2={cx + rx * 0.4} y2={cy - ry - 10}
              stroke="var(--accent)" strokeWidth="2.5" opacity="0.5"
            />
            {/* Station track 2 */}
            <line
              x1={cx - rx * 0.35} y1={cy - ry - 22} x2={cx + rx * 0.35} y2={cy - ry - 22}
              stroke="var(--accent)" strokeWidth="2" opacity="0.35"
            />
            {/* Throat turnouts (left) */}
            <line x1={cx - rx * 0.45} y1={cy - ry} x2={cx - rx * 0.4} y2={cy - ry - 10}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={cx - rx * 0.42} y1={cy - ry - 6} x2={cx - rx * 0.35} y2={cy - ry - 22}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            {/* Throat turnouts (right) */}
            <line x1={cx + rx * 0.45} y1={cy - ry} x2={cx + rx * 0.4} y2={cy - ry - 10}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={cx + rx * 0.42} y1={cy - ry - 6} x2={cx + rx * 0.35} y2={cy - ry - 22}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            {/* Labels */}
            <text x={cx} y={cy - ry - 40} fill="var(--accent)" fontSize="10" textAnchor="middle" fontWeight="600">
              🔄 Průjezdná stanice
            </text>
            {/* Direction arrow */}
            <polygon
              points={`${cx + rx * 0.5 - 5},${cy - ry - 1} ${cx + rx * 0.5 + 5},${cy - ry - 1} ${cx + rx * 0.5},${cy - ry - 8}`}
              fill="var(--accent)"
            />
          </g>
        );
      }

      case "prumyslova-vlecka": {
        // Point-to-point with industrial spurs
        const leftX = offX + bw * 0.06;
        const rightX = offX + bw * 0.94;
        const trackY = cy - 10;
        return (
          <g>
            {/* Main line */}
            <line x1={leftX} y1={trackY} x2={rightX} y2={trackY} stroke="var(--accent)" strokeWidth="3.5" />
            {/* Terminal buffer left */}
            <line x1={leftX - 3} y1={trackY - 6} x2={leftX - 3} y2={trackY + 6} stroke="var(--accent)" strokeWidth="3" />
            {/* Terminal buffer right */}
            <line x1={rightX + 3} y1={trackY - 6} x2={rightX + 3} y2={trackY + 6} stroke="var(--accent)" strokeWidth="3" />
            {/* Industrial spur 1 — loading ramp */}
            <line x1={leftX + bw * 0.25} y1={trackY} x2={leftX + bw * 0.35} y2={trackY + 30}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={leftX + bw * 0.35} y1={trackY + 30} x2={leftX + bw * 0.5} y2={trackY + 30}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <rect x={leftX + bw * 0.38} y={trackY + 24} width={bw * 0.1} height={12}
              fill="var(--accent)" opacity="0.1" stroke="var(--accent)" strokeWidth="0.5" rx="2" />
            <text x={leftX + bw * 0.43} y={trackY + 55} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              Nakládací rampa
            </text>
            {/* Industrial spur 2 — warehouse */}
            <line x1={leftX + bw * 0.55} y1={trackY} x2={leftX + bw * 0.65} y2={trackY + 25}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            <line x1={leftX + bw * 0.65} y1={trackY + 25} x2={leftX + bw * 0.8} y2={trackY + 25}
              stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
            {/* Second spur track */}
            <line x1={leftX + bw * 0.7} y1={trackY + 25} x2={leftX + bw * 0.75} y2={trackY + 40}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            <line x1={leftX + bw * 0.75} y1={trackY + 40} x2={leftX + bw * 0.88} y2={trackY + 40}
              stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
            <rect x={leftX + bw * 0.66} y={trackY + 19} width={bw * 0.12} height={12}
              fill="var(--accent)" opacity="0.1" stroke="var(--accent)" strokeWidth="0.5" rx="2" />
            <text x={leftX + bw * 0.72} y={trackY + 55} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              🏭 Sklad
            </text>
            {/* Run-around track (for shunting) */}
            <path
              d={`M ${leftX + bw * 0.12} ${trackY} Q ${leftX + bw * 0.15} ${trackY - 25} ${leftX + bw * 0.22} ${trackY - 25} L ${leftX + bw * 0.42} ${trackY - 25} Q ${leftX + bw * 0.48} ${trackY - 25} ${leftX + bw * 0.5} ${trackY}`}
              fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.45"
            />
            <text x={leftX + bw * 0.3} y={trackY - 30} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              Objízdná kolej
            </text>
            {/* Labels */}
            <text x={leftX} y={trackY - 14} fill="var(--text-dim)" fontSize="9" textAnchor="start">Výchozí bod</text>
            <text x={rightX} y={trackY - 14} fill="var(--text-dim)" fontSize="9" textAnchor="end">Koncový bod</text>
          </g>
        );
      }

      default:
        return null;
    }
  };

  // For non-rect shapes, draw track adapted to shape
  const renderShapeAdaptedTrack = () => {
    if (form.boardShape === "rectangle") return null;

    // For L and U shapes, render additional guiding track in the arms
    if (form.boardShape === "l-shape") {
      const w1 = boardW * scale;
      const h1 = boardH * scale;
      const w2 = form.width2 * 10 * scale;
      const h2 = form.height2 * 10 * scale;
      // Draw a continuation track into the L arm
      const armTrackY = offY + h1 + h2 * 0.5;
      let armTrackX1: number, armTrackX2: number;
      if (form.lCorner === "bottom-left" || form.lCorner === "top-left") {
        armTrackX1 = offX;
        armTrackX2 = offX + w2;
      } else {
        armTrackX1 = offX + w1 - w2;
        armTrackX2 = offX + w1;
      }
      return (
        <g>
          <line x1={armTrackX1 + 10} y1={armTrackY} x2={armTrackX2 - 10} y2={armTrackY}
            stroke="var(--accent)" strokeWidth="2.5" opacity="0.4" strokeDasharray="6,4" />
          <text x={(armTrackX1 + armTrackX2) / 2} y={armTrackY - 8} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
            Prodloužení tratě
          </text>
        </g>
      );
    }

    if (form.boardShape === "u-shape") {
      const armW = form.uArmDepth * 10 * scale;
      const h = boardH * scale;
      // Left arm track
      // Right arm track
      return (
        <g>
          {/* Left arm */}
          <line x1={offX + armW * 0.5} y1={offY + 15} x2={offX + armW * 0.5} y2={offY + h * 0.4 - 5}
            stroke="var(--accent)" strokeWidth="2.5" opacity="0.4" strokeDasharray="6,4" />
          <text x={offX + armW * 0.5} y={offY + 10} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
            Rameno L
          </text>
          {/* Right arm */}
          <line x1={offX + (boardW * scale) + armW + armW * 0.5} y1={offY + 15}
            x2={offX + (boardW * scale) + armW + armW * 0.5} y2={offY + h * 0.4 - 5}
            stroke="var(--accent)" strokeWidth="2.5" opacity="0.4" strokeDasharray="6,4" />
          <text x={offX + (boardW * scale) + armW + armW * 0.5} y={offY + 10}
            fill="var(--text-dim)" fontSize="8" textAnchor="middle">
            Rameno R
          </text>
        </g>
      );
    }

    return null;
  };

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH + 10}`}
      style={{ width: "100%", maxWidth: "800px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border)" }}
    >
      {/* Board shape */}
      <path
        d={boardPath}
        fill="var(--bg-input)"
        stroke="var(--border-hover)"
        strokeWidth="2"
      />

      {/* Grid lines */}
      {Array.from({ length: gridLinesV }, (_, i) => (
        <line
          key={`gv${i}`}
          x1={offX + i * 100 * scale}
          y1={offY}
          x2={offX + i * 100 * scale}
          y2={offY + totalH * scale}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="4,4"
          opacity="0.5"
        />
      ))}
      {Array.from({ length: gridLinesH }, (_, i) => (
        <line
          key={`gh${i}`}
          x1={offX}
          y1={offY + i * 100 * scale}
          x2={offX + totalW * scale}
          y2={offY + i * 100 * scale}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="4,4"
          opacity="0.5"
        />
      ))}

      {/* Dimension labels */}
      <text x={offX + boardW * scale / 2} y={offY - 10} fill="var(--text-dim)" fontSize="12" textAnchor="middle">
        {form.width} cm
      </text>
      <text x={offX - 10} y={offY + boardH * scale / 2} fill="var(--text-dim)" fontSize="12" textAnchor="middle"
        transform={`rotate(-90, ${offX - 10}, ${offY + boardH * scale / 2})`}>
        {form.height} cm
      </text>

      {/* Track schematic */}
      {renderTrackSchematic()}

      {/* Shape-adapted track extensions */}
      {renderShapeAdaptedTrack()}

      {/* Scale indicator */}
      <text x={offX + totalW * scale - 5} y={svgH - 5} fill="var(--text-faint)" fontSize="10" textAnchor="end">
        {form.scale} 1:{SCALE_FACTOR[form.scale]} · {TRACK_CATALOGS[form.trackSystem].name}
      </text>
    </svg>
  );
}

/* ===========================
   AI SVG RENDERER
   =========================== */
function AILayoutSVG({ aiResult, form }: { aiResult: { trackPlan?: { segments: { type: string; description: string; position?: string }[] }; features?: string[] }; form: FormData }) {
  const boardW = form.width * 10;
  const boardH = form.height * 10;
  const padding = 60;
  const svgW = 800;

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

  // Board polygon
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

  const segments = aiResult.trackPlan?.segments ?? [];

  // Position mapping to coordinates
  const posToCoord = (pos: string | undefined): { x: number; y: number } => {
    const cx = offX + (boardW / 2) * sc;
    const cy = offY + (boardH / 2) * sc;
    const bw = boardW * sc;
    const bh = boardH * sc;
    switch (pos) {
      case "top": return { x: cx, y: offY + bh * 0.12 };
      case "top-center": return { x: cx, y: offY + bh * 0.12 };
      case "top-left": return { x: offX + bw * 0.2, y: offY + bh * 0.15 };
      case "top-right": return { x: offX + bw * 0.8, y: offY + bh * 0.15 };
      case "bottom": return { x: cx, y: offY + bh * 0.88 };
      case "bottom-center": return { x: cx, y: offY + bh * 0.88 };
      case "bottom-left": return { x: offX + bw * 0.2, y: offY + bh * 0.85 };
      case "bottom-right": return { x: offX + bw * 0.8, y: offY + bh * 0.85 };
      case "left": return { x: offX + bw * 0.1, y: cy };
      case "right": return { x: offX + bw * 0.9, y: cy };
      case "center": return { x: cx, y: cy };
      default: return { x: cx, y: cy };
    }
  };

  // Draw mainline as oval
  const cx = offX + (boardW / 2) * sc;
  const cy = offY + (boardH / 2) * sc;
  const rx = boardW * sc * 0.42;
  const ry = boardH * sc * 0.35;

  const segIcons: Record<string, string> = {
    mainline: "🛤️", station: "🏛️", siding: "🔀", tunnel: "🚇",
    bridge: "🌉", depot: "🏗️", "freight-yard": "📦",
    "passing-loop": "🔄", "industrial-spur": "🏭", turntable: "🔁",
  };

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH + 10}`}
      style={{ width: "100%", maxWidth: "800px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border)" }}
    >
      {/* Board shape */}
      <path d={boardPath} fill="var(--bg-input)" stroke="var(--border-hover)" strokeWidth="2" />

      {/* Grid */}
      {Array.from({ length: Math.floor(totalW / 100) + 1 }, (_, i) => (
        <line key={`gv${i}`} x1={offX + i * 100 * sc} y1={offY} x2={offX + i * 100 * sc} y2={offY + totalH * sc}
          stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
      ))}
      {Array.from({ length: Math.floor(totalH / 100) + 1 }, (_, i) => (
        <line key={`gh${i}`} x1={offX} y1={offY + i * 100 * sc} x2={offX + totalW * sc} y2={offY + i * 100 * sc}
          stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
      ))}

      {/* Dimension labels */}
      <text x={offX + boardW * sc / 2} y={offY - 10} fill="var(--text-dim)" fontSize="12" textAnchor="middle">{form.width} cm</text>
      <text x={offX - 10} y={offY + boardH * sc / 2} fill="var(--text-dim)" fontSize="12" textAnchor="middle"
        transform={`rotate(-90, ${offX - 10}, ${offY + boardH * sc / 2})`}>{form.height} cm</text>

      {/* Main track oval */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--accent)" strokeWidth="3.5" />

      {/* Segments from AI */}
      {segments.map((seg, i) => {
        if (seg.type === "mainline") return null; // already drawn as oval
        const pos = posToCoord(seg.position);

        if (seg.type === "tunnel") {
          // Dashed arc section
          const angle = seg.position?.includes("left") ? Math.PI : seg.position?.includes("right") ? 0 : seg.position?.includes("top") ? -Math.PI / 2 : Math.PI / 2;
          const tx = cx + Math.cos(angle) * rx * 0.9;
          const ty = cy + Math.sin(angle) * ry * 0.9;
          return (
            <g key={i}>
              <rect x={tx - 25} y={ty - 8} width={50} height={16} rx="8" fill="var(--bg-page)" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4,3" opacity="0.7" />
              <text x={tx} y={ty + 4} fill="var(--text-dim)" fontSize="9" textAnchor="middle">🚇</text>
            </g>
          );
        }

        if (seg.type === "station" || seg.type === "passing-loop") {
          // Station rectangle with multiple tracks
          const sw = Math.min(rx * 0.8, 120);
          return (
            <g key={i}>
              <rect x={pos.x - sw / 2} y={pos.y - 18} width={sw} height={28} rx="4"
                fill="var(--accent)" opacity="0.1" stroke="var(--accent)" strokeWidth="1" />
              {/* Station tracks */}
              <line x1={pos.x - sw / 2 + 8} y1={pos.y - 5} x2={pos.x + sw / 2 - 8} y2={pos.y - 5}
                stroke="var(--accent)" strokeWidth="2" opacity="0.6" />
              <line x1={pos.x - sw / 2 + 15} y1={pos.y + 5} x2={pos.x + sw / 2 - 15} y2={pos.y + 5}
                stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
              <text x={pos.x} y={pos.y + 25} fill="var(--accent)" fontSize="10" textAnchor="middle" fontWeight="600">
                {segIcons[seg.type] || "📍"} {seg.type === "station" ? "Stanice" : "Výhybna"}
              </text>
            </g>
          );
        }

        if (seg.type === "siding" || seg.type === "industrial-spur") {
          // Spur track branching off
          const dir = (seg.position?.includes("right")) ? 1 : -1;
          const sy = (seg.position?.includes("top")) ? -1 : 1;
          return (
            <g key={i}>
              <line x1={pos.x} y1={pos.y} x2={pos.x + dir * 40} y2={pos.y + sy * 25}
                stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
              <line x1={pos.x + dir * 40} y1={pos.y + sy * 25} x2={pos.x + dir * 80} y2={pos.y + sy * 25}
                stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
              <line x1={pos.x + dir * 80 + dir * 3} y1={pos.y + sy * 25 - 5} x2={pos.x + dir * 80 + dir * 3} y2={pos.y + sy * 25 + 5}
                stroke="var(--accent)" strokeWidth="2.5" />
              <text x={pos.x + dir * 50} y={pos.y + sy * 42} fill="var(--text-dim)" fontSize="9" textAnchor="middle">
                {segIcons[seg.type] || "📍"} {seg.type === "siding" ? "Odstavná" : "Vlečka"}
              </text>
            </g>
          );
        }

        if (seg.type === "bridge") {
          return (
            <g key={i}>
              <rect x={pos.x - 20} y={pos.y - 6} width={40} height={12} rx="2"
                fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3,2" />
              <line x1={pos.x - 20} y1={pos.y + 6} x2={pos.x - 15} y2={pos.y + 14} stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
              <line x1={pos.x + 20} y1={pos.y + 6} x2={pos.x + 15} y2={pos.y + 14} stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
              <text x={pos.x} y={pos.y + 24} fill="var(--text-dim)" fontSize="9" textAnchor="middle">🌉 Most</text>
            </g>
          );
        }

        if (seg.type === "depot" || seg.type === "freight-yard") {
          const dw = 60;
          return (
            <g key={i}>
              <rect x={pos.x - dw / 2} y={pos.y - 12} width={dw} height={24} rx="3"
                fill="var(--accent)" opacity="0.08" stroke="var(--accent)" strokeWidth="0.8" />
              <line x1={pos.x - dw / 2 + 5} y1={pos.y - 3} x2={pos.x + dw / 2 - 5} y2={pos.y - 3}
                stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
              <line x1={pos.x - dw / 2 + 10} y1={pos.y + 5} x2={pos.x + dw / 2 - 10} y2={pos.y + 5}
                stroke="var(--accent)" strokeWidth="1" opacity="0.35" />
              <text x={pos.x} y={pos.y + 24} fill="var(--text-dim)" fontSize="9" textAnchor="middle">
                {segIcons[seg.type]} {seg.type === "depot" ? "Depo" : "Nákladiště"}
              </text>
            </g>
          );
        }

        if (seg.type === "turntable") {
          return (
            <g key={i}>
              <circle cx={pos.x} cy={pos.y} r={15} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6" />
              <line x1={pos.x - 12} y1={pos.y} x2={pos.x + 12} y2={pos.y} stroke="var(--accent)" strokeWidth="2" opacity="0.7" />
              <text x={pos.x} y={pos.y + 25} fill="var(--text-dim)" fontSize="9" textAnchor="middle">🔁 Točna</text>
            </g>
          );
        }

        // Generic fallback
        return (
          <g key={i}>
            <circle cx={pos.x} cy={pos.y} r={4} fill="var(--accent)" opacity="0.6" />
            <text x={pos.x} y={pos.y + 16} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
              {segIcons[seg.type] || "📍"}
            </text>
          </g>
        );
      })}

      {/* Scale indicator */}
      <text x={offX + totalW * sc - 5} y={svgH - 5} fill="var(--text-faint)" fontSize="10" textAnchor="end">
        {form.scale} 1:{form.scale === "H0" ? 87 : form.scale === "TT" ? 120 : 160} · AI návrh
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
interface AIResult {
  description: string;
  bom: { name: string; nameCz: string; type: string; count: number }[];
  features: string[];
  warnings: string[];
  trackPlan?: { segments: { type: string; description: string; position?: string }[] };
}

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
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "ai">("local");
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerateLocal = useCallback(() => {
    setGenerating(true);
    setMode("local");
    setAiResult(null);
    setAiError(null);
    setTimeout(() => {
      const layout = generateLayout(form);
      setResult(layout);
      setGenerating(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, 600);
  }, [form]);

  const handleGenerateAI = useCallback(async () => {
    setAiGenerating(true);
    setMode("ai");
    setResult(null);
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
          Zadejte rozměry a charakter — vygenerujeme kolejový plán i seznam dílů
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

          {/* Dimensions — changes based on board shape */}
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

            {/* L-shape extra fields */}
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

            {/* U-shape extra fields */}
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
              ✨ Popište svou představu (volitelné — pro AI návrh)
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

          {/* Generate buttons */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handleGenerateAI}
              disabled={aiGenerating || generating}
              style={{
                flex: "1 1 200px",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: aiGenerating ? "var(--border-hover)" : "linear-gradient(135deg, #667eea, #764ba2)",
                color: aiGenerating ? "var(--text-dim)" : "#fff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: aiGenerating ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {aiGenerating ? "🤖 AI přemýšlí..." : "🤖 AI návrh"}
            </button>
            <button
              onClick={handleGenerateLocal}
              disabled={generating || aiGenerating}
              style={{
                flex: "1 1 200px",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: generating ? "var(--border-hover)" : "var(--accent)",
                color: generating ? "var(--text-dim)" : "var(--accent-text-on)",
                fontSize: "16px",
                fontWeight: 700,
                cursor: generating ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {generating ? "⏳ Generuji..." : "⚡ Rychlý návrh"}
            </button>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "8px", textAlign: "center" }}>
            🤖 AI návrh — umělá inteligence navrhne plán podle vašeho popisu &nbsp;|&nbsp; ⚡ Rychlý návrh — okamžitý algoritmus
          </p>
        </div>

        {/* AI Result */}
        {mode === "ai" && (aiResult || aiError || aiGenerating) && (
          <div ref={resultRef} style={{ marginTop: "32px" }}>
            {aiGenerating && (
              <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px", animation: "pulse 1.5s ease-in-out infinite" }}>🤖</div>
                <p style={{ fontSize: "16px", color: "var(--text-muted)" }}>AI navrhuje kolejiště...</p>
                <p style={{ fontSize: "13px", color: "var(--text-faint)", marginTop: "8px" }}>Obvykle to trvá 5-15 sekund</p>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
              </div>
            )}

            {aiError && (
              <div style={{ ...cardStyle, borderColor: "var(--danger)" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--danger)", marginBottom: "12px" }}>
                  ❌ Chyba
                </h2>
                <p style={{ fontSize: "15px", color: "var(--text-secondary)" }}>{aiError}</p>
                <p style={{ fontSize: "13px", color: "var(--text-faint)", marginTop: "8px" }}>
                  Zkuste to znovu, nebo použijte ⚡ Rychlý návrh
                </p>
              </div>
            )}

            {aiResult && (
              <>
                {/* AI SVG Plan */}
                <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", textAlign: "left" }}>
                    📐 Kolejový plán
                  </h2>
                  <AILayoutSVG aiResult={aiResult} form={form} />
                </div>

                {/* AI Description */}
                <div style={{ ...cardStyle, marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    🤖 AI návrh kolejiště
                  </h2>
                  <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {aiResult.description}
                  </p>

                  {/* Features */}
                  {aiResult.features && aiResult.features.length > 0 && (
                    <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {aiResult.features.map((f, i) => (
                        <span key={i} style={{
                          padding: "4px 12px",
                          borderRadius: "20px",
                          background: "var(--accent-bg)",
                          border: "1px solid var(--accent-border)",
                          color: "var(--accent)",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Track plan description */}
                  {aiResult.trackPlan?.segments && aiResult.trackPlan.segments.length > 0 && (
                    <div style={{ marginTop: "20px" }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Rozložení tratě
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {aiResult.trackPlan.segments.map((seg, i) => {
                          const segIcons: Record<string, string> = {
                            mainline: "🛤️", station: "🏛️", siding: "🔀", tunnel: "🚇",
                            bridge: "🌉", depot: "🏗️", "freight-yard": "📦",
                            "passing-loop": "🔄", "industrial-spur": "🏭", turntable: "🔁",
                          };
                          return (
                            <div key={i} style={{
                              padding: "10px 14px",
                              background: "var(--bg-input)",
                              borderRadius: "8px",
                              border: "1px solid var(--border-light)",
                              display: "flex",
                              gap: "10px",
                              alignItems: "flex-start",
                            }}>
                              <span style={{ fontSize: "18px", flexShrink: 0 }}>{segIcons[seg.type] || "📍"}</span>
                              <div>
                                <span style={{ fontSize: "13px", color: "var(--text-body)" }}>{seg.description}</span>
                                {seg.position && (
                                  <span style={{ fontSize: "11px", color: "var(--text-faint)", marginLeft: "8px" }}>
                                    ({seg.position})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Warnings */}
                  {aiResult.warnings && aiResult.warnings.length > 0 && (
                    <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(255, 193, 7, 0.1)", border: "1px solid rgba(255, 193, 7, 0.3)", borderRadius: "8px" }}>
                      {aiResult.warnings.map((w, i) => (
                        <p key={i} style={{ fontSize: "13px", color: "#ffc107", margin: i > 0 ? "6px 0 0" : "0" }}>
                          ⚠️ {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI BOM */}
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                    🛒 Seznam dílů (AI)
                  </h2>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Typ
                          </th>
                          <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Díl
                          </th>
                          <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Označení
                          </th>
                          <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Počet
                          </th>
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
                  <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>Celkem dílů</span>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {aiResult.bom.reduce((sum, item) => sum + item.count, 0)}×
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Local Result */}
        {mode === "local" && result && (
          <div ref={resultRef} style={{ marginTop: "32px" }}>
            {/* SVG */}
            <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", textAlign: "left" }}>
                📐 Kolejový plán
              </h2>
              <LayoutSVG result={result} form={form} />
            </div>

            {/* Description */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                📝 Popis
              </h2>
              <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {result.description}
              </p>

              {result.warnings.length > 0 && (
                <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(255, 193, 7, 0.1)", border: "1px solid rgba(255, 193, 7, 0.3)", borderRadius: "8px" }}>
                  {result.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: "13px", color: "#ffc107", margin: i > 0 ? "6px 0 0" : "0" }}>
                      ⚠️ {w}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* BOM */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                🛒 Seznam dílů
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Typ
                      </th>
                      <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Díl
                      </th>
                      <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Označení
                      </th>
                      <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Počet
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bom.map((item, i) => {
                      const typeIcons: Record<string, string> = {
                        straight: "➖",
                        curve: "↪️",
                        "turnout-left": "↙️",
                        "turnout-right": "↗️",
                        crossing: "✖️",
                      };
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                          <td style={{ padding: "10px 12px", fontSize: "14px" }}>
                            {typeIcons[item.piece.type] || "🔧"}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "14px", color: "var(--text-body)" }}>
                            {item.piece.nameCz}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-dim)" }}>
                            {item.piece.name}
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

              {/* Total */}
              <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                  Celkem dílů
                </span>
                <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {result.bom.reduce((sum, item) => sum + item.count, 0)}×
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
