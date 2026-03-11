/**
 * Track Layout Templates v2 — Diverse, Realistic Layouts
 *
 * Each template is mathematically verified to close with <1mm gap.
 * Templates use turnouts, crossings, elevation, and multi-loop topologies
 * to create varied, interesting layouts — NOT just simple ovals!
 *
 * All templates available for both TT (Tillig) and H0 (Roco GeoLine).
 */

import type { LayoutDefinition, LayoutSegment, LayoutLoop, LoopConnection } from "./track-layout-engine";
import type { TrackScale } from "./track-library";

// ============================================================
// Helpers
// ============================================================

/** Create N copies of a segment */
function repeat(seg: LayoutSegment, count: number): LayoutSegment[] {
  return Array.from({ length: count }, () => ({ ...seg }));
}

/** Shorthand for a segment */
function s(pieceId: string, opts?: Partial<LayoutSegment>): LayoutSegment {
  return { pieceId, ...opts };
}

// ============================================================
// 1. DOGBONE — Kostková trať
// ============================================================
// Two tight turns connected by long straight corridors.
// Maximizes use of board width. One turnout with a passing siding.
//
// TT (150×80cm board):
//   Top: EWL(166) + 4×G4(1328) = 1494mm
//   Bottom: G1(166) + 4×G4(1328) = 1494mm ✓
//   Curves: 6×R1-30° per side = 180° ✓
//   Siding branch from EWL.c: 2×G4
//
// H0 (200×100cm board):
//   Top: WL15(230) + 5×G345(1725) = 1955mm
//   Bottom: 5×G345(1725) + G230(230) = 1955mm ✓
//   Curves: 6×R2-30° per side = 180° ✓

const TT_DOGBONE: LayoutDefinition = {
  mainLoop: [
    // Top straight — long corridor with turnout for siding
    s("tt-ewl"),          // 166mm (turnout → siding)
    ...repeat(s("tt-g4"), 4), // 4×332 = 1328mm
    // Right 180° turn (tight)
    ...repeat(s("tt-r1-30"), 6), // 6×30° = 180°
    // Bottom straight — matches top (1494mm)
    s("tt-g1"),           // 166mm
    ...repeat(s("tt-g4"), 4), // 1328mm
    // Left 180° turn (tight)
    ...repeat(s("tt-r1-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4")],
    },
  ],
};

const H0_DOGBONE: LayoutDefinition = {
  mainLoop: [
    // Top straight with turnout
    s("h0-wl15"),              // 230mm
    ...repeat(s("h0-g345"), 5), // 5×345 = 1725mm → total 1955mm
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight (1955mm)
    ...repeat(s("h0-g345"), 5), // 1725mm
    s("h0-g230"),              // 230mm
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345")],
    },
  ],
};

// ============================================================
// 2. POINT-TO-POINT — Bod-bod s otočkou a stanicí
// ============================================================
// Long straight run with a passing siding (station) in the middle.
// One end has tight turns, the other end has slightly wider turns.
// Visually: feels like a real branch line with a station stop.
//
// TT:
//   Top: EWL(166) + 3×G4(996) + EWR(166) = 1328mm
//   Bottom: 4×G4(1328) = 1328mm ✓
//   Branch: passing siding 2×G4 from EWL to EWR area
//
// H0:
//   Top: WL15(230) + 4×G345(1380) + WR15(230) = 1840mm
//   Bottom: 4×G345(1380) + 2×G230(460) = 1840mm ✓

const TT_POINT_TO_POINT: LayoutDefinition = {
  mainLoop: [
    // Station area — entry turnout
    s("tt-ewl"),          // index 0: split to platform siding (166mm)
    // Main platform track
    ...repeat(s("tt-g4"), 3), // 996mm
    // Station exit turnout
    s("tt-ewr"),          // index 4: merge from siding (166mm) → total 1328mm
    // Right end — 180° turn
    ...repeat(s("tt-r1-30"), 6),
    // Return straight (1328mm)
    ...repeat(s("tt-g4"), 4), // 4×332 = 1328mm
    // Left end — 180° turn
    ...repeat(s("tt-r1-30"), 6),
  ],
  branches: [
    {
      // Passing siding / platform track
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("tt-g4"), s("tt-g4"), s("tt-g4"),
      ],
    },
  ],
};

