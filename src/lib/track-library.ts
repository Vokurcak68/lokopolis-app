/**
 * Track Library — Tillig TT & Roco H0 track piece definitions
 * Each piece has: id, type, geometry, and connection points
 */

// ============================================================
// Types
// ============================================================

export type TrackType = "straight" | "curve" | "turnout" | "crossing" | "turntable";
export type TrackScale = "TT" | "H0";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A connection point on a track piece (position + outward direction angle in radians) */
export interface ConnectionPoint {
  position: Vec3;
  /** Direction angle in radians (0 = +X, PI/2 = +Z) — outward facing */
  angle: number;
  id: string;
}

/** Explicit segment override for complex pieces (IBW, ABW, DW, DKW Baeseler) */
export type ExplicitSegment =
  | { kind: "line"; fromX: number; fromZ: number; toX: number; toZ: number }
  | { kind: "arc"; centerX: number; centerZ: number; radius: number; startAngleDeg: number; endAngleDeg: number; ccw: boolean };

export interface TrackPieceDefinition {
  id: string;
  catalogNumber?: string;
  name: string;
  type: TrackType;
  scale: TrackScale;
  /** Length in mm (for straight/turnout main line) */
  length?: number;
  /** Radius in mm (for curves) */
  radius?: number;
  /** Angle in degrees (for curves / turnout diverge) */
  angle?: number;
  /** Direction for turnout: "left" | "right" */
  direction?: "left" | "right";
  /** Connection points in local space (track piece at origin, facing +X) */
  connections: ConnectionPoint[];
  /** Category for UI grouping */
  category: string;
  /** Manufacturer name */
  manufacturer: string;
  /** Explicit path segments for complex pieces — overrides auto-generated segments */
  explicitSegments?: ExplicitSegment[];
  /** Turntable-specific: pit diameter in mm */
  pitDiameter?: number;
  /** Turntable-specific: bridge length in mm */
  bridgeLength?: number;
  /** Turntable-specific: number of track positions around the circle */
  positions?: number;
  /** Turntable-specific: angle between positions in degrees */
  positionAngle?: number;
}

// ============================================================
// Helper: build connection points
// ============================================================

function straight(id: string, name: string, scale: TrackScale, length: number, manufacturer: string, catalogNumber?: string): TrackPieceDefinition {
  return {
    id,
    catalogNumber,
    name,
    type: "straight",
    scale,
    length,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: length, y: 0, z: 0 }, angle: 0, id: "b" },
    ],
    category: "Přímé",
    manufacturer,
  };
}

function curve(
  id: string, name: string, scale: TrackScale,
  radius: number, angleDeg: number, manufacturer: string, catalogNumber?: string,
): TrackPieceDefinition {
  const angleRad = (angleDeg * Math.PI) / 180;
  // Curve center is at (0, 0, radius) — curve bends to the left (positive Z)
  // Start point at (0,0,0), end point on the arc
  const endX = radius * Math.sin(angleRad);
  const endZ = radius - radius * Math.cos(angleRad);
  return {
    id,
    catalogNumber,
    name,
    type: "curve",
    scale,
    radius,
    angle: angleDeg,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: endX, y: 0, z: endZ }, angle: angleRad, id: "b" },
    ],
    category: "Oblouky",
    manufacturer,
  };
}

function turnout(
  id: string, name: string, scale: TrackScale,
  length: number, angleDeg: number, direction: "left" | "right",
  radius: number, manufacturer: string, catalogNumber?: string,
): TrackPieceDefinition {
  const angleRad = (angleDeg * Math.PI) / 180;
  // Screen/world handedness in planner is inverted vs catalog naming,
  // so left turnout must diverge to negative Z and right to positive Z.
  const sign = direction === "left" ? -1 : 1;

  // Realistic turnout geometry: diverging branch has a straight lead first,
  // then transitions into the curved section.
  // This keeps diverging endpoint close to the main-line length (EW1 behavior).
  const arcChordX = radius * Math.sin(angleRad);
  const divergeLeadX = Math.max(0, length - arcChordX);
  const divergeX = divergeLeadX + arcChordX;
  const divergeZ = sign * (radius - radius * Math.cos(angleRad));

  return {
    id,
    catalogNumber,
    name,
    type: "turnout",
    scale,
    length,
    angle: angleDeg,
    direction,
    radius,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: length, y: 0, z: 0 }, angle: 0, id: "b" },
      { position: { x: divergeX, y: 0, z: divergeZ }, angle: sign * angleRad, id: "c" },
    ],
    category: "Výhybky",
    manufacturer,
  };
}

