"use client";

import { useState, useCallback, useRef } from "react";

/* ===========================
   TYPES
   =========================== */
type Scale = "H0" | "TT" | "N";
type TrackSystem = "roco-line" | "roco-geo" | "tillig" | "piko-a" | "fleischmann";
type LayoutStyle = "oval" | "dogbone" | "lshaped" | "point-to-point" | "loop-with-station" | "figure-eight";

interface TrackPiece {
  id: string;
  name: string;
  nameCz: string;
  length?: number;     // mm (straight)
  radius?: number;     // mm (curve)
  angle?: number;      // degrees (curve)
  type: "straight" | "curve" | "turnout-left" | "turnout-right" | "crossing";
}

interface PlacedPiece {
  piece: TrackPiece;
  x: number;
  y: number;
  rotation: number; // degrees
}

interface LayoutResult {
  pieces: PlacedPiece[];
  bom: { piece: TrackPiece; count: number }[];
  description: string;
  warnings: string[];
  dimensions: { width: number; height: number }; // actual mm used
}

interface FormData {
  width: number;       // cm
  height: number;      // cm
  scale: Scale;
  trackSystem: TrackSystem;
  style: LayoutStyle;
  withStation: boolean;
  withSiding: boolean;
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

  // Find track pieces
  const straights = catalog.pieces.filter((p) => p.type === "straight");
  const curves = catalog.pieces.filter((p) => p.type === "curve");
  const turnoutL = catalog.pieces.find((p) => p.type === "turnout-left");
  const turnoutR = catalog.pieces.find((p) => p.type === "turnout-right");

  const mainStraight = straights[0]; // longest straight
  const mainCurve = curves[0]; // tightest curve
  const mediumCurve = curves.length > 1 ? curves[1] : curves[0]; // wider if available

  if (!mainStraight || !mainCurve) {
    return { pieces, bom: [], description: "Nelze vygenerovat — chybí díly v katalogu.", warnings: ["Katalog nemá potřebné díly."], dimensions: { width: 0, height: 0 } };
  }

  const addToBom = (piece: TrackPiece, count: number = 1) => {
    const existing = bomMap.get(piece.id);
    if (existing) existing.count += count;
    else bomMap.set(piece.id, { piece, count });
  };

  // Choose curve based on available space
  const useCurve = mediumCurve;
  const R = useCurve.radius!;
  const anglePer = useCurve.angle!;
  const curvesFor180 = Math.ceil(180 / anglePer);
  const curveSpanX = R * 2; // approximate width of 180° turn
  const curveSpanY = R * 2;

  // Calculate straight sections length
  const SL = mainStraight.length!;
  const availableForStraights = boardW - curveSpanX * 2 - 40; // 20mm margin each side
  const straightCount = Math.max(2, Math.floor(availableForStraights / SL));

  let description = "";
  let cx = boardW / 2;
  let cy = boardH / 2;

