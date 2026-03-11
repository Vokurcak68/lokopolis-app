import { NextRequest, NextResponse } from "next/server";
import {
  computeLayout,
  parseAILayoutResponse,
  layoutResultToAPIResponse,
  type LayoutDefinition,
} from "@/lib/track-layout-engine";
import { getTemplateLayout, TEMPLATES } from "@/lib/track-templates";
import { getCatalogByScale, type TrackScale } from "@/lib/track-library";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * 3D Track Generator API — Deterministic Layout Engine
 *
 * AI generates ONLY topology (sequence of piece IDs + branching).
 * The layout engine computes exact positions from catalog geometry.
 *
 * No more coordinate guessing by AI!
 */

// ============================================================
// Catalog descriptions for AI prompt
// ============================================================

function buildCatalogDescription(scale: TrackScale): string {
  const catalog = getCatalogByScale(scale);
  const lines: string[] = [];

  const straights = catalog.filter((p) => p.type === "straight");
  const curves = catalog.filter((p) => p.type === "curve");
  const turnouts = catalog.filter((p) => p.type === "turnout");
  const crossings = catalog.filter((p) => p.type === "crossing");

  lines.push(`STRAIGHT TRACKS:`);
  for (const p of straights) {
    lines.push(`  - ${p.id}: ${p.length}mm`);
  }

  lines.push(`\nCURVES (all bend left in local space):`);
  for (const p of curves) {
    lines.push(`  - ${p.id}: R${p.radius}mm, ${p.angle}°`);
  }

  lines.push(`\nTURNOUTS (main line goes A→B straight, branch goes A→C diverge):`);
  for (const p of turnouts) {
    lines.push(`  - ${p.id}: ${p.direction} turnout, ${p.length}mm main, ${p.angle}° diverge, R${p.radius}`);
  }

  if (crossings.length > 0) {
    lines.push(`\nCROSSINGS:`);
    for (const p of crossings) {
      lines.push(`  - ${p.id}: ${p.length}mm, ${p.angle}°`);
    }
  }

  return lines.join("\n");
}

// ============================================================
// AI System Prompt
// ============================================================

function buildSystemPrompt(scale: TrackScale, boardWidth: number, boardDepth: number): string {
  const catalogDesc = buildCatalogDescription(scale);
  const isTT = scale === "TT";

  // Piece length cheat-sheet
  const pieceLengths = isTT
    ? `G1=166mm, G2=83mm, G3=41.5mm, G4=332mm, G5=228mm, G6=55mm, EWL/EWR=166mm, DK=166mm`
    : `G230=230mm, G200=200mm, G100=100mm, G345=345mm, WL15/WR15=230mm, DK=230mm`;

  const curveFormula = isTT
    ? `R1-15° ×12 = 180° (half-circle), R1-30° ×6 = 180°, R2/R3/R4 same angles but wider radius`
    : `R2-30° ×6 = 180° (half-circle), R3-30° ×6 = 180°, R4-30° ×6 = 180°`;

  return `You are an expert model railway layout designer. You design TOPOLOGY — the layout engine computes geometry.

## TRACK CATALOG (${scale})
${catalogDesc}

## PIECE LENGTHS
${pieceLengths}

## CURVE MATH
${curveFormula}
All curves bend LEFT in local space. For right-bending, the engine handles track direction.

## TOPOLOGY FORMAT
You output a JSON graph:
- "mainLoop": ordered array of pieces forming ONE closed loop (the train's main route)
- "branches": side tracks branching from turnouts in mainLoop

Each mainLoop segment: {"pieceId": "ID"} or {"pieceId": "ID", "isTunnel": true}
Each branch: {"sourceSegmentIndex": N, "sourceConnection": "c", "segments": [...]}

## DESIGN PRINCIPLES
1. **CLOSED LOOP is mandatory** — both straight sides of an oval MUST have equal total mm length
2. **Turnouts** have 3 connections: A(entry), B(straight through), C(diverge at angle)
   - In mainLoop the main line goes A→B (straight). Branch starts a separate "branches" entry from C.
   - Left turnout: C diverges left. Right turnout: C diverges right.
   - To make a passing siding: use LEFT turnout at entry, RIGHT turnout at exit, branch between their C ports.
3. **Crossings** have 4 connections: A↔B (straight through), C↔D (crossing angle).
   - Only A→B is used in mainLoop sequence. C and D are for crossing tracks.
4. **Parallel tracks (double track)**: inner oval R1/R2, outer oval R2/R3 or wider. Connect via turnouts.
5. **Station layout**: multiple turnouts in sequence, each branching to a parallel platform track.

## STRICT RULES
- Use ONLY piece IDs from the catalog above
- BOTH straight sections of an oval MUST have IDENTICAL total length in mm
- When inserting a turnout (${isTT ? "166mm" : "230mm"}) into a straight section, adjust other pieces so total length stays the same
- Branches are dead-end spurs unless they reconnect (currently branches don't loop back)
- Maximize use of board space: ${boardWidth}×${boardDepth}cm = ${boardWidth * 10}×${boardDepth * 10}mm
- For stations: use ewl/ewr (TT) or wl15/wr15 (H0) pairs — left at entry, right at exit
- Design creative, unique layouts — not just simple ovals!

## BOARD: ${boardWidth}×${boardDepth}cm (${boardWidth * 10}×${boardDepth * 10}mm)

## OUTPUT — return ONLY this JSON:
{
  "mainLoop": [{"pieceId": "..."}, ...],
  "branches": [{"sourceSegmentIndex": 0, "sourceConnection": "c", "segments": [...]}],
  "description": "Krátký popis česky"
}`;
}