function crossing(
  id: string, name: string, scale: TrackScale,
  length: number, angleDeg: number, manufacturer: string, catalogNumber?: string,
): TrackPieceDefinition {
  const angleRad = (angleDeg * Math.PI) / 180;
  const halfLen = length / 2;
  // Crossing = "X": kolej 1 rovně (A→B), kolej 2 šikmo přes střed (C→D)
  // Střed křížení je na (halfLen, 0). Kolej 2 prochází středem pod úhlem angleDeg.
  // C je na jedné straně středu, D na druhé — symetricky kolem středu.
  const halfDiag = halfLen; // délka od středu k C/D po šikmé koleji
  return {
    id,
    catalogNumber,
    name,
    type: "crossing",
    scale,
    length,
    angle: angleDeg,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: length, y: 0, z: 0 }, angle: 0, id: "b" },
      {
        position: {
          x: halfLen - halfDiag * Math.cos(angleRad),
          y: 0,
          z: -halfDiag * Math.sin(angleRad),
        },
        angle: Math.PI + angleRad,
        id: "c",
      },
      {
        position: {
          x: halfLen + halfDiag * Math.cos(angleRad),
          y: 0,
          z: halfDiag * Math.sin(angleRad),
        },
        angle: angleRad,
        id: "d",
      },
    ],
    category: "Křížení",
    manufacturer,
  };
}

function turntable(
  id: string, name: string, scale: TrackScale,
  pitDiameter: number, bridgeLength: number, positions: number, positionAngle: number,
  manufacturer: string, catalogNumber?: string,
): TrackPieceDefinition {
  const radius = pitDiameter / 2;
  // Generate connection points around the circle
  const connections: ConnectionPoint[] = [];
  for (let i = 0; i < positions; i++) {
    const angleDeg = i * positionAngle;
    const angleRad = (angleDeg * Math.PI) / 180;
    connections.push({
      position: {
        x: radius + radius * Math.cos(angleRad),
        y: 0,
        z: radius + radius * Math.sin(angleRad),
      },
      // Outward facing direction (away from center)
      angle: angleRad,
      id: `p${i}`,
    });
  }

  return {
    id,
    catalogNumber,
    name,
    type: "turntable",
    scale,
    pitDiameter,
    bridgeLength,
    positions,
    positionAngle,
    connections,
    category: "Točny",
    manufacturer,
  };
}

// ============================================================
// Tillig TT Track Catalog
// ============================================================

