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
}

/* ===========================
   TRACK PLAN TYPES
   =========================== */
interface Point {
  x: number;
  y: number;
}

interface TrackElement {
  type: "straight" | "curve";
  start: Point;
  end: Point;
  center?: Point;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  layer: "main" | "secondary" | "siding";
  pieceId: string;
  tunnel?: boolean;
}

interface BOMItem {
  id: string;
  name: string;
  nameCz: string;
  type: string;
  count: number;
}

interface StationMarker {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface TunnelPortal {
  x: number;
  y: number;
  angle: number;
}

interface TrackPlan {
  tracks: TrackElement[];
  bom: BOMItem[];
  warnings: string[];
  stations: StationMarker[];
  tunnelPortals: TunnelPortal[];
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
   HELPER: Get catalog pieces
   =========================== */
function getCatalogPieces(trackSystem: TrackSystem) {
  const catalog = TRACK_CATALOGS[trackSystem];
  const pieces = catalog.pieces;
  // Find the primary straight (longest)
  const straights = pieces.filter((p) => p.type === "straight" && p.length).sort((a, b) => (b.length ?? 0) - (a.length ?? 0));
  const shortStraights = pieces.filter((p) => p.type === "straight" && p.length).sort((a, b) => (a.length ?? 0) - (b.length ?? 0));
  // Find curves sorted by radius (smallest first = tightest)
  const curves = pieces.filter((p) => p.type === "curve" && p.radius && p.angle).sort((a, b) => (a.radius ?? 0) - (b.radius ?? 0));
  const turnoutLeft = pieces.find((p) => p.type === "turnout-left");
  const turnoutRight = pieces.find((p) => p.type === "turnout-right");

  return {
    primaryStraight: straights[0],
    shortStraight: shortStraights[0],
    allStraights: straights,
    innerCurve: curves[0],
    outerCurve: curves.length > 1 ? curves[1] : curves[0],
    allCurves: curves,
    turnoutLeft,
    turnoutRight,
  };
}

/* ===========================
   TRACK PLAN GENERATOR
   =========================== */
function generateTrackPlan(form: FormData): TrackPlan {
  const catalog = getCatalogPieces(form.trackSystem);
  const tracks: TrackElement[] = [];
  const bomMap: Map<string, { piece: TrackPiece; count: number }> = new Map();
  const warnings: string[] = [];
  const stations: StationMarker[] = [];
  const tunnelPortals: TunnelPortal[] = [];

  const addBom = (piece: TrackPiece, count: number = 1) => {
    const existing = bomMap.get(piece.id);
    if (existing) {
      existing.count += count;
    } else {
      bomMap.set(piece.id, { piece, count });
    }
  };

  // Board dimensions in mm
  const boardW = form.width * 10;
  const boardH = form.height * 10;
  const margin = 50; // mm from edges

  // Get primary pieces
  const straightPiece = catalog.primaryStraight;
  const shortPiece = catalog.shortStraight;
  const curvePiece = catalog.innerCurve;
  const outerCurvePiece = catalog.outerCurve;

  if (!straightPiece || !curvePiece) {
    return { tracks: [], bom: [], warnings: ["Nedostatek dílů v katalogu"], stations: [], tunnelPortals: [] };
  }

  const R = curvePiece.radius!;
  const curveAngleDeg = curvePiece.angle!;
  const curveAngleRad = (curveAngleDeg * Math.PI) / 180;
  const piecesFor180 = Math.ceil(180 / curveAngleDeg);
  const L = straightPiece.length!;

  // Build oval helper: creates an oval loop at given center, fitting within constraints
  function buildOval(
    centerX: number,
    centerY: number,
    availW: number,
    availH: number,
    curveR: number,
    curvePc: TrackPiece,
    straightPc: TrackPiece,
    layer: "main" | "secondary" | "siding"
  ): { elements: TrackElement[]; topStraightStart: Point; topStraightEnd: Point; bottomStraightStart: Point; bottomStraightEnd: Point; actualW: number; actualH: number; numStraights: number } {
    const elements: TrackElement[] = [];
    const sLen = straightPc.length!;
    const cAngleDeg = curvePc.angle!;
    const cAngleRad = (cAngleDeg * Math.PI) / 180;
    const pFor180 = Math.ceil(180 / cAngleDeg);

    // Available horizontal space for straights = total width - 2 * curve radius
    const straightAvail = availW - 2 * curveR;
    if (straightAvail < sLen) {
      // Not enough space — try with minimum
      warnings.push(`Deska je příliš úzká pro zvolený systém kolejí (potřeba min. ${Math.ceil((2 * curveR + sLen) / 10)} cm šířky)`);
    }

    const numStraights = Math.max(1, Math.floor(straightAvail / sLen));
    const actualStraightLen = numStraights * sLen;

    // Oval geometry:
    // Top straight: left to right at y = centerY - (availH/2 - curveR) mapped to topY
    // Bottom straight: right to left at bottomY
    // Left curve: 180° turning from bottom to top
    // Right curve: 180° turning from top to bottom

    const topY = centerY - curveR;
    const bottomY = centerY + curveR;
    const leftX = centerX - actualStraightLen / 2;
    const rightX = centerX + actualStraightLen / 2;

    // Top straight segments (going right)
    for (let i = 0; i < numStraights; i++) {
      const sx = leftX + i * sLen;
      elements.push({
        type: "straight",
        start: { x: sx, y: topY },
        end: { x: sx + sLen, y: topY },
        layer,
        pieceId: straightPc.id,
      });
      addBom(straightPc);
    }

    // Right curve (top to bottom, 180° clockwise)
    const rightCenterX = rightX;
    const rightCenterY = centerY;
    for (let i = 0; i < pFor180; i++) {
      const sa = -Math.PI / 2 + i * cAngleRad;
      const ea = sa + cAngleRad;
      elements.push({
        type: "curve",
        start: {
          x: rightCenterX + curveR * Math.cos(sa),
          y: rightCenterY + curveR * Math.sin(sa),
        },
        end: {
          x: rightCenterX + curveR * Math.cos(ea),
          y: rightCenterY + curveR * Math.sin(ea),
        },
        center: { x: rightCenterX, y: rightCenterY },
        radius: curveR,
        startAngle: sa,
        endAngle: ea,
        layer,
        pieceId: curvePc.id,
      });
      addBom(curvePc);
    }

    // Bottom straight segments (going left)
    for (let i = 0; i < numStraights; i++) {
      const sx = rightX - i * sLen;
      elements.push({
        type: "straight",
        start: { x: sx, y: bottomY },
        end: { x: sx - sLen, y: bottomY },
        layer,
        pieceId: straightPc.id,
      });
      addBom(straightPc);
    }

    // Left curve (bottom to top, 180° clockwise)
    const leftCenterX = leftX;
    const leftCenterY = centerY;
    for (let i = 0; i < pFor180; i++) {
      const sa = Math.PI / 2 + i * cAngleRad;
      const ea = sa + cAngleRad;
      elements.push({
        type: "curve",
        start: {
          x: leftCenterX + curveR * Math.cos(sa),
          y: leftCenterY + curveR * Math.sin(sa),
        },
        end: {
          x: leftCenterX + curveR * Math.cos(ea),
          y: leftCenterY + curveR * Math.sin(ea),
        },
        center: { x: leftCenterX, y: leftCenterY },
        radius: curveR,
        startAngle: sa,
        endAngle: ea,
        layer,
        pieceId: curvePc.id,
      });
      addBom(curvePc);
    }

    return {
      elements,
      topStraightStart: { x: leftX, y: topY },
      topStraightEnd: { x: rightX, y: topY },
      bottomStraightStart: { x: rightX, y: bottomY },
      bottomStraightEnd: { x: leftX, y: bottomY },
      actualW: actualStraightLen + 2 * curveR,
      actualH: 2 * curveR,
      numStraights,
    };
  }

  // Build a siding branch: a short straight track branching off
  function buildSiding(
    startX: number,
    startY: number,
    heading: number, // radians, direction of main track
    side: "left" | "right",
    numPieces: number,
    straightPc: TrackPiece,
    turnoutPc: TrackPiece
  ): TrackElement[] {
    const elements: TrackElement[] = [];
    const branchAngle = side === "right" ? heading + (15 * Math.PI) / 180 : heading - (15 * Math.PI) / 180;
    const tLen = turnoutPc.length ?? straightPc.length!;
    const sLen = straightPc.length!;

    // Turnout piece (on main line, but we represent just the diverging branch)
    const tEndX = startX + tLen * Math.cos(branchAngle);
    const tEndY = startY + tLen * Math.sin(branchAngle);
    elements.push({
      type: "straight",
      start: { x: startX, y: startY },
      end: { x: tEndX, y: tEndY },
      layer: "siding",
      pieceId: turnoutPc.id,
    });
    addBom(turnoutPc);

    // Straight siding pieces
    let cx = tEndX;
    let cy = tEndY;
    for (let i = 0; i < numPieces; i++) {
      const nx = cx + sLen * Math.cos(branchAngle);
      const ny = cy + sLen * Math.sin(branchAngle);
      elements.push({
        type: "straight",
        start: { x: cx, y: cy },
        end: { x: nx, y: ny },
        layer: "siding",
        pieceId: straightPc.id,
      });
      addBom(straightPc);
      cx = nx;
      cy = ny;
    }

    return elements;
  }

  // The center of the oval on the board
  const cx = boardW / 2;
  const cy = boardH / 2;
  const usableW = boardW - 2 * margin;
  const usableH = boardH - 2 * margin;

  // Adjust curve radius to fit height
  // Oval height = 2*R, so R must be <= usableH/2
  let effectiveR = R;
  if (2 * R > usableH) {
    // Find a smaller curve if available
    const fittingCurve = catalog.allCurves.find((c) => c.radius! * 2 <= usableH);
    if (fittingCurve) {
      effectiveR = fittingCurve.radius!;
    } else {
      effectiveR = usableH / 2;
      warnings.push("Hloubka desky je malá — oblouky nemusí přesně odpovídat katalogu.");
    }
  }

  const effectiveCurvePiece = catalog.allCurves.find((c) => c.radius === effectiveR) ?? curvePiece;

  switch (form.character) {
    case "mala-diorama": {
      // Simple oval + maybe 1 siding
      const oval = buildOval(cx, cy, usableW, usableH, effectiveR, effectiveCurvePiece, straightPiece, "main");
      tracks.push(...oval.elements);

      // Add one siding on the top straight, roughly 1/3 from left
      if (oval.numStraights >= 2) {
        const sidingX = oval.topStraightStart.x + L;
        const sidingY = oval.topStraightStart.y;
        const turnout = catalog.turnoutRight;
        if (turnout) {
          const siding = buildSiding(sidingX, sidingY, 0, "right", 2, shortPiece ?? straightPiece, turnout);
          tracks.push(...siding);
        }
      }
      break;
    }

    case "prujezdna-stanice": {
      // Oval with passing loop (station) on top straight
      const oval = buildOval(cx, cy, usableW, usableH, effectiveR, effectiveCurvePiece, straightPiece, "main");
      tracks.push(...oval.elements);

      // Passing loop: two turnouts splitting to a parallel track on top straight
      if (oval.numStraights >= 3 && catalog.turnoutLeft && catalog.turnoutRight) {
        const tl = catalog.turnoutLeft;
        const tr = catalog.turnoutRight;
        const tLen = tl.length ?? L;
        const trackSpacing = 30; // mm between parallel tracks

        // Entry turnout (left diverge = goes "up" in SVG = negative Y)
        // Actually: for a passing loop on top straight going right,
        // we split to a track above (lower Y) and merge back
        const entryX = oval.topStraightStart.x + L;
        const entryY = oval.topStraightStart.y;
        const exitX = oval.topStraightEnd.x - L;

        // Secondary track parallel above the main
        const secY = entryY - trackSpacing;
        const branchAngle = Math.atan2(-trackSpacing, tLen);

        // Entry diverge
        const entryEndX = entryX + tLen * Math.cos(branchAngle);
        const entryEndY = entryY + tLen * Math.sin(branchAngle);
        tracks.push({
          type: "straight",
          start: { x: entryX, y: entryY },
          end: { x: entryEndX, y: entryEndY },
          layer: "secondary",
          pieceId: tl.id,
        });
        addBom(tl);

        // Parallel straight(s)
        const parallelLen = exitX - entryX - 2 * tLen;
        const numParallel = Math.max(1, Math.floor(parallelLen / L));
        for (let i = 0; i < numParallel; i++) {
          const sx = entryEndX + i * L;
          tracks.push({
            type: "straight",
            start: { x: sx, y: secY },
            end: { x: sx + L, y: secY },
            layer: "secondary",
            pieceId: straightPiece.id,
          });
          addBom(straightPiece);
        }

        // Exit merge
        const exitMergeStartX = entryEndX + numParallel * L;
        tracks.push({
          type: "straight",
          start: { x: exitMergeStartX, y: secY },
          end: { x: exitX, y: entryY },
          layer: "secondary",
          pieceId: tr.id,
        });
        addBom(tr);

        // Station platform marker
        stations.push({
          x: entryEndX + 20,
          y: secY + 2,
          width: numParallel * L - 40,
          height: trackSpacing - 4,
          label: "Stanice",
        });
      }
      break;
    }

    case "horska-trat": {
      // Single track oval with 1-2 sidings, tunnel on one curve
      const oval = buildOval(cx, cy, usableW, usableH, effectiveR, effectiveCurvePiece, straightPiece, "main");
      tracks.push(...oval.elements);

      // Mark left curve segments as tunnel
      const leftCurveElements = oval.elements.filter(
        (e) => e.type === "curve" && e.center && e.center.x < cx
      );
      leftCurveElements.forEach((e) => {
        e.tunnel = true;
      });

      // Add tunnel portals at top-left and bottom-left of the oval
      if (leftCurveElements.length > 0) {
        tunnelPortals.push(
          { x: leftCurveElements[0].start.x, y: leftCurveElements[0].start.y, angle: Math.PI },
          { x: leftCurveElements[leftCurveElements.length - 1].end.x, y: leftCurveElements[leftCurveElements.length - 1].end.y, angle: Math.PI }
        );
      }

      // Siding on bottom straight
      if (oval.numStraights >= 2 && catalog.turnoutLeft) {
        const sidingX = oval.bottomStraightEnd.x + L;
        const sidingY = oval.bottomStraightEnd.y;
        const siding = buildSiding(sidingX, sidingY, Math.PI, "left", 2, shortPiece ?? straightPiece, catalog.turnoutLeft);
        tracks.push(...siding);
      }
      break;
    }

    case "hlavni-koridor": {
      // Double track oval (inner + outer loop)
      const trackSpacing = 30; // mm between the two tracks
      const innerR = effectiveR;
      const outerR = effectiveR + trackSpacing;
      const outerCurvePc = catalog.allCurves.find((c) => c.radius! >= outerR) ?? catalog.outerCurve;

      // Inner oval
      const innerOval = buildOval(cx, cy, usableW - 2 * trackSpacing, usableH - 2 * trackSpacing, innerR, effectiveCurvePiece, straightPiece, "main");
      tracks.push(...innerOval.elements);

      // Outer oval (uses outer radius)
      const outerOval = buildOval(cx, cy, usableW, usableH, outerR, outerCurvePc, straightPiece, "secondary");
      tracks.push(...outerOval.elements);
      break;
    }

    case "stanice-vlecky": {
      // Oval with large station area (3-4 parallel tracks, freight siding)
      const oval = buildOval(cx, cy, usableW, usableH, effectiveR, effectiveCurvePiece, straightPiece, "main");
      tracks.push(...oval.elements);

      const trackSpacing = 25;
      const stationTracks = 3;

      if (oval.numStraights >= 4 && catalog.turnoutLeft && catalog.turnoutRight) {
        const tl = catalog.turnoutLeft;
        const tr = catalog.turnoutRight;
        const tLen = tl.length ?? L;

        for (let t = 1; t <= stationTracks; t++) {
          const secY = oval.topStraightStart.y - t * trackSpacing;
          const entryX = oval.topStraightStart.x + L;
          const exitX = oval.topStraightEnd.x - L;
          const branchAngle = Math.atan2(-trackSpacing * t, tLen);

          // Entry
          tracks.push({
            type: "straight",
            start: { x: entryX, y: oval.topStraightStart.y },
            end: { x: entryX + tLen * Math.cos(branchAngle), y: oval.topStraightStart.y + tLen * Math.sin(branchAngle) },
            layer: "secondary",
            pieceId: tl.id,
          });
          addBom(tl);

          // Parallel straights
          const parallelLen = exitX - entryX - 2 * tLen;
          const numP = Math.max(1, Math.floor(parallelLen / L));
          const startPX = entryX + tLen * Math.cos(branchAngle);
          for (let i = 0; i < numP; i++) {
            tracks.push({
              type: "straight",
              start: { x: startPX + i * L, y: secY },
              end: { x: startPX + (i + 1) * L, y: secY },
              layer: t === 1 ? "secondary" : "siding",
              pieceId: straightPiece.id,
            });
            addBom(straightPiece);
          }

          // Exit merge
          tracks.push({
            type: "straight",
            start: { x: startPX + numP * L, y: secY },
            end: { x: exitX, y: oval.topStraightStart.y },
            layer: "secondary",
            pieceId: tr.id,
          });
          addBom(tr);
        }

        // Station platform
        const stEntryX = oval.topStraightStart.x + L + (tl.length ?? L);
        const stWidth = (oval.topStraightEnd.x - L - (tr.length ?? L)) - stEntryX;
        stations.push({
          x: stEntryX,
          y: oval.topStraightStart.y - stationTracks * trackSpacing - 5,
          width: Math.max(stWidth, 100),
          height: stationTracks * trackSpacing + 10,
          label: "Nádraží",
        });

        // Freight siding on bottom
        if (catalog.turnoutRight) {
          const fSidingX = oval.bottomStraightStart.x - L * 2;
          const fSidingY = oval.bottomStraightStart.y;
          const siding = buildSiding(fSidingX, fSidingY, Math.PI, "left", 3, shortPiece ?? straightPiece, catalog.turnoutRight);
          tracks.push(...siding);
        }
      }
      break;
    }

    case "prumyslova-vlecka": {
      // Point-to-point with multiple industrial spurs
      // We'll still build an oval base but add spurs
      const oval = buildOval(cx, cy, usableW, usableH, effectiveR, effectiveCurvePiece, straightPiece, "main");
      tracks.push(...oval.elements);

      // Industrial spurs on bottom straight
      const spurPositions = [1, 3, 5];
      for (const pos of spurPositions) {
        if (pos < oval.numStraights && catalog.turnoutLeft) {
          const spurX = oval.bottomStraightEnd.x + pos * L;
          const spurY = oval.bottomStraightEnd.y;
          const spur = buildSiding(spurX, spurY, Math.PI, "left", 2, shortPiece ?? straightPiece, catalog.turnoutLeft);
          tracks.push(...spur);
        }
      }

      // Top spur
      if (oval.numStraights >= 3 && catalog.turnoutRight) {
        const spurX = oval.topStraightStart.x + L * 2;
        const spurY = oval.topStraightStart.y;
        const spur = buildSiding(spurX, spurY, 0, "right", 3, shortPiece ?? straightPiece, catalog.turnoutRight);
        tracks.push(...spur);
      }
      break;
    }
  }

  // Build BOM list
  const bom: BOMItem[] = [];
  bomMap.forEach(({ piece, count }) => {
    bom.push({
      id: piece.id,
      name: piece.name,
      nameCz: piece.nameCz,
      type: piece.type,
      count,
    });
  });
  bom.sort((a, b) => {
    const order = ["straight", "curve", "turnout-left", "turnout-right", "crossing"];
    return order.indexOf(a.type) - order.indexOf(b.type);
  });

  return { tracks, bom, warnings, stations, tunnelPortals };
}

/* ===========================
   SVG RENDERER COMPONENT
   =========================== */
function TrackPlanSVG({
  plan,
  form,
}: {
  plan: TrackPlan;
  form: FormData;
}) {
  const boardW = form.width * 10; // mm
  const boardH = form.height * 10;
  const padding = 70;
  const svgW = 900;

  // Compute SVG height proportionally
  const svgContentW = svgW - padding * 2;
  const sc = svgContentW / boardW;
  const svgH = boardH * sc + padding * 2;
  const offX = padding;
  const offY = padding;

  // Transform mm → SVG coordinates
  const tx = (x: number) => offX + x * sc;
  const ty = (y: number) => offY + y * sc;

  // Grid dots every 100mm
  const gridDotsX = Math.floor(boardW / 100) + 1;
  const gridDotsY = Math.floor(boardH / 100) + 1;

  // Board path
  let boardPath = "";
  if (form.boardShape === "rectangle") {
    boardPath = `M ${offX} ${offY} h ${boardW * sc} v ${boardH * sc} h ${-boardW * sc} Z`;
  } else if (form.boardShape === "l-shape") {
    const w1 = boardW * sc, h1 = boardH * sc;
    const w2 = form.width2 * 10 * sc, h2 = form.height2 * 10 * sc;
    boardPath = `M ${offX} ${offY} h ${w1} v ${h1} h ${-(w1 - w2)} v ${h2} h ${-w2} Z`;
  } else if (form.boardShape === "u-shape") {
    const armW = form.uArmDepth * 10 * sc;
    const w = boardW * sc, h = boardH * sc;
    boardPath = `M ${offX} ${offY} h ${armW} v ${h * 0.4} h ${w} v ${-h * 0.4} h ${armW} v ${h} h ${-(w + 2 * armW)} Z`;
  }

  // Render sleeper marks for a straight segment
  const renderStraightSleepers = (x1: number, y1: number, x2: number, y2: number, strokeW: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const nx = -dy / len;
    const ny = dx / len;
    const sleeperSpacing = 12;
    const count = Math.max(1, Math.floor(len / sleeperSpacing));
    const halfW = strokeW * 1.2;

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
          stroke="var(--accent)"
          strokeWidth={0.8}
          opacity={0.35}
        />
      );
    }
    return sleepers;
  };