// ============================================================
// Request types
// ============================================================

interface RequestBody {
  scale: string;
  boardWidth: number;
  boardDepth: number;
  boardShape?: "rectangle" | "l-shape" | "u-shape";
  lCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  lArmWidth?: number;
  lArmDepth?: number;
  uArmDepth?: number;
  character?: string;
  complexity?: "simple" | "medium" | "complex";
  features?: string[];
  additionalPrompt?: string;
  /** Use a predefined template instead of AI */
  templateId?: string;
  /** Legacy support */
  prompt?: string;
}

const CHARACTER_LABELS: Record<string, string> = {
  mountain: "Horská trať — jednokolejka, tunely, stoupání, úzké údolí",
  corridor: "Hlavní koridor — dvoukolejná trať, rychlé vlaky, dlouhé rovné úseky",
  station: "Stanice + vlečky — nádraží s více kolejemi, vlečky, posun",
  diorama: "Malá dioráma — kompaktní scéna, jednoduchý ovál, málo výhybek",
  "through-station": "Průjezdná stanice — ovál s výhybnou stanicí uprostřed",
  industrial: "Průmyslová vlečka — vlečky k rampám, posunování, kusé koleje",
};

const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Jednoduchá — základní ovál, pár výhybek",
  medium: "Střední — nádraží, vlečky, výhybny",
  complex: "Složitá — křížení v úrovních, mosty, tunely, více různých tras",
};

const FEATURE_LABELS: Record<string, string> = {
  bridge: "mosty / trať ve výšce",
  tunnel: "tunely",
  turntable: "točna",
  station: "nádraží (více kolejí vedle sebe)",
  sidings: "odstavné koleje",
  parallel: "souběžné tratě",
};

function buildPromptFromForm(body: RequestBody): string {
  const parts: string[] = [];

  if (body.boardShape === "l-shape") {
    const cornerLabel: Record<string, string> = {
      "top-left": "levý horní",
      "top-right": "pravý horní",
      "bottom-left": "levý dolní",
      "bottom-right": "pravý dolní",
    };
    parts.push(
      `Tvar desky: L-tvar, roh ${cornerLabel[body.lCorner || "top-right"]}, šířka ramene ${body.lArmWidth || 60} cm, hloubka ramene ${body.lArmDepth || 40} cm.`
    );
  } else if (body.boardShape === "u-shape") {
    parts.push(`Tvar desky: U-tvar, hloubka ramen ${body.uArmDepth || 40} cm.`);
  } else {
    parts.push("Tvar desky: obdélník.");
  }

  if (body.character && CHARACTER_LABELS[body.character]) {
    parts.push(`Charakter: ${CHARACTER_LABELS[body.character]}.`);
  }

  if (body.complexity && COMPLEXITY_LABELS[body.complexity]) {
    parts.push(`Složitost: ${COMPLEXITY_LABELS[body.complexity]}.`);
  }

  if (body.features && body.features.length > 0) {
    const labels = body.features.map((f) => FEATURE_LABELS[f]).filter(Boolean);
    if (labels.length > 0) {
      parts.push(`Speciální prvky: ${labels.join(", ")}.`);
    }
  }

  if (body.additionalPrompt && body.additionalPrompt.trim()) {
    parts.push(`Další požadavky: ${body.additionalPrompt.trim()}`);
  }

  return parts.join("\n");
}

