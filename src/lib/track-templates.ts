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
 * Ovál s tunely a výškovými změnami.
 * Horní trať jede přes most (elevation 50mm), spodní trať je na úrovni 0.
 * Rampy: 332mm kusy, max 3% stoupání (332mm × 3% ≈ 10mm na kus).
 * 5 kusů rampy = 50mm výšky.
 *
 * Piece count must match original: 4×G4 top + 12×R1 right + 4×G4 bottom + 12×R1 left
 */
const TT_MOUNTAIN_LOOP: LayoutDefinition = {
  mainLoop: [
    // Valley section at ground level (3× G4)
    ...repeat(s("tt-g4"), 3),
    // Ramp up start
    s("tt-g4", { elevation: 10, isRamp: true }),
    // Right turn — continue climbing through the curve
    s("tt-r1-15", { elevation: 14, isRamp: true }),
    s("tt-r1-15", { elevation: 18, isRamp: true }),
    s("tt-r1-15", { elevation: 22, isRamp: true }),
    s("tt-r1-15", { elevation: 26, isRamp: true }),
    s("tt-r1-15", { elevation: 30, isRamp: true }),
    s("tt-r1-15", { elevation: 34, isRamp: true }),
    s("tt-r1-15", { elevation: 38, isRamp: true }),
    s("tt-r1-15", { elevation: 42, isRamp: true }),
    s("tt-r1-15", { elevation: 46, isRamp: true }),
    s("tt-r1-15", { elevation: 50, isBridge: true }),
    s("tt-r1-15", { elevation: 50, isBridge: true }),
    s("tt-r1-15", { elevation: 50, isBridge: true }),
    // Mountain top — bridge at full height (3×G4 + 1×G4 tunnel)
    s("tt-g4", { elevation: 50, isBridge: true }),
    s("tt-g4", { elevation: 50, isBridge: true }),
    s("tt-g4", { elevation: 50, isBridge: true, isTunnel: true }),
    // Ramp down start
    s("tt-g4", { elevation: 40, isRamp: true }),
    // Left turn — continue descending
    s("tt-r1-15", { elevation: 36, isRamp: true }),
    s("tt-r1-15", { elevation: 32, isRamp: true }),
    s("tt-r1-15", { elevation: 28, isRamp: true }),
    s("tt-r1-15", { elevation: 24, isRamp: true }),
    s("tt-r1-15", { elevation: 20, isRamp: true }),
    s("tt-r1-15", { elevation: 16, isRamp: true }),
    s("tt-r1-15", { elevation: 12, isRamp: true }),
    s("tt-r1-15", { elevation: 8, isRamp: true }),
    s("tt-r1-15", { elevation: 4, isRamp: true }),
    s("tt-r1-15", { elevation: 2, isRamp: true }),
    s("tt-r1-15"),
    s("tt-r1-15"),
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
 * Ovál s výškovými změnami — mosty a tunely.
 * Max 3%: 345mm × 3% ≈ 10mm na kus, R2-30° arc ~187mm × 3% ≈ 5.6mm.
 * Piece count: 3×G345 top + 6×R2 right + 3×G345 bottom + 6×R2 left
 */
const H0_MOUNTAIN_LOOP: LayoutDefinition = {
  mainLoop: [
    // Ground level
    ...repeat(s("h0-g345"), 2),
    // Ramp up
    s("h0-g345", { elevation: 10, isRamp: true }),
    // Right turn — climbing
    s("h0-r2-30", { elevation: 16, isRamp: true }),
    s("h0-r2-30", { elevation: 22, isRamp: true }),
    s("h0-r2-30", { elevation: 28, isRamp: true }),
    s("h0-r2-30", { elevation: 34, isRamp: true }),
    s("h0-r2-30", { elevation: 40, isRamp: true }),
    s("h0-r2-30", { elevation: 50, isBridge: true }),
    // Mountain top — bridge + tunnel
    s("h0-g345", { elevation: 50, isBridge: true }),
    s("h0-g345", { elevation: 50, isBridge: true, isTunnel: true }),
    // Ramp down
    s("h0-g345", { elevation: 40, isRamp: true }),
    // Left turn — descending
    s("h0-r2-30", { elevation: 34, isRamp: true }),
    s("h0-r2-30", { elevation: 28, isRamp: true }),
    s("h0-r2-30", { elevation: 22, isRamp: true }),
    s("h0-r2-30", { elevation: 16, isRamp: true }),
    s("h0-r2-30", { elevation: 8, isRamp: true }),
    s("h0-r2-30"),
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
// TT Advanced Templates
// ============================================================

/**
 * Nádraží s 3 kolejemi — TT
 * Hlavní smyčka s dvěma výhybkami na každém konci nádraží.
 * 2 paralelní koleje (perónové) + hlavní průjezdná.
 *
 * Top: ewl(166) + ewl(166) + G4(332) + G4(332) + ewr(166) + ewr(166) = 1328mm
 * Bottom: 4×G4(1328) = 1328mm ✓
 */
const TT_STATION_3_TRACKS: LayoutDefinition = {
  mainLoop: [
    // Station entry — two left turnouts for branching to platform tracks
    s("tt-ewl"),   // index 0: outer platform branch
    s("tt-ewl"),   // index 1: middle platform branch
    // Station straight
    s("tt-g4"),    // 332mm
    s("tt-g4"),    // 332mm
    // Station exit — two right turnouts merging back
    s("tt-ewr"),   // index 4: middle platform merge
    s("tt-ewr"),   // index 5: outer platform merge
    // Right 180° turn
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight — 4×G4 = 1328mm (matches top)
    ...repeat(s("tt-g4"), 4),
    // Left 180° turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Outer platform track from turnout 0
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("tt-g1"),
        s("tt-g4"),
        s("tt-g4"),
        s("tt-g1"),
      ],
    },
    {
      // Middle platform track from turnout 1
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("tt-g4"),
        s("tt-g4"),
      ],
    },
  ],
};

/**
 * Dvoukolejná trať (Double Track) — TT
 * Dva paralelní ováky spojené výhybkami na obou koncích.
 * Vnitřní ovál: R1, vnější ovál: R2 (o 43mm větší poloměr)
 *
 * R1 = 310mm, R2 = 353mm
 * Polokruh R1 (12×15°): koncový bod dx = 2×310 = 620mm (šířka = 2R)
 * Polokruh R2 (12×15°): koncový bod dx = 2×353 = 706mm (šířka = 2R)
 * 
 * Top inner: ewl(166) + G4(332) + G4(332) + G4(332) + ewr(166) = 1328mm
 * Top outer (from ewl-c → R2 curves → ewr-c): via branches
 * Bottom inner: 4×G4 = 1328mm
 */
const TT_DOUBLE_TRACK: LayoutDefinition = {
  mainLoop: [
    // Top straight with turnout entries
    s("tt-ewl"),   // index 0: split to outer track
    s("tt-g4"),    // 332mm
    s("tt-g4"),    // 332mm
    s("tt-g4"),    // 332mm
    s("tt-ewr"),   // index 4: merge from outer track
    // Right 180° turn (inner, R1)
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight
    ...repeat(s("tt-g4"), 4), // 4×332 = 1328mm = top
    // Left 180° turn (inner, R1)
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Outer track — runs parallel, longer straight + wider curves
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("tt-g4"),
        s("tt-g4"),
        s("tt-g4"),
      ],
    },
  ],
};