  if (form.style === "oval") {
    // Simple oval: straight-curve180-straight-curve180
    const topStraights = straightCount;
    const totalStraightLen = topStraights * SL;

    // Place top straights
    const startX = (boardW - totalStraightLen) / 2;
    const topY = boardH / 2 - R;
    const botY = boardH / 2 + R;

    // Top straights (left to right)
    for (let i = 0; i < topStraights; i++) {
      pieces.push({ piece: mainStraight, x: startX + i * SL, y: topY, rotation: 0 });
    }
    addToBom(mainStraight, topStraights);

    // Right curves (180° turn)
    const rightCenterX = startX + totalStraightLen;
    const rightCenterY = boardH / 2;
    for (let i = 0; i < curvesFor180; i++) {
      const a = -90 + i * anglePer;
      const rad = (a * Math.PI) / 180;
      pieces.push({
        piece: useCurve,
        x: rightCenterX + R * Math.cos(rad),
        y: rightCenterY + R * Math.sin(rad),
        rotation: a + 90,
      });
    }
    addToBom(useCurve, curvesFor180);

    // Bottom straights (right to left)
    for (let i = 0; i < topStraights; i++) {
      pieces.push({ piece: mainStraight, x: startX + (topStraights - 1 - i) * SL, y: botY, rotation: 180 });
    }
    addToBom(mainStraight, topStraights);

    // Left curves (180° turn)
    const leftCenterX = startX;
    for (let i = 0; i < curvesFor180; i++) {
      const a = 90 + i * anglePer;
      const rad = (a * Math.PI) / 180;
      pieces.push({
        piece: useCurve,
        x: leftCenterX + R * Math.cos(rad),
        y: rightCenterY + R * Math.sin(rad),
        rotation: a + 90,
      });
    }
    addToBom(useCurve, curvesFor180);

    description = `Jednoduchý ovál s ${topStraights}× rovnými na každé straně a ${curvesFor180}× oblouky v zatáčkách.`;

    // Siding
    if (form.withSiding && turnoutL && turnoutR) {
      addToBom(turnoutL, 1);
      addToBom(turnoutR, 1);
      addToBom(mainStraight, 2);
      description += ` Jedna odstavná kolej s výhybkami.`;
    }

    // Station
    if (form.withStation && turnoutL && turnoutR) {
      addToBom(turnoutL, 2);
      addToBom(turnoutR, 2);
      addToBom(mainStraight, 4);
      description += ` Nádraží se 2 kolejemi a 4 výhybkami.`;
    }

    if (curveSpanX * 2 + totalStraightLen > boardW) {
      warnings.push(`Trať se těsně nevejde do šířky ${form.width} cm — zvažte větší desku nebo menší poloměr.`);
    }
    if (curveSpanY > boardH) {
      warnings.push(`Oblouky přesahují výšku desky ${form.height} cm.`);
    }
  } else if (form.style === "figure-eight") {
    // Figure eight: two ovals crossing
    const topStraights = Math.max(2, Math.floor(straightCount / 2));
    addToBom(mainStraight, topStraights * 4);
    addToBom(useCurve, curvesFor180 * 4);

    description = `Osmička — dvě propojené smyčky s ${topStraights * 4}× rovnými a ${curvesFor180 * 4}× oblouky. Křížení uprostřed (vyžaduje křížový díl nebo úrovňové zkřížení).`;

    if (form.withStation && turnoutL && turnoutR) {
      addToBom(turnoutL, 2);
      addToBom(turnoutR, 2);
      addToBom(mainStraight, 3);
      description += ` Nádraží v jedné smyčce.`;
    }

    warnings.push("Osmička vyžaduje křížový díl (nebo úrovňové zkřížení) — zkontrolujte dostupnost ve vašem systému.");
  } else if (form.style === "dogbone") {
    // Dogbone: long straights with reversing loops at ends
    const mainStraights = Math.max(3, straightCount);
    addToBom(mainStraight, mainStraights * 2);
    addToBom(useCurve, curvesFor180 * 2);

    description = `Dogbone (kost) — ${mainStraights * 2}× rovných se smyčkami na obou koncích. Delší tratě pro plynulý provoz.`;

    if (form.withStation && turnoutL && turnoutR) {
      addToBom(turnoutL, 2);
      addToBom(turnoutR, 2);
      addToBom(mainStraight, 4);
      description += ` Nádraží uprostřed tratě.`;
    }
  } else if (form.style === "lshaped") {
    const legStraights = Math.max(2, Math.floor(straightCount * 0.6));
    addToBom(mainStraight, legStraights * 4);
    addToBom(useCurve, curvesFor180 * 2 + Math.ceil(90 / anglePer) * 2);

    description = `Trať ve tvaru L — dvě ramena s ${legStraights * 4}× rovnými a oblouky v rozích. Vhodné pro rohové umístění.`;

    if (form.withStation && turnoutL && turnoutR) {
      addToBom(turnoutL, 2);
      addToBom(turnoutR, 2);
      addToBom(mainStraight, 3);
      description += ` Nádraží v jednom rameni.`;
    }
  } else if (form.style === "point-to-point") {
    const mainStraights = Math.max(4, straightCount);
    addToBom(mainStraight, mainStraights);

    if (turnoutL && turnoutR) {
      addToBom(turnoutL, 2);
      addToBom(turnoutR, 2);
      addToBom(mainStraight, 4);
    }

    const curveSegments = Math.ceil(90 / anglePer);
    addToBom(useCurve, curveSegments * 2);

    description = `Bod-bod trať — ${mainStraights}× rovných s konečnými stanicemi na obou koncích. Realistický provoz s objíždění.`;
  } else if (form.style === "loop-with-station") {
    const mainStraights = straightCount;
    addToBom(mainStraight, mainStraights * 2 + 6);
    addToBom(useCurve, curvesFor180 * 2);

    if (turnoutL && turnoutR) {
      addToBom(turnoutL, 3);
      addToBom(turnoutR, 3);
      description = `Ovál s nádražím — ${mainStraights * 2}× rovných, 6 výhybek, 3 staniční koleje, ${curvesFor180 * 2}× oblouků.`;
    } else {
      description = `Ovál s prodlouženými rovnými úseky pro nádraží.`;
    }
  }