// ============================================================
// Fallback template selection
// ============================================================

/**
 * Přímé mapování charakter → šablona.
 * Každý charakter má jednoznačně přiřazenou šablonu.
 */
function selectFallbackTemplate(
  scale: TrackScale,
  character?: string,
  complexity?: string,
  features?: string[],
): LayoutDefinition {
  // Přímé mapování charakter → template ID
  const charMap: Record<string, string> = {
    station: "station-3-tracks",
    mountain: "mountain-loop",
    corridor: "double-track",
    industrial: "industrial-spur",
    diorama: "simple-oval",
    "through-station": "loop-with-station",
  };

  let templateId = "simple-oval";

  if (character && charMap[character]) {
    templateId = charMap[character];
  } else if (complexity === "complex") {
    templateId = "station-3-tracks";
  } else if (complexity === "medium") {
    templateId = "crossing-loops";
  }

  // Feature overrides — pouze pokud nebylo mapováno z charakteru
  if (!character || !charMap[character]) {
    if (features?.includes("tunnel")) {
      templateId = "mountain-loop";
    }
    if (features?.includes("sidings") || features?.includes("station")) {
      templateId = "station-3-tracks";
    }
    if (features?.includes("parallel")) {
      templateId = "double-track";
    }
  }

  const layout = getTemplateLayout(templateId, scale);
  return layout || getTemplateLayout("simple-oval", scale)!;
}