/**
 * Smyčka s odbočkou do nádraží — TT
 * Hlavní ovál + výhybka vedoucí do stanice s 2 kolejemi (slepá odbočka se smyčkou).
 *
 * Top: G4(332) + ewl(166) + G4(332) + G1(166) = 996mm
 * Bottom: 3×G4(996) = 996mm ✓
 */
const TT_LOOP_WITH_STATION: LayoutDefinition = {
  mainLoop: [
    // Top straight
    s("tt-g4"),    // 332mm
    s("tt-ewl"),   // index 1: branch to station
    s("tt-g4"),    // 332mm
    s("tt-g1"),    // 166mm → total 996mm
    // Right 180° turn
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight — 3×G4 = 996mm
    ...repeat(s("tt-g4"), 3),
    // Left 180° turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Station branch — výhybka do malého nádraží
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("tt-g4"),
        s("tt-g4"),
        s("tt-ewl"), // sub-branch for second platform
        s("tt-g4"),
        s("tt-g1"),
      ],
    },
  ],
};

/**
 * Křížení s protisměrnými smyčkami — TT
 * Ovál s křížením uprostřed a druhým menším oválem procházejícím křížením.
 *
 * Top: G4(332) + DK(166) + G4(332) + G2(83) + G3(41.5) = 954.5mm ← use better combo
 * Simplified: hlavní ovál s křížením jako figure-eight hint
 * 
 * Top: G4(332) + G4(332) + DK(166) + G4(332) = 1162mm
 * Bottom: G4(332) + G4(332) + G1(166) + G4(332) = 1162mm ✓
 */