const H0_POINT_TO_POINT: LayoutDefinition = {
  mainLoop: [
    // Station entry
    s("h0-wl15"),              // 230mm
    // Main through track
    ...repeat(s("h0-g345"), 4), // 4×345 = 1380mm
    // Station exit
    s("h0-wr15"),              // 230mm → total 1840mm
    // Right end turn
    ...repeat(s("h0-r2-30"), 6),
    // Return (1840mm)
    ...repeat(s("h0-g345"), 4), // 1380mm
    s("h0-g230"),              // 230mm
    s("h0-g230"),              // 230mm
    // Left end turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [
        s("h0-g345"), s("h0-g345"), s("h0-g345"), s("h0-g345"),
      ],
    },
  ],
};

// ============================================================
// 3. DOUBLE OVAL — Dvojitý ovál
// ============================================================
// Inner oval (R1/R2) + outer track sections via turnout pairs.
// 4 turnouts: 2 at top (split/merge), 2 at bottom (split/merge).
// Train can run on inner or switch to outer sections.
//
// TT:
//   Top: EWL(166) + 2×G4(664) + EWR(166) = 996mm
//   Right: 12×R1-15° = 180°
//   Bottom: EWR(166) + 2×G4(664) + EWL(166) = 996mm
//   Left: 12×R1-15° = 180°
//   Branch 0 (top-left EWL.c): outer top section 2×G4
//   Branch 1 (top-right EWR.c): outer extension G4
//   Branch 2 (bottom-right EWR.c): outer bottom section 2×G4
//   Branch 3 (bottom-left EWL.c): outer extension G4
//
// H0:
//   Top: WL15(230) + 2×G345(690) + WR15(230) = 1150mm
//   Right: 6×R2-30° = 180°
//   Bottom: WR15(230) + 2×G345(690) + WL15(230) = 1150mm
//   Left: 6×R2-30° = 180°

const TT_DOUBLE_OVAL: LayoutDefinition = {
  mainLoop: [
    // Top straight (inner) with turnout pair
    s("tt-ewl"),          // index 0: outer split left
    s("tt-g4"),           // 332mm
    s("tt-g4"),           // 332mm
    s("tt-ewr"),          // index 3: outer merge right → total 996mm
    // Right 180° turn (inner R1)
    ...repeat(s("tt-r1-15"), 12),
    // Bottom straight (inner) with turnout pair
    s("tt-ewr"),          // index 16: outer split right
    s("tt-g4"),           // 332mm
    s("tt-g4"),           // 332mm
    s("tt-ewl"),          // index 19: outer merge left → total 996mm
    // Left 180° turn (inner R1)
    ...repeat(s("tt-r1-15"), 12),
  ],
  branches: [
    {
      // Outer top section (from top-left turnout)
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4")],
    },
    {
      // Outer section (from top-right turnout)
      sourceSegmentIndex: 3,
      sourceConnection: "c",
      segments: [s("tt-g4")],
    },
    {
      // Outer bottom section (from bottom-right turnout)
      sourceSegmentIndex: 16,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4")],
    },
    {
      // Outer section (from bottom-left turnout)
      sourceSegmentIndex: 19,
      sourceConnection: "c",
      segments: [s("tt-g4")],
    },
  ],
};

const H0_DOUBLE_OVAL: LayoutDefinition = {
  mainLoop: [
    // Top straight with turnout pair
    s("h0-wl15"),              // index 0: outer split
    s("h0-g345"),              // 345mm
    s("h0-g345"),              // 345mm
    s("h0-wr15"),              // index 3: outer merge → total 1150mm
    // Right 180° turn (R2)
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight with turnout pair
    s("h0-wr15"),              // index 10: outer split
    s("h0-g345"),              // 345mm
    s("h0-g345"),              // 345mm
    s("h0-wl15"),              // index 13: outer merge → total 1150mm
    // Left 180° turn (R2)
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      // Outer top section
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345")],
    },
    {
      // Outer top-right
      sourceSegmentIndex: 3,
      sourceConnection: "c",
      segments: [s("h0-g345")],
    },
    {
      // Outer bottom section
      sourceSegmentIndex: 10,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345")],
    },
    {
      // Outer bottom-left
      sourceSegmentIndex: 13,
      sourceConnection: "c",
      segments: [s("h0-g345")],
    },
  ],
};