  // Render sleeper marks along a curve
  const renderCurveSleepers = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    strokeW: number
  ) => {
    const halfW = strokeW * 1.2;
    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += Math.PI * 2;
    const arcLen = radius * angleDiff * sc;
    const sleeperSpacing = 12;
    const count = Math.max(1, Math.floor(arcLen / sleeperSpacing));

    const sleepers: React.ReactElement[] = [];
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const a = startAngle + angleDiff * t;
      const px = centerX + radius * sc * Math.cos(a);
      const py = centerY + radius * sc * Math.sin(a);
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
          stroke="var(--accent)"
          strokeWidth={0.8}
          opacity={0.35}
        />
      );
    }
    return sleepers;
  };

  // Render a single track element
  const renderTrack = (el: TrackElement, i: number) => {
    const isSiding = el.layer === "siding";
    const isSecondary = el.layer === "secondary";
    const strokeW = isSiding ? 2.5 : isSecondary ? 3 : 4;
    const opacity = isSiding ? 0.55 : isSecondary ? 0.75 : 1;
    const dashArray = el.tunnel ? "8,5" : undefined;

    if (el.type === "straight") {
      const x1 = tx(el.start.x);
      const y1 = ty(el.start.y);
      const x2 = tx(el.end.x);
      const y2 = ty(el.end.y);

      return (
        <g key={`tr${i}`}>
          {renderStraightSleepers(x1, y1, x2, y2, strokeW)}
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="var(--accent)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            opacity={opacity}
            strokeDasharray={dashArray}
          />
        </g>
      );
    }

    if (el.type === "curve" && el.center && el.radius != null && el.startAngle != null && el.endAngle != null) {
      const cxs = tx(el.center.x);
      const cys = ty(el.center.y);
      const r = el.radius * sc;
      const sa = el.startAngle;
      const ea = el.endAngle;
      const sx = cxs + r * Math.cos(sa);
      const sy = cys + r * Math.sin(sa);
      const ex = cxs + r * Math.cos(ea);
      const ey = cys + r * Math.sin(ea);

      let angleDiff = ea - sa;
      if (angleDiff < 0) angleDiff += Math.PI * 2;
      const largeArc = angleDiff > Math.PI ? 1 : 0;

      const pathD = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;

      return (
        <g key={`tr${i}`}>
          {renderCurveSleepers(cxs, cys, el.radius, sa, ea, strokeW)}
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            opacity={opacity}
            strokeDasharray={dashArray}
          />
        </g>
      );
    }

    return null;
  };

  // Render station markers
  const renderStation = (st: StationMarker, i: number) => (
    <g key={`st${i}`}>
      <rect
        x={tx(st.x)}
        y={ty(st.y)}
        width={st.width * sc}
        height={st.height * sc}
        fill="var(--accent)"
        opacity={0.06}
        stroke="var(--accent)"
        strokeWidth={0.8}
        strokeDasharray="4,2"
        rx={4}
      />
      <text
        x={tx(st.x) + (st.width * sc) / 2}
        y={ty(st.y) - 6}
        fill="var(--accent)"
        fontSize={11}
        textAnchor="middle"
        fontWeight={600}
      >
        🏛️ {st.label}
      </text>
    </g>
  );

  // Render tunnel portals
  const renderTunnelPortal = (tp: TunnelPortal, i: number) => {
    const px = tx(tp.x);
    const py = ty(tp.y);
    return (
      <g key={`tp${i}`}>
        {/* Arch shape */}
        <path
          d={`M ${px - 8} ${py + 4} Q ${px - 8} ${py - 8} ${px} ${py - 10} Q ${px + 8} ${py - 8} ${px + 8} ${py + 4} Z`}
          fill="var(--text-dim)"
          opacity={0.3}
          stroke="var(--text-dim)"
          strokeWidth={1}
        />
        <text x={px} y={py - 14} fill="var(--text-dim)" fontSize={8} textAnchor="middle">
          🚇
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${svgW} ${Math.max(svgH, 250)}`}
      style={{
        width: "100%",
        maxWidth: "900px",
        background: "var(--bg-card)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
      }}
    >
      {/* Board background */}
      <path
        d={boardPath}
        fill="var(--bg-input)"
        stroke="var(--border-hover)"
        strokeWidth={2}
      />

      {/* Grid dots */}
      {Array.from({ length: gridDotsX }, (_, xi) =>
        Array.from({ length: gridDotsY }, (_, yi) => (
          <circle
            key={`gd${xi}-${yi}`}
            cx={offX + xi * 100 * sc}
            cy={offY + yi * 100 * sc}
            r={1.2}
            fill="var(--border)"
            opacity={0.4}
          />
        ))
      )}

      {/* Dimension labels */}
      {/* Top: width */}
      <line
        x1={offX} y1={offY - 20}
        x2={offX + boardW * sc} y2={offY - 20}
        stroke="var(--text-faint)" strokeWidth={0.8}
        markerStart="url(#arrowL)" markerEnd="url(#arrowR)"
      />
      <text
        x={offX + (boardW * sc) / 2}
        y={offY - 26}
        fill="var(--text-dim)"
        fontSize={11}
        textAnchor="middle"
        fontWeight={600}
      >
        {form.width} cm
      </text>

      {/* Left: height */}
      <line
        x1={offX - 20} y1={offY}
        x2={offX - 20} y2={offY + boardH * sc}
        stroke="var(--text-faint)" strokeWidth={0.8}
        markerStart="url(#arrowU)" markerEnd="url(#arrowD)"
      />
      <text
        x={offX - 26}
        y={offY + (boardH * sc) / 2}
        fill="var(--text-dim)"
        fontSize={11}
        textAnchor="middle"
        fontWeight={600}
        transform={`rotate(-90, ${offX - 26}, ${offY + (boardH * sc) / 2})`}
      >
        {form.height} cm
      </text>

      {/* Arrow markers */}
      <defs>
        <marker id="arrowR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="0">
          <path d="M0,0 L6,3 L0,6" fill="var(--text-faint)" />
        </marker>
        <marker id="arrowL" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="180">
          <path d="M0,0 L6,3 L0,6" fill="var(--text-faint)" />
        </marker>
        <marker id="arrowD" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="90">
          <path d="M0,0 L6,3 L0,6" fill="var(--text-faint)" />
        </marker>
        <marker id="arrowU" markerWidth="6" markerHeight="6" refX="3" refY="1" orient="270">
          <path d="M0,0 L6,3 L0,6" fill="var(--text-faint)" />
        </marker>
      </defs>

      {/* Station markers */}
      {plan.stations.map((st, i) => renderStation(st, i))}

      {/* Track elements */}
      {plan.tracks.map((el, i) => renderTrack(el, i))}

      {/* Tunnel portals */}
      {plan.tunnelPortals.map((tp, i) => renderTunnelPortal(tp, i))}

      {/* Legend */}
      <g transform={`translate(${offX + boardW * sc - 130}, ${offY + boardH * sc + 20})`}>
        <rect x={0} y={0} width={140} height={70} rx={6} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={0.8} opacity={0.95} />
        <text x={10} y={16} fill="var(--text-dim)" fontSize={9} fontWeight={700}>LEGENDA</text>
        <line x1={10} y1={24} x2={35} y2={24} stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" />
        <text x={42} y={28} fill="var(--text-dim)" fontSize={8}>Hlavní trať</text>
        <line x1={10} y1={38} x2={35} y2={38} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" opacity={0.75} />
        <text x={42} y={42} fill="var(--text-dim)" fontSize={8}>Objízdná / 2. kolej</text>
        <line x1={10} y1={52} x2={35} y2={52} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" opacity={0.55} />
        <text x={42} y={56} fill="var(--text-dim)" fontSize={8}>Vlečka / odstavná</text>
      </g>

      {/* Scale indicator */}
      <text
        x={offX + 5}
        y={offY + boardH * sc + 40}
        fill="var(--text-faint)"
        fontSize={10}
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
  });
  const [plan, setPlan] = useState<TrackPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setPlan(null);

    // Use requestAnimationFrame to allow the UI to update before heavy computation
    requestAnimationFrame(() => {
      const result = generateTrackPlan(form);
      setPlan(result);
      setGenerating(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
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
          Zadejte rozměry a charakter — generátor navrhne kolejový plán i seznam dílů
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
            {generating ? "⏳ Generuji kolejiště..." : "🚂 Navrhnout kolejiště"}
          </button>
        </div>

        {/* Results area */}
        <div ref={resultRef} style={{ marginTop: "32px" }}>
          {/* Results */}
          {plan && (
            <>
              {/* 1. SVG Track Plan */}
              <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", textAlign: "left" }}>
                  📐 Kolejový plán
                </h2>
                <TrackPlanSVG plan={plan} form={form} />
              </div>

              {/* 2. Warnings */}
              {plan.warnings.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: "20px", borderColor: "rgba(255, 193, 7, 0.4)" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#ffc107", marginBottom: "12px" }}>
                    ⚠️ Upozornění
                  </h2>
                  {plan.warnings.map((w, i) => (
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
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.5px",
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plan.bom.map((item, i) => {
                        const typeIcons: Record<string, string> = {
                          straight: "➖", curve: "↪️", "turnout-left": "↙️", "turnout-right": "↗️", crossing: "✖️",
                        };
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-light, var(--border))" }}>
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
                    {plan.bom.reduce((sum, item) => sum + item.count, 0)}×
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