const TT_CROSSING_LOOPS: LayoutDefinition = {
  mainLoop: [
    s("tt-g4"),    // 332mm
    s("tt-ewl"),   // index 1: turnout for siding (166mm)
    s("tt-dk"),    // crossing (166mm)
    s("tt-g4"),    // 332mm → total 996mm
    // Right 180° turn
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight — must match 996mm
    s("tt-g4"),    // 332mm
    s("tt-g4"),    // 332mm
    s("tt-g4"),    // 332mm = 996mm ✓
    // Left 180° turn
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Siding through crossing area — elevated to pass over main line
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("tt-g4", { elevation: 25, isRamp: true }),
        s("tt-g4", { elevation: 50, isBridge: true }),
      ],
    },
  ],
};

// ============================================================
// H0 Advanced Templates
// ============================================================

/**
 * Nádraží s 3 kolejemi — H0
 *
 * Top: wl15(230) + wl15(230) + G345(345) + G345(345) + wr15(230) + wr15(230) = 1610mm
 * Bottom: G345(345)×4 + G230(230) + G100(100) = 1610mm ✓ (1380+230 = 1610)
 * Actually: 345×4 = 1380, need 1610-1380 = 230 → G230
 * 1380 + 230 = 1610 ✓
 */
const H0_STATION_3_TRACKS: LayoutDefinition = {
  mainLoop: [
    s("h0-wl15"),   // index 0: outer platform branch (230mm)
    s("h0-wl15"),   // index 1: middle platform branch (230mm)
    s("h0-g345"),   // 345mm
    s("h0-g345"),   // 345mm
    s("h0-wr15"),   // index 4: middle merge (230mm)
    s("h0-wr15"),   // index 5: outer merge (230mm)
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight: 4×345 + 230 = 1610mm
    ...repeat(s("h0-g345"), 4),
    s("h0-g230"),
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("h0-g230"),
        s("h0-g345"),
        s("h0-g345"),
        s("h0-g230"),
      ],
    },
    {
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("h0-g345"),
        s("h0-g345"),
      ],
    },
  ],
};

/**
 * Dvoukolejná trať — H0
 *
 * Top inner: wl15(230) + G345(345) + G345(345) + G345(345) + wr15(230) = 1495mm
 * Bottom: G345(345)×4 + G100(100) + G100(100) = 1480+100 = nope
 * Let's match: 345×4 = 1380, need 115 more... use G100+G100=200 → 1580 too much
 * Adjust: wl15(230) + 3×G345(1035) + wr15(230) = 1495mm
 * Bottom: 4×G345 = 1380 + G100(100) + ... hmm
 * Better: wl15(230) + 2×G345(690) + G230(230) + wr15(230) = 1380mm
 * Bottom: 4×G345 = 1380mm ✓
 */