  // Add scale info
  const scaleInfo = `Měřítko ${form.scale} (1:${SCALE_FACTOR[form.scale]}), systém ${catalog.name}.`;
  description = scaleInfo + " " + description;

  return {
    pieces,
    bom: Array.from(bomMap.values()).sort((a, b) => {
      const order = { straight: 0, curve: 1, "turnout-left": 2, "turnout-right": 3, crossing: 4 };
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
  const svgH = (boardH / boardW) * svgW;
  const scale = (svgW - padding * 2) / boardW;

  const catalog = TRACK_CATALOGS[form.trackSystem];
  const mainCurve = catalog.pieces.find((p) => p.type === "curve")!;
  const mainStraight = catalog.pieces.find((p) => p.type === "straight")!;
  const R = mainCurve?.radius ?? 350;
  const anglePer = mainCurve?.angle ?? 30;
  const SL = mainStraight?.length ?? 230;
  const curvesFor180 = Math.ceil(180 / anglePer);

  // Calculate oval dimensions for schematic
  const straightCount = result.bom.find(b => b.piece.type === "straight")?.count ?? 4;
  const straightsPerSide = Math.floor(straightCount / 4) || 2;
  const totalStraightLen = straightsPerSide * SL;
  const ovalW = totalStraightLen + R * 2;
  const ovalH = R * 2;

  // Center oval
  const ovalCX = boardW / 2;
  const ovalCY = boardH / 2;
  const ovalLeft = ovalCX - ovalW / 2;
  const ovalTop = ovalCY - ovalH / 2;

  const hasTurnouts = result.bom.some(b => b.piece.type === "turnout-left" || b.piece.type === "turnout-right");

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH + padding}`}
      style={{ width: "100%", maxWidth: "800px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border)" }}
    >
      {/* Board */}
      <rect
        x={padding}
        y={padding / 2}
        width={boardW * scale}
        height={boardH * scale}
        fill="var(--bg-input)"
        stroke="var(--border-hover)"
        strokeWidth="2"
        rx="4"
      />

      {/* Grid lines */}
      {Array.from({ length: Math.floor(form.width / 10) + 1 }, (_, i) => (
        <line
          key={`gv${i}`}
          x1={padding + i * 100 * scale}
          y1={padding / 2}
          x2={padding + i * 100 * scale}
          y2={padding / 2 + boardH * scale}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}
      {Array.from({ length: Math.floor(form.height / 10) + 1 }, (_, i) => (
        <line
          key={`gh${i}`}
          x1={padding}
          y1={padding / 2 + i * 100 * scale}
          x2={padding + boardW * scale}
          y2={padding / 2 + i * 100 * scale}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}

      {/* Dimension labels */}
      <text x={padding + boardW * scale / 2} y={padding / 2 - 10} fill="var(--text-dim)" fontSize="12" textAnchor="middle">
        {form.width} cm
      </text>
      <text x={padding - 10} y={padding / 2 + boardH * scale / 2} fill="var(--text-dim)" fontSize="12" textAnchor="middle" transform={`rotate(-90, ${padding - 10}, ${padding / 2 + boardH * scale / 2})`}>
        {form.height} cm
      </text>

      {/* Track layout (schematic) */}
      {form.style === "oval" || form.style === "loop-with-station" ? (
        <g>
          {/* Oval path */}
          <ellipse
            cx={padding + ovalCX * scale}
            cy={padding / 2 + ovalCY * scale}
            rx={ovalW / 2 * scale}
            ry={ovalH / 2 * scale}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Track direction arrow */}
          <polygon
            points={`${padding + (ovalCX + ovalW / 4) * scale - 6},${padding / 2 + ovalTop * scale - 2} ${padding + (ovalCX + ovalW / 4) * scale + 6},${padding / 2 + ovalTop * scale - 2} ${padding + (ovalCX + ovalW / 4) * scale},${padding / 2 + ovalTop * scale - 10}`}
            fill="var(--accent)"
          />

          {/* Station area */}
          {hasTurnouts && (
            <g>
              <rect
                x={padding + (ovalCX - totalStraightLen * 0.35) * scale}
                y={padding / 2 + (ovalTop - 15) * scale}
                width={totalStraightLen * 0.7 * scale}
                height={30 * scale}
                fill="var(--accent-bg-subtle)"
                stroke="var(--accent-border)"
                strokeWidth="1"
                strokeDasharray="4,2"
                rx="4"
              />
              <text
                x={padding + ovalCX * scale}
                y={padding / 2 + (ovalTop - 25) * scale}
                fill="var(--accent)"
                fontSize="11"
                textAnchor="middle"
                fontWeight="600"
              >
                🏛️ Nádraží
              </text>
              {/* Siding tracks */}
              <line
                x1={padding + (ovalCX - totalStraightLen * 0.25) * scale}
                y1={padding / 2 + (ovalTop + 8) * scale}
                x2={padding + (ovalCX + totalStraightLen * 0.25) * scale}
                y2={padding / 2 + (ovalTop + 8) * scale}
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="6,3"
                opacity="0.6"
              />
            </g>
          )}

          {/* Siding */}
          {form.withSiding && (
            <g>
              <line
                x1={padding + (ovalCX + totalStraightLen * 0.1) * scale}
                y1={padding / 2 + (ovalCY + ovalH / 2) * scale}
                x2={padding + (ovalCX + totalStraightLen * 0.35) * scale}
                y2={padding / 2 + (ovalCY + ovalH / 2 + 40) * scale}
                stroke="var(--accent)"
                strokeWidth="2.5"
                opacity="0.5"
              />
              <text
                x={padding + (ovalCX + totalStraightLen * 0.35 + 10) * scale}
                y={padding / 2 + (ovalCY + ovalH / 2 + 40) * scale}
                fill="var(--text-dim)"
                fontSize="10"
              >
                Odstavná kolej
              </text>
            </g>
          )}
        </g>
      ) : form.style === "figure-eight" ? (
        <g>
          {/* Two overlapping ovals */}
          <ellipse
            cx={padding + (ovalCX - ovalW * 0.25) * scale}
            cy={padding / 2 + ovalCY * scale}
            rx={ovalW / 3 * scale}
            ry={ovalH / 2 * scale}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
          />
          <ellipse
            cx={padding + (ovalCX + ovalW * 0.25) * scale}
            cy={padding / 2 + ovalCY * scale}
            rx={ovalW / 3 * scale}
            ry={ovalH / 2 * scale}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
          />
          {/* Crossing indicator */}
          <circle
            cx={padding + ovalCX * scale}
            cy={padding / 2 + ovalCY * scale}
            r="6"
            fill="var(--danger)"
            stroke="var(--bg-card)"
            strokeWidth="2"
          />
          <text x={padding + ovalCX * scale} y={padding / 2 + ovalCY * scale + 20} fill="var(--text-dim)" fontSize="10" textAnchor="middle">
            Křížení
          </text>
        </g>
      ) : form.style === "dogbone" ? (
        <g>
          {/* Two parallel lines with loops at ends */}
          <line
            x1={padding + (ovalCX - ovalW / 2 + R) * scale}
            y1={padding / 2 + (ovalCY - R * 0.3) * scale}
            x2={padding + (ovalCX + ovalW / 2 - R) * scale}
            y2={padding / 2 + (ovalCY - R * 0.3) * scale}
            stroke="var(--accent)" strokeWidth="4"
          />
          <line
            x1={padding + (ovalCX - ovalW / 2 + R) * scale}
            y1={padding / 2 + (ovalCY + R * 0.3) * scale}
            x2={padding + (ovalCX + ovalW / 2 - R) * scale}
            y2={padding / 2 + (ovalCY + R * 0.3) * scale}
            stroke="var(--accent)" strokeWidth="4"
          />
          {/* End loops */}
          <path
            d={`M ${padding + (ovalCX - ovalW / 2 + R) * scale} ${padding / 2 + (ovalCY - R * 0.3) * scale} A ${R * 0.3 * scale} ${R * 0.3 * scale} 0 0 0 ${padding + (ovalCX - ovalW / 2 + R) * scale} ${padding / 2 + (ovalCY + R * 0.3) * scale}`}
            fill="none" stroke="var(--accent)" strokeWidth="4"
          />
          <path
            d={`M ${padding + (ovalCX + ovalW / 2 - R) * scale} ${padding / 2 + (ovalCY - R * 0.3) * scale} A ${R * 0.3 * scale} ${R * 0.3 * scale} 0 0 1 ${padding + (ovalCX + ovalW / 2 - R) * scale} ${padding / 2 + (ovalCY + R * 0.3) * scale}`}
            fill="none" stroke="var(--accent)" strokeWidth="4"
          />
        </g>
      ) : form.style === "point-to-point" ? (
        <g>
          {/* Main line */}
          <line
            x1={padding + boardW * 0.1 * scale}
            y1={padding / 2 + ovalCY * scale}
            x2={padding + boardW * 0.9 * scale}
            y2={padding / 2 + ovalCY * scale}
            stroke="var(--accent)" strokeWidth="4"
          />
          {/* End stations */}
          {[0.1, 0.9].map((pos, i) => (
            <g key={i}>
              <rect
                x={padding + (boardW * pos - 40) * scale}
                y={padding / 2 + (ovalCY - 30) * scale}
                width={80 * scale}
                height={60 * scale}
                fill="var(--accent-bg-subtle)"
                stroke="var(--accent-border)"
                strokeWidth="1"
                rx="4"
              />
              <text
                x={padding + boardW * pos * scale}
                y={padding / 2 + (ovalCY - 35) * scale}
                fill="var(--accent)"
                fontSize="10"
                textAnchor="middle"
              >
                🏛️ Stanice {i === 0 ? "A" : "B"}
              </text>
            </g>
          ))}
        </g>
      ) : (
        // L-shaped or fallback
        <g>
          <path
            d={`M ${padding + boardW * 0.15 * scale} ${padding / 2 + boardH * 0.3 * scale}
                L ${padding + boardW * 0.6 * scale} ${padding / 2 + boardH * 0.3 * scale}
                Q ${padding + boardW * 0.7 * scale} ${padding / 2 + boardH * 0.3 * scale}
                  ${padding + boardW * 0.7 * scale} ${padding / 2 + boardH * 0.4 * scale}
                L ${padding + boardW * 0.7 * scale} ${padding / 2 + boardH * 0.85 * scale}`}
            fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
          />
          <path
            d={`M ${padding + boardW * 0.15 * scale} ${padding / 2 + boardH * 0.35 * scale}
                L ${padding + boardW * 0.55 * scale} ${padding / 2 + boardH * 0.35 * scale}
                Q ${padding + boardW * 0.65 * scale} ${padding / 2 + boardH * 0.35 * scale}
                  ${padding + boardW * 0.65 * scale} ${padding / 2 + boardH * 0.45 * scale}
                L ${padding + boardW * 0.65 * scale} ${padding / 2 + boardH * 0.85 * scale}`}
            fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" opacity="0.6"
          />
        </g>
      )}

      {/* Scale indicator */}
      <text x={padding + boardW * scale - 5} y={svgH + padding / 2 - 5} fill="var(--text-faint)" fontSize="10" textAnchor="end">
        {form.scale} 1:{SCALE_FACTOR[form.scale]} · {TRACK_CATALOGS[form.trackSystem].name}
      </text>
    </svg>
  );
}

/* ===========================
   MAIN PAGE
   =========================== */
export default function TrackDesignerPage() {
  const [form, setForm] = useState<FormData>({
    width: 200,
    height: 100,
    scale: "H0",
    trackSystem: "roco-line",
    style: "oval",
    withStation: true,
    withSiding: false,
  });
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    // Simulate brief "thinking" for UX
    setTimeout(() => {
      const layout = generateLayout(form);
      setResult(layout);
      setGenerating(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, 600);
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

  const layoutStyles: { value: LayoutStyle; label: string; icon: string }[] = [
    { value: "oval", label: "Ovál", icon: "🔵" },
    { value: "loop-with-station", label: "Ovál s nádražím", icon: "🏛️" },
    { value: "figure-eight", label: "Osmička", icon: "8️⃣" },
    { value: "dogbone", label: "Kost (dogbone)", icon: "🦴" },
    { value: "point-to-point", label: "Bod-bod", icon: "🚉" },
    { value: "lshaped", label: "Tvar L", icon: "📐" },
  ];

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
          Zadejte rozměry a styl — vygenerujeme kolejový plán i seznam dílů
        </p>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Form */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
            ⚙️ Parametry kolejiště
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            {/* Dimensions */}
            <div>
              <label style={labelStyle}>Šířka desky (cm)</label>
              <input
                type="number"
                value={form.width}
                onChange={(e) => update("width", Number(e.target.value))}
                min={60}
                max={600}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Hloubka desky (cm)</label>
              <input
                type="number"
                value={form.height}
                onChange={(e) => update("height", Number(e.target.value))}
                min={40}
                max={400}
                style={inputStyle}
              />
            </div>

            {/* Scale */}
            <div>
              <label style={labelStyle}>Měřítko</label>
              <select value={form.scale} onChange={(e) => update("scale", e.target.value as Scale)} style={selectStyle}>
                <option value="H0">H0 (1:87)</option>
                <option value="TT">TT (1:120)</option>
                <option value="N">N (1:160)</option>
              </select>
            </div>

            {/* Track system */}
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

          {/* Layout style picker */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Typ tratě</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
              {layoutStyles.map((ls) => (
                <button
                  key={ls.value}
                  onClick={() => update("style", ls.value)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: "10px",
                    border: `2px solid ${form.style === ls.value ? "var(--accent)" : "var(--border)"}`,
                    background: form.style === ls.value ? "var(--accent-bg)" : "var(--bg-input)",
                    color: form.style === ls.value ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: form.style === ls.value ? 700 : 500,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: "22px", marginBottom: "4px" }}>{ls.icon}</div>
                  {ls.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "28px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={form.withStation}
                onChange={(e) => update("withStation", e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              🏛️ Nádraží
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={form.withSiding}
                onChange={(e) => update("withSiding", e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              🔀 Odstavná kolej
            </label>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: "100%",
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
            {generating ? "⏳ Generuji plán..." : "🚂 Vygenerovat kolejový plán"}
          </button>
        </div>

        {/* Result */}
        {result && (
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
                    <p key={i} style={{ fontSize: "13px", color: "#ffc107", margin: i > 0 ? "6px 0 0" : 0 }}>
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