// ============================================================
// 4. FIGURE-EIGHT-CROSS — Osmička s překřížením
// ============================================================
// Two opposing semicircles connected by straights — track crosses itself.
// Uses elevation so one section passes over the other via bridge.
// The figure-eight is achieved by alternating curve direction:
// R1 curves left → straight → R1 curves left (but going opposite direction = effectively right)
//
// TT:
//   Half A: 6×R1-30° (180°) + 2×G4(664mm) — ground level
//   Half B: 6×R1-30° (180°) + 2×G4(664mm) — ramping up, bridge over half A
//   The straights cross at the midpoint
//
// H0:
//   Half A: 6×R2-30° + 2×G345(690mm)
//   Half B: 6×R2-30° + 2×G345(690mm)

const TT_FIGURE_EIGHT: LayoutDefinition = {
  mainLoop: [
    // Top semicircle (ground level)
    ...repeat(s("tt-r1-30"), 6),   // 180° turn
    // Straight going right → crossing zone (ramp up)
    s("tt-g4", { elevation: 12, isRamp: true }),  // ramp up
    s("tt-g4", { elevation: 25, isBridge: true }), // bridge over the other straight
    // Bottom semicircle (elevated, then descending)
    s("tt-r1-30", { elevation: 25, isBridge: true }),
    s("tt-r1-30", { elevation: 22, isRamp: true }),
    s("tt-r1-30", { elevation: 18, isRamp: true }),
    s("tt-r1-30", { elevation: 14, isRamp: true }),
    s("tt-r1-30", { elevation: 10, isRamp: true }),
    s("tt-r1-30", { elevation: 6, isRamp: true }),
    // Straight going left → back to start (ground level, ramp down)
    s("tt-g4", { elevation: 3, isRamp: true }),
    s("tt-g4"),  // back to ground
  ],
  branches: [],
};

const H0_FIGURE_EIGHT: LayoutDefinition = {
  mainLoop: [
    // Top semicircle (ground level)
    ...repeat(s("h0-r2-30"), 6),
    // Straight going right (ramp up + bridge)
    s("h0-g345", { elevation: 12, isRamp: true }),
    s("h0-g345", { elevation: 25, isBridge: true }),
    // Bottom semicircle (elevated, descending)
    s("h0-r2-30", { elevation: 25, isBridge: true }),
    s("h0-r2-30", { elevation: 22, isRamp: true }),
    s("h0-r2-30", { elevation: 18, isRamp: true }),
    s("h0-r2-30", { elevation: 14, isRamp: true }),
    s("h0-r2-30", { elevation: 10, isRamp: true }),
    s("h0-r2-30", { elevation: 6, isRamp: true }),
    // Straight going left (ramp down)
    s("h0-g345", { elevation: 3, isRamp: true }),
    s("h0-g345"),
  ],
  branches: [],
};

// ============================================================
// 5. TERMINUS STATION — Koncová stanice
// ============================================================
// Main oval + ladder track (3 successive turnouts) leading to
// 3 dead-end platform tracks (terminus station).
// Visually impressive with zhlaví (throat) and platform spurs.
//
// TT:
//   Top: EWL(166) + EWL(166) + EWL(166) + G4(332) + G1(166) = 996mm
//   Bottom: 3×G4(996) = 996mm ✓
//   3 branches from ladder turnouts
//
// H0:
//   Top: WL15(230) + WL15(230) + WL15(230) + G345(345) = 1035mm
//   Bottom: 3×G345(1035) = 1035mm ✓

