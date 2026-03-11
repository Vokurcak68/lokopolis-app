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

  return `You are a model railway layout designer. Design track layouts by specifying SEQUENCES of track pieces.

DO NOT calculate coordinates — the layout engine will compute exact positions from your sequence.

TRACK CATALOG (${scale} scale):
${catalogDesc}

You specify a JSON object with:
1. "mainLoop": array of segments forming a closed loop. Each segment: {"pieceId": "<id>"}
2. "branches": array of side tracks branching from turnouts in mainLoop

CRITICAL RULES FOR CLOSED LOOPS:
- The main loop MUST close — the last piece must connect back to the first
- An oval = straights on one side + 180° of curves + straights on other side + 180° of curves
- BOTH straight sections must have THE SAME total length in mm!
- ${isTT
    ? "For TT R1 15° curves: 12 curves = 180° half-circle, 24 = full circle"
    : "For H0 R2 30° curves: 6 curves = 180° half-circle, 12 = full circle"}
- ${isTT
    ? "For TT R1 30° curves: 6 curves = 180°, 12 = full circle"
    : "For H0 R3 30° curves: 6 curves = 180°, 12 = full circle"}

CRITICAL: STRAIGHT LENGTHS MUST MATCH!
When replacing a straight with turnouts, account for piece lengths:
${isTT
    ? `- TT turnout (ewl/ewr) = 166mm (same as G1)
- TT G1 = 166mm, G2 = 83mm, G3 = 41.5mm, G4 = 332mm, G5 = 228mm
- Example: replacing one G4(332mm) with ewl(166mm) + G1(166mm) keeps the same total`
    : `- H0 turnout (wl15/wr15) = 230mm (same as G230)
- H0 G230 = 230mm, G200 = 200mm, G100 = 100mm, G345 = 345mm
- Example: replacing one G345(345mm) with wl15(230mm) + G100(100mm) + ... etc.`}

TURNOUT RULES:
- When you place a turnout in mainLoop, the main line continues through connection B (straight through)
- Branch from connection C starts a new branch
- Reference the turnout by its INDEX in mainLoop (0-based)
- Branch starts from the turnout's "c" connection

Board size: ${boardWidth}×${boardDepth} cm (${boardWidth * 10}×${boardDepth * 10} mm)
The layout engine will auto-center the layout on the board.

OUTPUT FORMAT — return ONLY this JSON:
{
  "mainLoop": [
    {"pieceId": "..."},
    {"pieceId": "...", "isTunnel": true},
    ...
  ],
  "branches": [
    {
      "sourceSegmentIndex": 0,
      "sourceConnection": "c",
      "segments": [{"pieceId": "..."}, ...]
    }
  ],
  "description": "Short description of the layout in Czech"
}

EXAMPLE — Simple TT oval:
{
  "mainLoop": [
    ${isTT
      ? `{"pieceId": "tt-g4"}, {"pieceId": "tt-g4"}, {"pieceId": "tt-g4"},
    ${'{"pieceId": "tt-r1-15"}, '.repeat(11)}{"pieceId": "tt-r1-15"},
    {"pieceId": "tt-g4"}, {"pieceId": "tt-g4"}, {"pieceId": "tt-g4"},
    ${'{"pieceId": "tt-r1-15"}, '.repeat(11)}{"pieceId": "tt-r1-15"}`
      : `{"pieceId": "h0-g345"}, {"pieceId": "h0-g345"}, {"pieceId": "h0-g345"},
    ${'{"pieceId": "h0-r2-30"}, '.repeat(5)}{"pieceId": "h0-r2-30"},
    {"pieceId": "h0-g345"}, {"pieceId": "h0-g345"}, {"pieceId": "h0-g345"},
    ${'{"pieceId": "h0-r2-30"}, '.repeat(5)}{"pieceId": "h0-r2-30"}`}
  ],
  "branches": [],
  "description": "Jednoduchý ovál"
}

EXAMPLE — TT oval with passing siding:
Top side total: ewl(166) + 2×G4(664) + ewr(166) = 996mm
Bottom side: 3×G4(996) = 996mm ← MUST MATCH!
{
  "mainLoop": [
    {"pieceId": "${isTT ? "tt-ewl" : "h0-wl15"}"},
    {"pieceId": "${isTT ? "tt-g4" : "h0-g345"}"}, {"pieceId": "${isTT ? "tt-g4" : "h0-g345"}"},
    {"pieceId": "${isTT ? "tt-ewr" : "h0-wr15"}"},
    ... 180° curves ...,
    ... straights matching top total ...,
    ... 180° curves ...
  ],
  "branches": [
    {"sourceSegmentIndex": 0, "sourceConnection": "c", "segments": [
      {"pieceId": "${isTT ? "tt-g4" : "h0-g345"}"}, {"pieceId": "${isTT ? "tt-g4" : "h0-g345"}"}
    ]}
  ]
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
    station: "station-with-yard",
    mountain: "mountain-loop",
    corridor: "oval-with-siding",
    industrial: "industrial-spur",
    diorama: "simple-oval",
    "through-station": "figure-eight",
  };

  let templateId = "simple-oval";

  if (character && charMap[character]) {
    templateId = charMap[character];
  } else if (complexity === "complex") {
    templateId = "station-with-yard";
  } else if (complexity === "medium") {
    templateId = "oval-with-siding";
  }

  // Feature overrides — pouze pokud nebylo mapováno z charakteru
  if (!character || !charMap[character]) {
    if (features?.includes("tunnel")) {
      templateId = "mountain-loop";
    }
    if (features?.includes("sidings") || features?.includes("station")) {
      templateId = "station-with-yard";
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

  // For L/U shapes, compute effective bounding box dimensions for centering
  let effectiveWidth = boardWidth;
  let effectiveDepth = boardDepth;
  if (body.boardShape === "l-shape" && body.lArmDepth) {
    effectiveDepth = boardDepth + (body.lArmDepth || 0);
  } else if (body.boardShape === "u-shape" && body.uArmDepth) {
    effectiveDepth = boardDepth + (body.uArmDepth || 0);
  }

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
      loopGapMm: result.loopGapMm,
      source: "template-fallback",
      warning: "API klíč není nakonfigurován, použita šablona.",
    });
  }

  const systemPrompt = buildSystemPrompt(scale, boardWidth, boardDepth);

  const userMessage = `Design a track layout with these requirements:

${prompt}

Board: ${boardWidth}×${boardDepth} cm, Scale: ${scale}

Remember:
- mainLoop must form a CLOSED LOOP
- Both straight sections of an oval must have EQUAL total length in mm
- Use only piece IDs from the catalog
- Count curves correctly: ${scale === "TT" ? "12×15° or 6×30° = 180°" : "6×30° = 180°"}

Return ONLY the JSON object.`;

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
      loopGapMm: result.loopGapMm,
      source: "template-fallback",
      warning: "Chyba při komunikaci s AI, použita šablona.",
    });
  }
}