// ============================================================
// API Handler
// ============================================================

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }

  const { scale: scaleRaw, boardWidth, boardDepth } = body;

  if (!scaleRaw || !boardWidth || !boardDepth) {
    return NextResponse.json(
      { error: "Chybí povinné parametry (scale, boardWidth, boardDepth)" },
      { status: 400 },
    );
  }

  const scale = scaleRaw as TrackScale;

  // For L/U shapes: center tracks on the MAIN rectangle only.
  // The arm(s) provide extra space but templates are designed for rectangular boards.
  // Using the main rectangle dimensions ensures tracks stay centered on the
  // visible main area, not offset into the bounding box center.
  const effectiveWidth = boardWidth;
  const effectiveDepth = boardDepth;

  // --- Option 1: Use a predefined template ---
  if (body.templateId) {
    const templateLayout = getTemplateLayout(body.templateId, scale);
    if (!templateLayout) {
      return NextResponse.json(
        { error: `Šablona "${body.templateId}" není dostupná pro měřítko ${scale}` },
        { status: 400 },
      );
    }

    const result = computeLayout(templateLayout, scale, effectiveWidth, effectiveDepth);
    return NextResponse.json({
      tracks: layoutResultToAPIResponse(result),
      description: TEMPLATES.find((t) => t.id === body.templateId)?.descriptionCs,
      loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
      loopGapMm: result.loopGapMm,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      source: "template",
    });
  }

  // --- Option 2: No prompt → return simple oval ---
  const prompt = body.character ? buildPromptFromForm(body) : (body.prompt || "");

  if (!prompt || prompt.trim() === "") {
    const layout = getTemplateLayout("simple-oval", scale)!;
    const result = computeLayout(layout, scale, effectiveWidth, effectiveDepth);
    return NextResponse.json({
      tracks: layoutResultToAPIResponse(result),
      description: "Jednoduchý ovál",
      loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
      loopGapMm: result.loopGapMm,
      source: "template",
    });
  }

  // --- Option 3: AI-generated topology ---
  if (!OPENAI_API_KEY) {
    // No API key → use fallback template based on character/complexity
    const fallbackLayout = selectFallbackTemplate(scale, body.character, body.complexity, body.features);
    const result = computeLayout(fallbackLayout, scale, effectiveWidth, effectiveDepth);
    return NextResponse.json({
      tracks: layoutResultToAPIResponse(result),
      description: "Kolejiště vygenerované ze šablony (AI klíč není nakonfigurován)",
      loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
      loopGapMm: result.loopGapMm,
      source: "template-fallback",
      warning: "API klíč není nakonfigurován, použita šablona.",
    });
  }

  const systemPrompt = buildSystemPrompt(scale, boardWidth, boardDepth);

  const userMessage = `Design a unique track layout:

${prompt}

Board: ${boardWidth}×${boardDepth}cm, Scale: ${scale}

CHECKLIST before responding:
1. ✅ mainLoop forms a CLOSED LOOP (both straight sides = equal mm)
2. ✅ Only valid piece IDs from catalog
3. ✅ Curves total exactly 180° per half-turn (${scale === "TT" ? "12×15° or 6×30°" : "6×30°"})
4. ✅ Turnout lengths counted in straight totals
5. ✅ Creative design — not a basic oval unless specifically requested
6. ✅ Branch sourceSegmentIndex matches the turnout's position in mainLoop (0-based)

Return ONLY the JSON.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      // Fallback to template
      const fallbackLayout = selectFallbackTemplate(scale, body.character, body.complexity, body.features);
      const result = computeLayout(fallbackLayout, scale, effectiveWidth, effectiveDepth);
      return NextResponse.json({
        tracks: layoutResultToAPIResponse(result),
        description: "Kolejiště ze šablony (chyba AI)",
        loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
        loopGapMm: result.loopGapMm,
        source: "template-fallback",
        warning: `AI chyba (${response.status}), použita šablona.`,
      });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content ?? "";

    // Parse the AI response
    let aiResponse: Record<string, unknown>;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      aiResponse = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", aiText);
      const fallbackLayout = selectFallbackTemplate(scale, body.character, body.complexity, body.features);
      const result = computeLayout(fallbackLayout, scale, effectiveWidth, effectiveDepth);
      return NextResponse.json({
        tracks: layoutResultToAPIResponse(result),
        description: "Kolejiště ze šablony (AI vrátila neplatný JSON)",
        loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
        loopGapMm: result.loopGapMm,
        source: "template-fallback",
        warning: "AI vrátila neplatnou odpověď, použita šablona.",
      });
    }

    // Parse into LayoutDefinition
    const layoutDef = parseAILayoutResponse(aiResponse);
    if (!layoutDef) {
      console.error("Failed to parse layout definition from AI response:", aiResponse);
      const fallbackLayout = selectFallbackTemplate(scale, body.character, body.complexity, body.features);
      const result = computeLayout(fallbackLayout, scale, effectiveWidth, effectiveDepth);
      return NextResponse.json({
        tracks: layoutResultToAPIResponse(result),
        description: "Kolejiště ze šablony (AI layout neplatný)",
        loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
        loopGapMm: result.loopGapMm,
        source: "template-fallback",
        warning: "AI vygenerovala neplatný layout, použita šablona.",
      });
    }

    // Compute deterministic layout!
    const result = computeLayout(layoutDef, scale, effectiveWidth, effectiveDepth);
    const description = typeof aiResponse.description === "string"
      ? aiResponse.description
      : "AI vygenerované kolejiště";

    // If loop didn't close, try fallback
    if (!result.loopClosed && result.loopGapMm > 10) {
      console.warn(`AI layout loop gap too large: ${result.loopGapMm.toFixed(1)}mm, falling back`);
      const fallbackLayout = selectFallbackTemplate(scale, body.character, body.complexity, body.features);
      const fallbackResult = computeLayout(fallbackLayout, scale, effectiveWidth, effectiveDepth);
      return NextResponse.json({
        tracks: layoutResultToAPIResponse(fallbackResult),
        description: "Kolejiště ze šablony (AI layout se neuzavřel)",
        loopClosed: fallbackResult.loopClosed,
        hasClosedLoop: fallbackResult.hasClosedLoop,
        loopGapMm: fallbackResult.loopGapMm,
        source: "template-fallback",
        warning: `AI layout se neuzavřel (mezera ${result.loopGapMm.toFixed(1)}mm), použita šablona.`,
        aiAttempt: {
          loopGapMm: result.loopGapMm,
          trackCount: result.tracks.length,
          warnings: result.warnings,
        },
      });
    }

    return NextResponse.json({
      tracks: layoutResultToAPIResponse(result),
      description,
      loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
      loopGapMm: result.loopGapMm,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      source: "ai",
    });
  } catch (err) {
    console.error("Generate track 3D error:", err);
    const fallbackLayout = selectFallbackTemplate(scale, body.character, body.complexity, body.features);
    const result = computeLayout(fallbackLayout, scale, effectiveWidth, effectiveDepth);
    return NextResponse.json({
      tracks: layoutResultToAPIResponse(result),
      description: "Kolejiště ze šablony (chyba komunikace s AI)",
      loopClosed: result.loopClosed,
        hasClosedLoop: result.hasClosedLoop,
      loopGapMm: result.loopGapMm,
      source: "template-fallback",
      warning: "Chyba při komunikaci s AI, použita šablona.",
    });
  }
}