export const TILLIG_TT: TrackPieceDefinition[] = [
  // ─── Přímé koleje ───
  straight("tt-g1", "G1 přímá 166mm", "TT", 166, "Tillig", "83101"),
  straight("tt-g2", "G2 přímá 83mm", "TT", 83, "Tillig", "83102"),
  straight("tt-g3", "G3 přímá 41,5mm", "TT", 41.5, "Tillig", "83103"),
  straight("tt-g4", "G4 přímá 332mm", "TT", 332, "Tillig", "83104"),
  straight("tt-g5", "G5 přímá 228mm", "TT", 228, "Tillig", "83142"),
  straight("tt-g6", "G6 přímá 21,3mm", "TT", 21.3, "Tillig", "83120"),

  // ─── Oblouky R0 (267mm) ───
  curve("tt-r01-30", "R01 oblouk R267mm/30°", "TT", 267, 30, "Tillig", "83116"),
  curve("tt-r04-7.5", "R04 oblouk R267mm/7,5°", "TT", 267, 7.5, "Tillig", "83115"),

  // ─── Oblouky R1 (310mm) ───
  curve("tt-r11-30", "R11 oblouk R310mm/30°", "TT", 310, 30, "Tillig", "83109"),
  curve("tt-r12-15", "R12 oblouk R310mm/15°", "TT", 310, 15, "Tillig", "83110"),
  curve("tt-r14-7.5", "R14 oblouk R310mm/7,5°", "TT", 310, 7.5, "Tillig", "83113"),

  // ─── Oblouky R2 (353mm) ───
  curve("tt-r21-30", "R21 oblouk R353mm/30°", "TT", 353, 30, "Tillig", "83106"),
  curve("tt-r22-15", "R22 oblouk R353mm/15°", "TT", 353, 15, "Tillig", "83107"),
  curve("tt-r24-7.5", "R24 oblouk R353mm/7,5°", "TT", 353, 7.5, "Tillig", "83114"),

  // ─── Oblouky R3 (396mm) ───
  curve("tt-r31-30", "R31 oblouk R396mm/30°", "TT", 396, 30, "Tillig", "83111"),
  curve("tt-r32-15", "R32 oblouk R396mm/15°", "TT", 396, 15, "Tillig", "83112"),

  // ─── Výhybky EW1 (129,5mm / 15°) ───
  turnout("tt-ew1-r", "EW1 výhybka pravá 129,5mm/15°", "TT", 129.5, 15, "right", 310, "Tillig", "83328"),
  turnout("tt-ew1-l", "EW1 výhybka levá 129,5mm/15°", "TT", 129.5, 15, "left", 310, "Tillig", "83329"),

  // ─── Výhybky EW2 (166mm / 15°) ───
  turnout("tt-ew2-r", "EW2 výhybka pravá 166mm/15°", "TT", 166, 15, "right", 310, "Tillig", "83331"),
  turnout("tt-ew2-l", "EW2 výhybka levá 166mm/15°", "TT", 166, 15, "left", 310, "Tillig", "83332"),

  // ─── Výhybky EW3 (207mm / 12°) ───
  turnout("tt-ew3-r", "EW3 výhybka pravá 207mm/12°", "TT", 207, 12, "right", 631, "Tillig", "83341"),
  turnout("tt-ew3-l", "EW3 výhybka levá 207mm/12°", "TT", 207, 12, "left", 631, "Tillig", "83342"),

  // ─── IBW — Vnitřní oblouková výhybka (R631/15° + R310/30°) ───
  // Oba směry vedou obloukem: hlavní R631mm/15°, odbočka R310mm/30°
  {
    id: "tt-ibw-r",
    catalogNumber: "83363",
    name: "IBW výhybka oblouková pravá",
    type: "turnout",
    scale: "TT",
    radius: 631,
    angle: 15,
    direction: "right",
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      {
        position: {
          x: 631 * Math.sin((15 * Math.PI) / 180),
          y: 0,
          z: -(631 - 631 * Math.cos((15 * Math.PI) / 180)),
        },
        angle: -(15 * Math.PI) / 180,
        id: "b",
      },
      {
        position: {
          x: 310 * Math.sin((30 * Math.PI) / 180),
          y: 0,
          z: -(310 - 310 * Math.cos((30 * Math.PI) / 180)),
        },
        angle: -(30 * Math.PI) / 180,
        id: "c",
      },
    ],
    explicitSegments: [
      // Hlavní: R631mm/15° vpravo (center below, CW)
      { kind: "arc", centerX: 0, centerZ: -631, radius: 631, startAngleDeg: 90, endAngleDeg: 75, ccw: true },
      // Odbočka: R310mm/30° vpravo (center below, CW)
      { kind: "arc", centerX: 0, centerZ: -310, radius: 310, startAngleDeg: 90, endAngleDeg: 60, ccw: true },
    ],
    category: "Výhybky",
    manufacturer: "Tillig",
  },
  {
    id: "tt-ibw-l",
    catalogNumber: "83364",
    name: "IBW výhybka oblouková levá",
    type: "turnout",
    scale: "TT",
    radius: 631,
    angle: 15,
    direction: "left",
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      {
        position: {
          x: 631 * Math.sin((15 * Math.PI) / 180),
          y: 0,
          z: 631 - 631 * Math.cos((15 * Math.PI) / 180),
        },
        angle: (15 * Math.PI) / 180,
        id: "b",
      },
      {
        position: {
          x: 310 * Math.sin((30 * Math.PI) / 180),
          y: 0,
          z: 310 - 310 * Math.cos((30 * Math.PI) / 180),
        },
        angle: (30 * Math.PI) / 180,
        id: "c",
      },
    ],
    explicitSegments: [
      // Hlavní: R631mm/15° vlevo (center above, CCW)
      { kind: "arc", centerX: 0, centerZ: 631, radius: 631, startAngleDeg: -90, endAngleDeg: -75, ccw: false },
      // Odbočka: R310mm/30° vlevo (center above, CCW)
      { kind: "arc", centerX: 0, centerZ: 310, radius: 310, startAngleDeg: -90, endAngleDeg: -60, ccw: false },
    ],
    category: "Výhybky",
    manufacturer: "Tillig",
  },

  // ─── ABW1 — Vnější oblouková výhybka (R1273mm, 7,5°/7,5°) ───
  // Symetrická: oba směry R1273mm, jeden 7.5° vlevo, druhý 7.5° vpravo
  {
    id: "tt-abw1",
    catalogNumber: "83380",
    name: "ABW1 vnější oblouková 7,5°/7,5°",
    type: "turnout",
    scale: "TT",
    radius: 1273,
    angle: 7.5,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      {
        position: {
          x: 1273 * Math.sin((7.5 * Math.PI) / 180),
          y: 0,
          z: 1273 - 1273 * Math.cos((7.5 * Math.PI) / 180),
        },
        angle: (7.5 * Math.PI) / 180,
        id: "b",
      },
      {
        position: {
          x: 1273 * Math.sin((7.5 * Math.PI) / 180),
          y: 0,
          z: -(1273 - 1273 * Math.cos((7.5 * Math.PI) / 180)),
        },
        angle: -(7.5 * Math.PI) / 180,
        id: "c",
      },
    ],
    explicitSegments: [
      // Směr vlevo: R1273mm/7.5° (center above)
      { kind: "arc", centerX: 0, centerZ: 1273, radius: 1273, startAngleDeg: -90, endAngleDeg: -82.5, ccw: false },
      // Směr vpravo: R1273mm/7.5° (center below)
      { kind: "arc", centerX: 0, centerZ: -1273, radius: 1273, startAngleDeg: 90, endAngleDeg: 82.5, ccw: true },
    ],
    category: "Výhybky",
    manufacturer: "Tillig",
  },

  // ─── ABW2 — Vnější oblouková výhybka (R1986mm, 6°/6°) ───
  {
    id: "tt-abw2",
    catalogNumber: "83382",
    name: "ABW2 vnější oblouková 6°/6°",
    type: "turnout",
    scale: "TT",
    radius: 1986,
    angle: 6,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      {
        position: {
          x: 1986 * Math.sin((6 * Math.PI) / 180),
          y: 0,
          z: 1986 - 1986 * Math.cos((6 * Math.PI) / 180),
        },
        angle: (6 * Math.PI) / 180,
        id: "b",
      },
      {
        position: {
          x: 1986 * Math.sin((6 * Math.PI) / 180),
          y: 0,
          z: -(1986 - 1986 * Math.cos((6 * Math.PI) / 180)),
        },
        angle: -(6 * Math.PI) / 180,
        id: "c",
      },
    ],
    explicitSegments: [
      // Směr vlevo: R1986mm/6° (center above)
      { kind: "arc", centerX: 0, centerZ: 1986, radius: 1986, startAngleDeg: -90, endAngleDeg: -84, ccw: false },
      // Směr vpravo: R1986mm/6° (center below)
      { kind: "arc", centerX: 0, centerZ: -1986, radius: 1986, startAngleDeg: 90, endAngleDeg: 84, ccw: true },
    ],
    category: "Výhybky",
    manufacturer: "Tillig",
  },

  // ─── DW — Trojitá výhybka (Y) 166mm / 15°+15° ───
  {
    id: "tt-dw",
    catalogNumber: "83230",
    name: "DW trojitá výhybka 166mm/15°",
    type: "turnout",
    scale: "TT",
    length: 166,
    angle: 15,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: 166, y: 0, z: 0 }, angle: 0, id: "b" },
      {
        position: {
          x: 310 * Math.sin((15 * Math.PI) / 180),
          y: 0,
          z: 310 - 310 * Math.cos((15 * Math.PI) / 180),
        },
        angle: (15 * Math.PI) / 180,
        id: "c",
      },
      {
        position: {
          x: 310 * Math.sin((15 * Math.PI) / 180),
          y: 0,
          z: -(310 - 310 * Math.cos((15 * Math.PI) / 180)),
        },
        angle: -(15 * Math.PI) / 180,
        id: "d",
      },
    ],
    explicitSegments: [
      // Rovně
      { kind: "line", fromX: 0, fromZ: 0, toX: 166, toZ: 0 },
      // Odbočka vlevo: R310mm/15°
      { kind: "arc", centerX: 0, centerZ: 310, radius: 310, startAngleDeg: -90, endAngleDeg: -75, ccw: false },
      // Odbočka vpravo: R310mm/15°
      { kind: "arc", centerX: 0, centerZ: -310, radius: 310, startAngleDeg: 90, endAngleDeg: 75, ccw: true },
    ],
    category: "Výhybky",
    manufacturer: "Tillig",
  },

  // ─── DKW — Křížová výhybka 160mm / 15° ───
  // "X" tvar: kolej 1 rovně (A→B), kolej 2 šikmo přes střed (C→D)
  {
    id: "tt-dkw",
    catalogNumber: "83300",
    name: "DKW křížová výhybka 160mm/15°",
    type: "crossing",
    scale: "TT",
    length: 160,
    angle: 15,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: 160, y: 0, z: 0 }, angle: 0, id: "b" },
      {
        position: {
          x: 80 - 80 * Math.cos((15 * Math.PI) / 180),
          y: 0,
          z: -(80 * Math.sin((15 * Math.PI) / 180)),
        },
        angle: Math.PI + (15 * Math.PI) / 180,
        id: "c",
      },
      {
        position: {
          x: 80 + 80 * Math.cos((15 * Math.PI) / 180),
          y: 0,
          z: 80 * Math.sin((15 * Math.PI) / 180),
        },
        angle: (15 * Math.PI) / 180,
        id: "d",
      },
    ],
    category: "Křížení",
    manufacturer: "Tillig",
  },

  // ─── DKW Baeseler — Křížová výhybka 208,6mm / 15° / R792mm ───
  {
    id: "tt-dkw-baeseler",
    catalogNumber: "83391",
    name: "DKW Baeseler křížová 208,6mm/15°",
    type: "crossing",
    scale: "TT",
    length: 208.6,
    angle: 15,
    radius: 792,
    connections: [
      { position: { x: 0, y: 0, z: 0 }, angle: Math.PI, id: "a" },
      { position: { x: 208.6, y: 0, z: 0 }, angle: 0, id: "b" },
      {
        position: {
          x: 104.3 - 104.3 * Math.cos((15 * Math.PI) / 180),
          y: 0,
          z: -(104.3 * Math.sin((15 * Math.PI) / 180)),
        },
        angle: Math.PI + (15 * Math.PI) / 180,
        id: "c",
      },
      {
        position: {
          x: 104.3 + 104.3 * Math.cos((15 * Math.PI) / 180),
          y: 0,
          z: 104.3 * Math.sin((15 * Math.PI) / 180),
        },
        angle: (15 * Math.PI) / 180,
        id: "d",
      },
    ],
    category: "Křížení",
    manufacturer: "Tillig",
  },

  // ─── Křížení K1 — 166mm / 15° ───
  crossing("tt-k1", "K1 křížení 166mm/15°", "TT", 166, 15, "Tillig", "83161"),

  // ─── Křížení K2 — 86mm / 30° ───
  crossing("tt-k2", "K2 křížení 86mm/30°", "TT", 86, 30, "Tillig", "83170"),

  // ─── Točna ROCO 35900 ───
  turntable("tt-turntable", "Točna ROCO 35900", "TT", 228, 183, 24, 15, "Roco", "35900"),
];