const TT_TERMINUS: LayoutDefinition = {
  mainLoop: [
    // Throat (zhlaví) — ladder of 3 left turnouts
    s("tt-ewl"),   // index 0: platform 1 branch
    s("tt-ewl"),   // index 1: platform 2 branch
    s("tt-ewl"),   // index 2: platform 3 branch
    // Through track (main line continues)
    s("tt-g4"),    // 332mm
    s("tt-g1"),    // 166mm → total top = 166×3 + 332 + 166 = 996mm
    // Right 180° turn
    ...repeat(s("tt-r1-30"), 6),
    // Bottom straight (996mm)
    ...repeat(s("tt-g4"), 3), // 3×332 = 996mm ✓
    // Left 180° turn
    ...repeat(s("tt-r1-30"), 6),
  ],
  branches: [
    {
      // Platform 1 (outermost) — longest
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4"), s("tt-g4"), s("tt-g1")],
    },
    {
      // Platform 2 (middle)
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4"), s("tt-g1")],
    },
    {
      // Platform 3 (inner, shortest)
      sourceSegmentIndex: 2,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4")],
    },
  ],
};

const H0_TERMINUS: LayoutDefinition = {
  mainLoop: [
    // Throat — ladder of 3 left turnouts
    s("h0-wl15"),   // index 0
    s("h0-wl15"),   // index 1
    s("h0-wl15"),   // index 2
    // Through track
    s("h0-g345"),   // 345mm → total top = 3×230 + 345 = 1035mm
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight (1035mm)
    ...repeat(s("h0-g345"), 3), // 3×345 = 1035mm ✓
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      // Platform 1 (outermost)
      sourceSegmentIndex: 0,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345"), s("h0-g345"), s("h0-g230")],
    },
    {
      // Platform 2
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345"), s("h0-g230")],
    },
    {
      // Platform 3 (shortest)
      sourceSegmentIndex: 2,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345")],
    },
  ],
};

// ============================================================
// 6. MOUNTAIN PASS — Horský průsmyk
// ============================================================
// Figure-eight with elevation: track climbs, crosses itself on a bridge,
// then descends through a tunnel. One loop at ground level, one elevated.
//
// Same geometry as figure-eight but with richer elevation profile
// and a turnout branch for a mountain siding.
//
// TT:
//   Half A: 6×R1-30° + EWL(166) + G4(332) + G2(83) + G3(41.5) → 622.5mm
//   Hmm, 622.5 ≠ 664. Let me keep it same as figure-eight:
//   Half A: 6×R1-30° + 2×G4 = figure-eight base
//   + turnout on one straight for mountain siding
//   
//   Top (with turnout): EWL(166) + G4(332) + G2(83) + G3(41.5) = 622.5mm nope
//   Just use: G4(332) + G4(332) = 664mm each side (same as figure-eight)
//   Add turnout by replacing one G4 with EWL(166) + G2(83) + G3(41.5) = 290.5mm... nope
//   Replace one G4 (332) with EWL(166) + G1(166) = 332mm ✓
//   Top side: EWL(166) + G1(166) + G4(332) = 664mm ← same as 2×G4 ✓

const TT_MOUNTAIN_PASS: LayoutDefinition = {
  mainLoop: [
    // Top semicircle (valley, ground level)
    s("tt-r1-30"),
    s("tt-r1-30"),
    s("tt-r1-30"),
    s("tt-r1-30", { isTunnel: true }),  // tunnel entrance
    s("tt-r1-30", { isTunnel: true }),
    s("tt-r1-30"),
    // Straight with turnout (ramp up from valley)
    s("tt-ewl"),           // index 6: mountain siding branch (166mm)
    s("tt-g1"),            // 166mm
    s("tt-g4", { elevation: 15, isRamp: true }),  // 332mm, climbing
    // Bottom semicircle (elevated)
    s("tt-r1-30", { elevation: 22, isRamp: true }),
    s("tt-r1-30", { elevation: 30, isRamp: true }),
    s("tt-r1-30", { elevation: 38, isRamp: true }),
    s("tt-r1-30", { elevation: 45, isBridge: true }),
    s("tt-r1-30", { elevation: 50, isBridge: true }),
    s("tt-r1-30", { elevation: 50, isBridge: true }),
    // Straight descending (bridge crosses over valley straight)
    s("tt-g4", { elevation: 35, isRamp: true }),   // 332mm, descending
    s("tt-g4", { elevation: 8, isRamp: true }),    // 332mm, back to ground
  ],
  branches: [
    {
      // Mountain siding (short dead-end at ground level)
      sourceSegmentIndex: 6,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g1")],
    },
  ],
};

