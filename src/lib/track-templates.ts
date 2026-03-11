/**
 * Pre-defined Track Layout Templates
 *
 * These serve as:
 * - Fallback when AI generation fails
 * - Base layouts that AI can modify
 * - Directly selectable by users
 */

import type { LayoutDefinition, LayoutSegment } from "./track-layout-engine";
import type { TrackScale } from "./track-library";

// ============================================================
// Helpers
// ============================================================

/** Create N copies of a segment */
function repeat(seg: LayoutSegment, count: number): LayoutSegment[] {
  return Array.from({ length: count }, () => ({ ...seg }));
}

/** Shorthand for a straight segment */
function s(pieceId: string, opts?: Partial<LayoutSegment>): LayoutSegment {
  return { pieceId, ...opts };
}

// ============================================================
// TT Templates (Tillig TT 1:120)
// ============================================================

/**
 * Simple oval — TT
 * 2× straight sections + 2× 180° curves (24× R1-15°)
 */
const TT_SIMPLE_OVAL: LayoutDefinition = {
  mainLoop: [
    // Top straight section (4× G4 = 4×332mm)
    ...repeat(s("tt-g4"), 4),
    // Right 180° turn (12× R1-15° = 180°)
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight section (4× G4)
    ...repeat(s("tt-g4"), 4),
    // Left 180° turn (12× R1-15° = 180°)
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [],
};

/**
 * Oval with passing siding — TT
 * Main oval with turnouts and a parallel siding for trains to pass
 *
 * Geometry: Each side must have equal total straight length.
 * Turnout ewl/ewr = 166mm each.
 * Top: ewl(166) + 2×G4(664) + ewr(166) = 996mm ← same as 3×G4(996)
 * Bottom: 3×G4 = 996mm
 * So top has turnouts replacing the first and last G4 halves.
 */
const TT_OVAL_WITH_SIDING: LayoutDefinition = {
  mainLoop: [
    // Top straight with turnouts (total: 166+332+332+166 = 996mm = 3×G4 equivalent)
    s("tt-ewl"),  // index 0: left turnout → siding branches off (166mm)
    s("tt-g4"),   // 332mm
    s("tt-g4"),   // 332mm
    s("tt-ewr"),  // index 3: right turnout → siding merges back (166mm)
    // Right 180° turn
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight (3×G4 = 996mm — matches top)
    ...repeat(s("tt-g4"), 3),
    // Left 180° turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        // Siding parallel to main
        s("tt-g4"),
        s("tt-g4"),
      ],
    },
  ],
};

/**
 * Figure eight — TT
 * A simple oval (figure-eight requires level crossing which is complex).
 * We use a basic oval with a crossing piece in the middle of one straight.
 *
 * Geometry: crossing DK = 166mm (same as G1).
 * Top: G4(332) + G4(332) + DK(166) + G4(332) = 1162mm
 * Bottom: G4(332) + G4(332) + G1(166) + G4(332) = 1162mm
 */
const TT_FIGURE_EIGHT: LayoutDefinition = {
  mainLoop: [
    // Top straight with crossing
    s("tt-g4"),
    s("tt-g4"),
    s("tt-dk"), // crossing (166mm, same as G1)
    s("tt-g4"),
    // Right turn (full 180°)
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight (must match top total = 1162mm)
    s("tt-g4"),   // 332
    s("tt-g4"),   // 332
    s("tt-g1"),   // 166
    s("tt-g4"),   // 332 → total 1162mm ✓
    // Left turn (full 180°)
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [],
};

/**
 * Station with yard — TT
 * Oval with a station area (multiple parallel tracks)
 *
 * Geometry: Turnout ewl/ewr = 166mm each.
 * Top: ewl(166) + G1(166) + ewl(166) + G1(166) + ewr(166) + G1(166) + ewr(166) = 1162mm
 * Bottom: 3×G4(996) + G1(166) = 1162mm ← must match!
 * Total width: ~1162 + 620 = ~1782mm — fits 200cm board
 */
const TT_STATION_WITH_YARD: LayoutDefinition = {
  mainLoop: [
    // Station area — top straight (compact version)
    s("tt-ewl"),   // index 0: first turnout for platform siding (166mm)
    s("tt-g1"),    // 166mm
    s("tt-ewl"),   // index 2: second turnout for yard (166mm)
    s("tt-g1"),    // 166mm
    s("tt-ewr"),   // index 4: yard rejoin (166mm)
    s("tt-g1"),    // 166mm
    s("tt-ewr"),   // index 6: siding rejoin (166mm)
    // Right turn
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight — 3×G4 + G1 = 996 + 166 = 1162mm (matches top)
    ...repeat(s("tt-g4"), 3),
    s("tt-g1"),
    // Left turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Platform siding from turnout 0
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("tt-g1"),
        s("tt-g1"),
        s("tt-g1"),
      ],
    },
    {
      // Yard track from turnout 2
      sourceSegmentIndex: 2,
      sourceConnection: "c",
      segments: [
        s("tt-g1"),
        s("tt-g2"),
      ],
    },
  ],
};