const H0_DOUBLE_TRACK: LayoutDefinition = {
  mainLoop: [
    s("h0-wl15"),   // index 0: split to outer (230mm)
    s("h0-g345"),   // 345mm
    s("h0-g345"),   // 345mm
    s("h0-g230"),   // 230mm
    s("h0-wr15"),   // index 4: merge (230mm)
    // Right 180° turn (inner, R2)
    ...repeat(s("h0-r2-30"), 6),
    // Bottom: 4×345 = 1380mm = top
    ...repeat(s("h0-g345"), 4),
    // Left 180° turn (inner, R2)
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("h0-g345"),
        s("h0-g345"),
        s("h0-g230"),
      ],
    },
  ],
};

/**
 * Smyčka s odbočkou do nádraží — H0
 *
 * Top: G345(345) + wl15(230) + G345(345) = 920mm
 * Bottom: G345(345) + G345(345) + G230(230) = 920mm ✓
 */
const H0_LOOP_WITH_STATION: LayoutDefinition = {
  mainLoop: [
    s("h0-g345"),   // 345mm
    s("h0-wl15"),   // index 1: branch to station (230mm)
    s("h0-g345"),   // 345mm → total 920mm
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom: 345 + 345 + 230 = 920mm
    s("h0-g345"),
    s("h0-g345"),
    s("h0-g230"),
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("h0-g345"),
        s("h0-g345"),
        s("h0-wl15"),
        s("h0-g345"),
      ],
    },
  ],
};

/**
 * Křížení s protisměrnými smyčkami — H0
 *
 * Top: G345(345) + wl15(230) + DK(230) + G345(345) = 1150mm
 * Bottom: G345(345) + G345(345) + G230(230) + G230(230) = 1150mm ✓
 */
const H0_CROSSING_LOOPS: LayoutDefinition = {
  mainLoop: [
    s("h0-g345"),   // 345mm
    s("h0-wl15"),   // index 1: turnout (230mm)
    s("h0-dk"),     // crossing (230mm)
    s("h0-g345"),   // 345mm → total 1150mm
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom: 345+345+230+230 = 1150mm ✓
    s("h0-g345"),
    s("h0-g345"),
    s("h0-g230"),
    s("h0-g230"),
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      // Elevated siding passing over the crossing
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [
        s("h0-g345", { elevation: 25, isRamp: true }),
        s("h0-g345", { elevation: 50, isBridge: true }),
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
  {
    id: "station-3-tracks",
    name: "Station with 3 Tracks",
    nameCs: "Nádraží se 3 kolejemi",
    description: "Oval with a station featuring 3 parallel platform tracks",
    descriptionCs: "Ovál s nádražím — 3 paralelní koleje s perony",
    layouts: {
      TT: TT_STATION_3_TRACKS,
      H0: H0_STATION_3_TRACKS,
    },
  },
  {
    id: "double-track",
    name: "Double Track",
    nameCs: "Dvoukolejná trať",
    description: "Two parallel tracks with turnout connections for realistic main line",
    descriptionCs: "Dvoukolejná hlavní trať — vnitřní a vnější ovál propojené výhybkami",
    layouts: {
      TT: TT_DOUBLE_TRACK,
      H0: H0_DOUBLE_TRACK,
    },
  },
  {
    id: "loop-with-station",
    name: "Loop with Station Branch",
    nameCs: "Smyčka s odbočkou do stanice",
    description: "Main loop with a branch leading to a small station",
    descriptionCs: "Hlavní smyčka s výhybkou vedoucí do malého nádraží",
    layouts: {
      TT: TT_LOOP_WITH_STATION,
      H0: H0_LOOP_WITH_STATION,
    },
  },
  {
    id: "crossing-loops",
    name: "Crossing with Loops",
    nameCs: "Křížení se smyčkami",
    description: "Oval with crossing and siding through the crossing area",
    descriptionCs: "Ovál s křížením a výhybnou procházející křižovatkou",
    layouts: {
      TT: TT_CROSSING_LOOPS,
      H0: H0_CROSSING_LOOPS,
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