// ============================================================
// Roco H0 Track Catalog (GeoLine)
// ============================================================

export const ROCO_H0: TrackPieceDefinition[] = [
  // Straight tracks
  straight("h0-g230", "G230 přímá 230mm", "H0", 230, "Roco GeoLine", "61110"),
  straight("h0-g200", "G200 přímá 200mm", "H0", 200, "Roco GeoLine", "61111"),
  straight("h0-g100", "G100 přímá 100mm", "H0", 100, "Roco GeoLine", "61112"),
  straight("h0-g345", "G345 přímá 345mm", "H0", 345, "Roco GeoLine", "61113"),

  // Curves R2 (358mm, 30°)
  curve("h0-r2-30", "R2 oblouk 30°", "H0", 358, 30, "Roco GeoLine", "61120"),
  curve("h0-r2-15", "R2 oblouk 15°", "H0", 358, 15, "Roco GeoLine", "61121"),

  // Curves R3 (419mm, 30°)
  curve("h0-r3-30", "R3 oblouk 30°", "H0", 419, 30, "Roco GeoLine", "61130"),

  // Curves R4 (481mm, 30°)
  curve("h0-r4-30", "R4 oblouk 30°", "H0", 481, 30, "Roco GeoLine", "61140"),
  curve("h0-r4-15", "R4 oblouk 15°", "H0", 481, 15, "Roco GeoLine", "61141b"),

  // Curves R5 (542mm) — for double track outer curve
  curve("h0-r5-30", "R5 oblouk 30°", "H0", 542, 30, "Roco GeoLine", "61150"),

  // Turnouts
  turnout("h0-wl15", "Výhybka levá WL15", "H0", 230, 15, "left", 502.7, "Roco GeoLine", "61140"),
  turnout("h0-wr15", "Výhybka pravá WR15", "H0", 230, 15, "right", 502.7, "Roco GeoLine", "61141"),

  // Crossing
  crossing("h0-dk", "Křížení DK 15°", "H0", 230, 15, "Roco GeoLine", "61160"),
];

// ============================================================
// Catalog lookup
// ============================================================

export const TRACK_CATALOGS: Record<TrackScale, TrackPieceDefinition[]> = {
  TT: TILLIG_TT,
  H0: ROCO_H0,
};

export function getTrackPiece(id: string): TrackPieceDefinition | undefined {
  for (const catalog of Object.values(TRACK_CATALOGS)) {
    const piece = catalog.find((p) => p.id === id);
    if (piece) return piece;
  }
  return undefined;
}

export function getCatalogByScale(scale: TrackScale): TrackPieceDefinition[] {
  return TRACK_CATALOGS[scale] || [];
}

/** Get manufacturer name for a scale */
export function getManufacturer(scale: TrackScale): string {
  const pieces = getCatalogByScale(scale);
  return pieces[0]?.manufacturer ?? "";
}

/** Group catalog pieces by category */
export function getCatalogGrouped(scale: TrackScale): Record<string, TrackPieceDefinition[]> {
  const pieces = getCatalogByScale(scale);
  const grouped: Record<string, TrackPieceDefinition[]> = {};
  for (const piece of pieces) {
    if (!grouped[piece.category]) grouped[piece.category] = [];
    grouped[piece.category].push(piece);
  }
  return grouped;
}