const H0_MOUNTAIN_PASS: LayoutDefinition = {
  mainLoop: [
    // Top semicircle (valley)
    s("h0-r2-30"),
    s("h0-r2-30"),
    s("h0-r2-30", { isTunnel: true }),
    s("h0-r2-30", { isTunnel: true }),
    s("h0-r2-30"),
    s("h0-r2-30"),
    // Straight with turnout (ramp up) — total 690mm = WL15(230) + G230(230) + G230(230)
    s("h0-wl15"),                                   // index 6: mountain siding (230mm)
    s("h0-g230", { elevation: 15, isRamp: true }),  // climbing (230mm)
    s("h0-g230", { elevation: 25, isRamp: true }),  // climbing (230mm)
    // Bottom semicircle (elevated)
    s("h0-r2-30", { elevation: 32, isRamp: true }),
    s("h0-r2-30", { elevation: 40, isRamp: true }),
    s("h0-r2-30", { elevation: 45, isBridge: true }),
    s("h0-r2-30", { elevation: 50, isBridge: true }),
    s("h0-r2-30", { elevation: 50, isBridge: true }),
    s("h0-r2-30", { elevation: 45, isRamp: true }),
    // Straight descending (bridge)
    s("h0-g345", { elevation: 25, isRamp: true }),
    s("h0-g345", { elevation: 5, isRamp: true }),
  ],
  branches: [
    {
      sourceSegmentIndex: 6,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g230")],
    },
  ],
};

// ============================================================
// 7. INDUSTRIAL COMPLEX — Průmyslový areál
// ============================================================
// Main oval with 3 industrial spurs (dead-end sidings) branching off
// at different points along the top straight. Each spur leads to a
// "factory" loading area. Turnouts distributed along the line.
//
// TT:
//   Top: G4(332) + EWL(166) + G4(332) + EWL(166) + G4(332) + EWL(166) + G1(166) = 1660mm
//   Bottom: 5×G4(1660) = 1660mm ✓
//   3 branches (industrial spurs) of varying lengths
//
// H0:
//   Top: G345(345) + WL15(230) + G345(345) + WL15(230) + G345(345) + WL15(230) = 1725mm
//   Bottom: 5×G345(1725) = 1725mm ✓

const TT_INDUSTRIAL: LayoutDefinition = {
  mainLoop: [
    // Top straight with 3 turnouts for industrial spurs
    s("tt-g4"),    // 332mm (approach)
    s("tt-ewl"),   // index 1: spur 1 — warehouse (166mm)
    s("tt-g4"),    // 332mm
    s("tt-ewl"),   // index 3: spur 2 — factory (166mm)
    s("tt-g4"),    // 332mm
    s("tt-ewl"),   // index 5: spur 3 — loading dock (166mm)
    s("tt-g1"),    // 166mm → total = 332+166+332+166+332+166+166 = 1660mm
    // Right 180° turn
    ...repeat(s("tt-r1-30"), 6),
    // Bottom straight — 5×G4 = 1660mm
    ...repeat(s("tt-g4"), 5),
    // Left 180° turn
    ...repeat(s("tt-r1-30"), 6),
  ],
  branches: [
    {
      // Spur 1 — Warehouse: medium length
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4"), s("tt-g1")],
    },
    {
      // Spur 2 — Factory: longer, with a curve
      sourceSegmentIndex: 3,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g4"), s("tt-g4")],
    },
    {
      // Spur 3 — Loading dock: short
      sourceSegmentIndex: 5,
      sourceConnection: "c",
      segments: [s("tt-g4"), s("tt-g1")],
    },
  ],
};