/**
 * Mountain loop — TT
 * Ovál s tunely — zatím bez výškových změn (elevation systém se dodělá později).
 * Koleje v tunelové sekci mají isTunnel pro vizuální označení.
 */
const TT_MOUNTAIN_LOOP: LayoutDefinition = {
  mainLoop: [
    // Valley section (3× G4)
    ...repeat(s("tt-g4"), 3),
    // Approach
    s("tt-g4"),
    // Right turn (tunnel section)
    ...repeat(s("tt-r1-15", { isTunnel: true }), 12),
    // Mountain top (tunely, bez elevation)
    s("tt-g4", { isTunnel: true }),
    s("tt-g4", { isTunnel: true }),
    s("tt-g4", { isTunnel: true }),
    // Descending
    s("tt-g4"),
    // Left turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [],
};

/**
 * Industrial spur — TT
 * Oval with industrial siding branching off
 *
 * Geometry: Turnout ewl = 166mm.
 * Top: G4(332) + ewl(166) + G4(332) + G1(166) = 996mm
 * Bottom: 3×G4(996) = 996mm ← matches!
 */
const TT_INDUSTRIAL_SPUR: LayoutDefinition = {
  mainLoop: [
    // Main line top
    s("tt-g4"),    // 332mm
    s("tt-ewl"),   // index 1: turnout (166mm)
    s("tt-g4"),    // 332mm
    s("tt-g1"),    // 166mm → total 996mm
    // Right turn
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight — 3×G4 = 996mm
    ...repeat(s("tt-g4"), 3),
    // Left turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Industrial spur (dead-end siding)
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("tt-g4"),
        s("tt-g1"),
        s("tt-g2"),
      ],
    },
  ],
};

// ============================================================
// H0 Templates (Roco GeoLine 1:87)
// ============================================================

/**
 * Simple oval — H0
 * 2× straight sections + 2× 180° curves (12× R2-30°)
 */
const H0_SIMPLE_OVAL: LayoutDefinition = {
  mainLoop: [
    // Top straight section (3× G345 = 3×345mm)
    ...repeat(s("h0-g345"), 3),
    // Right 180° turn (6× R2-30° = 180°)
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight section
    ...repeat(s("h0-g345"), 3),
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [],
};

/**
 * Oval with passing siding — H0
 *
 * Geometry: Turnout wl15/wr15 = 230mm each.
 * Top: wl15(230) + G345(345) + wr15(230) = 805mm
 * Bottom: G345(345) + G230(230) + G230(230) = 805mm ← matches!
 */
const H0_OVAL_WITH_SIDING: LayoutDefinition = {
  mainLoop: [
    // Top with turnouts
    s("h0-wl15"),  // index 0: turnout (230mm)
    s("h0-g345"),  // 345mm
    s("h0-wr15"),  // index 2: rejoin turnout (230mm) → total 805mm
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight: 345 + 230 + 230 = 805mm
    s("h0-g345"),
    s("h0-g230"),
    s("h0-g230"),
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("h0-g345"),
      ],
    },
  ],
};

/**
 * Figure eight — H0
 *
 * Geometry: crossing DK = 230mm (same as G230).
 * Top: G345(345) + DK(230) + G345(345) = 920mm
 * Bottom: G345(345) + G230(230) + G345(345) = 920mm ← matches!
 */
const H0_FIGURE_EIGHT: LayoutDefinition = {
  mainLoop: [
    // Top with crossing
    s("h0-g345"),  // 345mm
    s("h0-dk"),    // 230mm
    s("h0-g345"),  // 345mm → total 920mm
    // Right turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom: 345 + 230 + 345 = 920mm
    s("h0-g345"),
    s("h0-g230"),
    s("h0-g345"),
    // Left turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [],
};

/**
 * Station with yard — H0
 *
 * Geometry: Turnout wl15/wr15 = 230mm each.
 * Top: wl15(230) + G345(345) + wl15(230) + G345(345) + wr15(230) + G345(345) + wr15(230) = 1955mm
 * Bottom must match: we need 1955mm worth of straights
 *   5×G345(1725) + G230(230) = 1955mm ✓
 */
const H0_STATION_WITH_YARD: LayoutDefinition = {
  mainLoop: [
    // Station area
    s("h0-wl15"),  // index 0: first turnout (230mm)
    s("h0-g345"),  // 345mm
    s("h0-wl15"),  // index 2: second turnout (230mm)
    s("h0-g345"),  // 345mm
    s("h0-wr15"),  // index 4: rejoin yard (230mm)
    s("h0-g345"),  // 345mm
    s("h0-wr15"),  // index 6: rejoin siding (230mm)
    // Right turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight: 5×345 + 230 = 1955mm
    ...repeat(s("h0-g345"), 5),
    s("h0-g230"),
    // Left turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("h0-g345"),
        s("h0-g345"),
        s("h0-g345"),
        s("h0-g345"),
      ],
    },
    {
      sourceSegmentIndex: 2,
      sourceConnection: "c",
      segments: [
        s("h0-g230"),
        s("h0-g230"),
      ],
    },
  ],
};

