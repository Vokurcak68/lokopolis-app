/**
 * Track Library — Tillig TT & Roco H0 track piece definitions
 * Each piece has: id, type, geometry, and connection points
 */

// ============================================================
// Types
// ============================================================

export type TrackType = "straight" | "curve" | "turnout" | "crossing";
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
  const sign = direction === "left" ? 1 : -1;
  const divergeX = radius * Math.sin(angleRad);
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
          x: halfLen - halfLen * Math.cos(angleRad),
          y: 0,
          z: halfLen * Math.sin(angleRad),
        },
        angle: Math.PI + angleRad,
        id: "c",
      },
      {
        position: {
          x: halfLen + halfLen * Math.cos(angleRad),
          y: 0,
          z: halfLen * Math.sin(angleRad),
        },
        angle: angleRad,
        id: "d",
      },
    ],
    category: "Křížení",
    manufacturer,
  };
}

// ============================================================
// Tillig TT Track Catalog
// ============================================================

export const TILLIG_TT: TrackPieceDefinition[] = [
  // Straight tracks
  straight("tt-g1", "G1 přímá 166mm", "TT", 166, "Tillig", "83101"),
  straight("tt-g2", "G2 přímá 83mm", "TT", 83, "Tillig", "83102"),
  straight("tt-g3", "G3 přímá 41.5mm", "TT", 41.5, "Tillig", "83103"),
  straight("tt-g4", "G4 přímá 332mm", "TT", 332, "Tillig", "83104"),
  straight("tt-g5", "G5 přímá 228mm", "TT", 228, "Tillig", "83142"),
  straight("tt-g6", "G6 přímá 55mm", "TT", 55, "Tillig", "83106"),

  // Curves R1 (310mm)
  curve("tt-r1-15", "R1 oblouk 15°", "TT", 310, 15, "Tillig", "83110"),
  curve("tt-r1-30", "R1 oblouk 30°", "TT", 310, 30, "Tillig", "83111"),

  // Curves R2 (353mm)
  curve("tt-r2-15", "R2 oblouk 15°", "TT", 353, 15, "Tillig", "83112"),
  curve("tt-r2-30", "R2 oblouk 30°", "TT", 353, 30, "Tillig", "83113"),

  // Curves R3 (396mm)
  curve("tt-r3-15", "R3 oblouk 15°", "TT", 396, 15, "Tillig", "83114"),
  curve("tt-r3-30", "R3 oblouk 30°", "TT", 396, 30, "Tillig", "83115"),

  // Curves R4 (439mm) — for double track outer curve
  curve("tt-r4-15", "R4 oblouk 15°", "TT", 439, 15, "Tillig", "83116"),
  curve("tt-r4-30", "R4 oblouk 30°", "TT", 439, 30, "Tillig", "83117"),

  // Turnouts
  turnout("tt-ewl", "Výhybka levá EWL", "TT", 166, 15, "left", 310, "Tillig", "83320"),
  turnout("tt-ewr", "Výhybka pravá EWR", "TT", 166, 15, "right", 310, "Tillig", "83321"),

  // Crossing
  crossing("tt-dk", "Křížení DK 15°", "TT", 166, 15, "Tillig", "83160"),
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