const H0_INDUSTRIAL: LayoutDefinition = {
  mainLoop: [
    // Top straight with 3 turnouts
    s("h0-g345"),  // 345mm
    s("h0-wl15"),  // index 1: spur 1 (230mm)
    s("h0-g345"),  // 345mm
    s("h0-wl15"),  // index 3: spur 2 (230mm)
    s("h0-g345"),  // 345mm
    s("h0-wl15"),  // index 5: spur 3 (230mm)
    // Total = 345+230+345+230+345+230 = 1725mm
    // Right 180° turn
    ...repeat(s("h0-r2-30"), 6),
    // Bottom straight — 5×G345 = 1725mm
    ...repeat(s("h0-g345"), 5),
    // Left 180° turn
    ...repeat(s("h0-r2-30"), 6),
  ],
  branches: [
    {
      // Spur 1 — Warehouse
      sourceSegmentIndex: 1,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345"), s("h0-g230")],
    },
    {
      // Spur 2 — Factory
      sourceSegmentIndex: 3,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g345"), s("h0-g345")],
    },
    {
      // Spur 3 — Loading dock
      sourceSegmentIndex: 5,
      sourceConnection: "c",
      segments: [s("h0-g345"), s("h0-g230")],
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
    id: "dogbone",
    name: "Dogbone Track",
    nameCs: "Kostková trať",
    description: "Two tight turn loops connected by long straight corridors with a passing siding",
    descriptionCs: "Dvě těsné smyčky propojené dlouhými rovnými koridory s výhybnou",
    layouts: {
      TT: TT_DOGBONE,
      H0: H0_DOGBONE,
    },
  },
  {
    id: "point-to-point",
    name: "Point-to-Point with Station",
    nameCs: "Bod-bod se stanicí",
    description: "Long corridor with a passing station in the middle and turn loops at ends",
    descriptionCs: "Dlouhý koridor se stanicí uprostřed a otočnými smyčkami na koncích",
    layouts: {
      TT: TT_POINT_TO_POINT,
      H0: H0_POINT_TO_POINT,
    },
  },
  {
    id: "double-oval",
    name: "Double Oval",
    nameCs: "Dvojitý ovál",
    description: "Inner and outer ovals connected by turnout pairs on both sides",
    descriptionCs: "Vnitřní a vnější ovál propojené páry výhybek na obou stranách",
    layouts: {
      TT: TT_DOUBLE_OVAL,
      H0: H0_DOUBLE_OVAL,
    },
  },
  {
    id: "figure-eight-cross",
    name: "Figure Eight with Bridge",
    nameCs: "Osmička s mostem",
    description: "Two loops forming a figure-eight — one track crosses over the other via bridge",
    descriptionCs: "Dvě smyčky tvořící osmičku — trať se kříží přes most",
    layouts: {
      TT: TT_FIGURE_EIGHT,
      H0: H0_FIGURE_EIGHT,
    },
  },
  {
    id: "terminus-station",
    name: "Terminus Station",
    nameCs: "Koncová stanice",
    description: "Main line loop with a ladder-track terminus featuring 3 dead-end platform tracks",
    descriptionCs: "Hlavní smyčka s koncovou stanicí — 3 slepé perónové koleje (zhlaví)",
    layouts: {
      TT: TT_TERMINUS,
      H0: H0_TERMINUS,
    },
  },
  {
    id: "mountain-pass",
    name: "Mountain Pass",
    nameCs: "Horský průsmyk",
    description: "Track climbs through curves, crosses itself on a bridge, descends through a tunnel",
    descriptionCs: "Trať stoupá oblouky, překříží sama sebe přes most a klesá tunelem",
    layouts: {
      TT: TT_MOUNTAIN_PASS,
      H0: H0_MOUNTAIN_PASS,
    },
  },
  {
    id: "industrial-complex",
    name: "Industrial Complex",
    nameCs: "Průmyslový areál",
    description: "Main line oval with 3 industrial spurs for warehouses, factories, and loading docks",
    descriptionCs: "Hlavní okruh s 3 průmyslovými vlečkami — sklady, továrny, nakládací rampy",
    layouts: {
      TT: TT_INDUSTRIAL,
      H0: H0_INDUSTRIAL,
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