/**
 * Mountain loop — H0
 * Ovál s tunely — bez elevation (dodělá se později).
 */
const H0_MOUNTAIN_LOOP: LayoutDefinition = {
  mainLoop: [
    ...repeat(s("h0-g345"), 3),
    ...repeat(s("h0-r2-30", { isTunnel: true }), 6),
    s("h0-g345", { isTunnel: true }),
    s("h0-g345", { isTunnel: true }),
    s("h0-g345"),
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [],
};

/**
 * Industrial spur — H0
 *
 * Geometry: Turnout wl15 = 230mm.
 * Top: G345(345) + wl15(230) + G345(345) = 920mm
 * Bottom: G345(345) + G345(345) + G230(230) = 920mm ← matches!
 */
const H0_INDUSTRIAL_SPUR: LayoutDefinition = {
  mainLoop: [
    // Main line top
    s("h0-g345"),  // 345mm
    s("h0-wl15"),  // index 1: turnout (230mm)
    s("h0-g345"),  // 345mm → total 920mm
    // Right turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight: 345 + 345 + 230 = 920mm
    s("h0-g345"),
    s("h0-g345"),
    s("h0-g230"),
    // Left turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("h0-g345"),
        s("h0-g230"),
      ],
    },
  ],
};

// ============================================================
// Template Registry
// ============================================================

export interface TemplateInfo {
  id: string;
  name: string;
  nameCs: string;
  description: string;
  descriptionCs: string;
  layouts: Partial<Record<TrackScale, LayoutDefinition>>;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "simple-oval",
    name: "Simple Oval",
    nameCs: "Jednoduchý ovál",
    description: "Basic oval loop with straight sections and curves",
    descriptionCs: "Základní ovál s rovnými úseky a oblouky",
    layouts: {
      TT: TT_SIMPLE_OVAL,
      H0: H0_SIMPLE_OVAL,
    },
  },
  {
    id: "oval-with-siding",
    name: "Oval with Passing Siding",
    nameCs: "Ovál s výhybnou",
    description: "Oval loop with a parallel passing siding for train meets",
    descriptionCs: "Ovál s paralelní výhybnou pro míjení vlaků",
    layouts: {
      TT: TT_OVAL_WITH_SIDING,
      H0: H0_OVAL_WITH_SIDING,
    },
  },
  {
    id: "figure-eight",
    name: "Figure Eight",
    nameCs: "Osmička",
    description: "Two loops sharing a crossing in the middle",
    descriptionCs: "Dvě smyčky spojené křížením uprostřed",
    layouts: {
      TT: TT_FIGURE_EIGHT,
      H0: H0_FIGURE_EIGHT,
    },
  },
  {
    id: "station-with-yard",
    name: "Station with Yard",
    nameCs: "Stanice s nádražím",
    description: "Oval with a station area featuring multiple parallel tracks",
    descriptionCs: "Ovál se stanicí s více paralelními kolejemi",
    layouts: {
      TT: TT_STATION_WITH_YARD,
      H0: H0_STATION_WITH_YARD,
    },
  },
  {
    id: "mountain-loop",
    name: "Mountain Loop",
    nameCs: "Horská trať",
    description: "Oval with tunnel sections and elevation changes",
    descriptionCs: "Ovál s tunely a výškovými změnami",
    layouts: {
      TT: TT_MOUNTAIN_LOOP,
      H0: H0_MOUNTAIN_LOOP,
    },
  },
  {
    id: "industrial-spur",
    name: "Industrial Spur",
    nameCs: "Průmyslová vlečka",
    description: "Oval with a dead-end industrial siding",
    descriptionCs: "Ovál s kusou průmyslovou vlečkou",
    layouts: {
      TT: TT_INDUSTRIAL_SPUR,
      H0: H0_INDUSTRIAL_SPUR,
    },
  },
];

/** Get a template by ID */
export function getTemplate(templateId: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.id === templateId);
}

/** Get a layout definition for a specific template and scale */
export function getTemplateLayout(
  templateId: string,
  scale: TrackScale,
): LayoutDefinition | undefined {
  const template = getTemplate(templateId);
  if (!template) return undefined;
  return template.layouts[scale];
}

/** Get all template IDs */
export function getTemplateIds(): string[] {
  return TEMPLATES.map((t) => t.id);
}
