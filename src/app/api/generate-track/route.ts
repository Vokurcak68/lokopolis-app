import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Track catalogs for the AI prompt context
const TRACK_CATALOGS_INFO: Record<string, { name: string; straights: string[]; curves: string[]; turnouts: string[] }> = {
  "roco-line": {
    name: "ROCO GeoLine",
    straights: ["G230 (230mm)", "G200 (200mm)", "G100 (100mm)"],
    curves: ["R2 oblouk (358mm, 30°)", "R3 oblouk (419mm, 30°)", "R4 oblouk (481mm, 30°)"],
    turnouts: ["Výhybka levá WL15 (230mm, 15°)", "Výhybka pravá WR15 (230mm, 15°)"],
  },
  "roco-geo": {
    name: "ROCO Line",
    straights: ["ST228 (228.9mm)", "ST115 (114.5mm)"],
    curves: ["R2 oblouk (358mm, 30°)", "R3 oblouk (419mm, 30°)"],
    turnouts: ["Výhybka levá WL (230mm)", "Výhybka pravá WR (230mm)"],
  },
  tillig: {
    name: "Tillig (TT)",
    straights: ["G1 (166mm)", "G2 (83mm)", "G3 (41.5mm)"],
    curves: ["R310 oblouk (310mm, 15°)", "R353 oblouk (353mm, 15°)", "R396 oblouk (396mm, 15°)"],
    turnouts: ["Výhybka levá EWL (166mm, 15°)", "Výhybka pravá EWR (166mm, 15°)"],
  },
  "piko-a": {
    name: "PIKO A",
    straights: ["G231 (231mm)", "G115 (115mm)"],
    curves: ["R1 oblouk (360mm, 30°)", "R2 oblouk (422mm, 30°)", "R3 oblouk (484mm, 30°)"],
    turnouts: ["Výhybka levá WL (239mm, 15°)", "Výhybka pravá WR (239mm, 15°)"],
  },
  fleischmann: {
    name: "Fleischmann Profi",
    straights: ["6101 (200mm)", "6103 (100mm)", "6104 (50mm)"],
    curves: ["R1 oblouk (356.5mm, 30°)", "R2 oblouk (420mm, 30°)"],
    turnouts: ["6170 výhybka levá (200mm, 15°)", "6171 výhybka pravá (200mm, 15°)"],
  },
};

type TrackCommand =
  | ["straight", number]
  | ["curve", "left" | "right", number, number]
  | ["turnout", "left" | "right", string]
  | ["tunnel_start"]
  | ["tunnel_end"];

interface CatalogParsed {
  straights: { length: number }[];
  curves: { radius: number; angle: number }[];
  turnoutLength: number;
}

function parseCatalog(trackSystem: string): CatalogParsed {
  const cat = TRACK_CATALOGS_INFO[trackSystem];
  const straights: { length: number }[] = [];
  const curves: { radius: number; angle: number }[] = [];
  let turnoutLength = 200;

  for (const s of cat.straights) {
    const m = s.match(/\((\d+(?:\.\d+)?)mm\)/);
    if (m) straights.push({ length: parseFloat(m[1]) });
  }
  // Sort straights descending by length
  straights.sort((a, b) => b.length - a.length);

  for (const c of cat.curves) {
    const m = c.match(/\((\d+(?:\.\d+)?)mm,\s*(\d+(?:\.\d+)?)°\)/);
    if (m) curves.push({ radius: parseFloat(m[1]), angle: parseFloat(m[2]) });
  }
  // Sort curves ascending by radius (smallest first)
  curves.sort((a, b) => a.radius - b.radius);

  // Parse turnout length from first turnout entry
  if (cat.turnouts.length > 0) {
    const tm = cat.turnouts[0].match(/\((\d+(?:\.\d+)?)mm/);
    if (tm) turnoutLength = parseFloat(tm[1]);
  }

  return { straights, curves, turnoutLength };
}

/**
 * Build a deterministically correct base oval loop from catalog pieces.
 * Returns commands for a closed 360° oval.
 */
function buildBaseLoop(trackSystem: string, boardW_mm: number, boardH_mm: number): { commands: TrackCommand[]; straightSegmentCount: number; curveSegmentCount: number } {
  const catalog = parseCatalog(trackSystem);

  if (catalog.curves.length === 0 || catalog.straights.length === 0) {
    throw new Error("Catalog has no curves or straights");
  }

  // Pick the smallest radius curve
  const curve = catalog.curves[0];
  const curvesPerHalf = Math.round(180 / curve.angle); // e.g. 6 for 30°, 12 for 15°

  // Calculate available straight length
  // Oval: two straight runs connected by 180° curves at each end
  // Each 180° turn spans 2*radius in the width direction
  const turnDiameter = 2 * curve.radius;
  const padding = 80; // mm padding from board edges
  const availStraight = boardW_mm - turnDiameter - padding;

  // Find the best combination of catalog straights to fill availStraight
  const straightPieces = fitStraights(catalog.straights, Math.max(availStraight, catalog.straights[catalog.straights.length - 1].length));

  const commands: TrackCommand[] = [];
  let straightCount = 0;

  // Top straight section
  for (const len of straightPieces) {
    commands.push(["straight", len]);
    straightCount++;
  }

  // Right 180° turn (curves going right)
  for (let i = 0; i < curvesPerHalf; i++) {
    commands.push(["curve", "right", curve.radius, curve.angle]);
  }

  // Bottom straight section (same pieces)
  for (const len of straightPieces) {
    commands.push(["straight", len]);
    straightCount++;
  }

  // Left 180° turn (still going right to complete the oval)
  for (let i = 0; i < curvesPerHalf; i++) {
    commands.push(["curve", "right", curve.radius, curve.angle]);
  }

  return {
    commands,
    straightSegmentCount: straightCount,
    curveSegmentCount: curvesPerHalf * 2,
  };
}

/**
 * Fit catalog straight pieces to fill a target length.
 */
function fitStraights(available: { length: number }[], target: number): number[] {
  const result: number[] = [];
  let remaining = target;

  // Greedy: use longest pieces first
  for (const piece of available) {
    while (remaining >= piece.length - 1) { // -1 for floating point tolerance
      result.push(piece.length);
      remaining -= piece.length;
    }
  }

  // If we haven't placed any, use at least one of the smallest
  if (result.length === 0 && available.length > 0) {
    result.push(available[available.length - 1].length);
  }

  return result;
}

interface AIModification {
  type: "add_turnout" | "tunnel";
  at_straight?: number; // 1-based index of straight segment
  direction?: "left" | "right";
  branch_id?: string;
  from_straight?: number;
  to_straight?: number;
}

interface AIBranch {
  id: string;
  name: string;
  color: string;
  commands: Array<["straight", number] | ["curve", "left" | "right", number, number]>;
}

interface AIEnhancement {
  name: string;
  modifications: AIModification[];
  branches: AIBranch[];
  bom_notes?: string;
}

interface AIRoute {
  id: string;
  name: string;
  color: string;
  commands: TrackCommand[];
}

/**
 * Merge base loop with AI modifications to produce final layout.
 */
function mergeLayout(
  baseCommands: TrackCommand[],
  enhancement: AIEnhancement,
  straightSegmentCount: number,
): { routes: AIRoute[] } {
  // Number the straight segments (1-based)
  // We need to identify which commands are straights
  const indexedCommands: { cmd: TrackCommand; straightIndex: number | null }[] = [];
  let straightIdx = 0;
  for (const cmd of baseCommands) {
    if (cmd[0] === "straight") {
      straightIdx++;
      indexedCommands.push({ cmd, straightIndex: straightIdx });
    } else {
      indexedCommands.push({ cmd, straightIndex: null });
    }
  }

  // Build the main route commands with modifications applied
  const mainCommands: TrackCommand[] = [];

  // Collect tunnel ranges
  const tunnelRanges: Set<number> = new Set();
  for (const mod of enhancement.modifications) {
    if (mod.type === "tunnel" && mod.from_straight && mod.to_straight) {
      for (let i = mod.from_straight; i <= mod.to_straight; i++) {
        tunnelRanges.add(i);
      }
    }
  }

  // Collect turnout positions: straightIndex -> modification
  const turnoutMap = new Map<number, AIModification>();
  for (const mod of enhancement.modifications) {
    if (mod.type === "add_turnout" && mod.at_straight) {
      turnoutMap.set(mod.at_straight, mod);
    }
  }

  let lastTunnelState = false;

  for (const { cmd, straightIndex } of indexedCommands) {
    // Handle tunnel markers
    if (straightIndex !== null) {
      const inTunnel = tunnelRanges.has(straightIndex);
      if (inTunnel && !lastTunnelState) {
        mainCommands.push(["tunnel_start"]);
      } else if (!inTunnel && lastTunnelState) {
        mainCommands.push(["tunnel_end"]);
      }
      lastTunnelState = inTunnel;
    }

    // Check if this straight should become a turnout
    if (straightIndex !== null && turnoutMap.has(straightIndex)) {
      const mod = turnoutMap.get(straightIndex)!;
      mainCommands.push(["turnout", mod.direction || "left", mod.branch_id || "siding"]);
    } else {
      mainCommands.push(cmd);
    }
  }

  // Close any open tunnel
  if (lastTunnelState) {
    mainCommands.push(["tunnel_end"]);
  }

  const routes: AIRoute[] = [
    {
      id: "main",
      name: "Hlavní trať",
      color: "#e8a030",
      commands: mainCommands,
    },
  ];

  // Add branch routes from AI
  for (const branch of enhancement.branches) {
    routes.push({
      id: branch.id,
      name: branch.name,
      color: branch.color,
      commands: branch.commands as TrackCommand[],
    });
  }

  return { routes };
}

interface RequestBody {
  prompt: string;
  boardShape: string;
  width: number;
  height: number;
  width2?: number;
  height2?: number;
  uArmDepth?: number;
  lCorner?: string;
  scale: string;
  trackSystem: string;
  character: string;
}

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "API klíč není nakonfigurován" }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }

  const { prompt, boardShape, width, height, width2, height2, uArmDepth, lCorner, scale, trackSystem, character } = body;

  if (!trackSystem || !scale) {
    return NextResponse.json({ error: "Chybí povinné parametry" }, { status: 400 });
  }

  const catalog = TRACK_CATALOGS_INFO[trackSystem];
  if (!catalog) {
    return NextResponse.json({ error: "Neznámý systém kolejí" }, { status: 400 });
  }

  // Board dimensions in mm
  const boardW_mm = width * 10;
  const boardH_mm = height * 10;

  // Step 1: Build deterministic base loop
  let baseLoop;
  try {
    baseLoop = buildBaseLoop(trackSystem, boardW_mm, boardH_mm);
  } catch (err) {
    return NextResponse.json({ error: "Nepodařilo se sestavit základní smyčku: " + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }

  // Build board description
  let boardDesc = `${width}×${height} cm obdélník (${boardW_mm}×${boardH_mm} mm)`;
  if (boardShape === "l-shape") {
    const w2mm = (width2 ?? 80) * 10;
    const h2mm = (height2 ?? 60) * 10;
    boardDesc = `Tvar L: hlavní rameno ${width}×${height} cm (${boardW_mm}×${boardH_mm} mm) + boční rameno ${width2 ?? 80}×${height2 ?? 60} cm (${w2mm}×${h2mm} mm), roh: ${lCorner ?? "bottom-right"}`;
  } else if (boardShape === "u-shape") {
    const armMm = (uArmDepth ?? 60) * 10;
    boardDesc = `Tvar U: hlavní pás ${width}×${height} cm (${boardW_mm}×${boardH_mm} mm) + dvě ramena hloubky ${uArmDepth ?? 60} cm (${armMm} mm)`;
  }

  const characterLabels: Record<string, string> = {
    "horska-trat": "Horská trať (jednokolejka, tunely, stoupání, výhybny)",
    "hlavni-koridor": "Hlavní koridor (dvoukolejná trať, rychlé vlaky, průjezdná stanice)",
    "stanice-vlecky": "Stanice s vlečkami (mnoho výhybek, nákladiště, depo)",
    "mala-diorama": "Malá dioráma (kompaktní scéna, jednoduchý provoz)",
    "prujezdna-stanice": "Průjezdná stanice (ovál/smyčka s nádražím, výhybny)",
    "prumyslova-vlecka": "Průmyslová vlečka (vlečky, rampy, posun, nákladní provoz)",
  };

  // Describe base loop for AI
  const parsedCat = parseCatalog(trackSystem);
  const baseCurve = parsedCat.curves[0];
  const curvesPerHalf = Math.round(180 / baseCurve.angle);

  // Build description of the base loop segments
  const baseDescription = `The base oval loop consists of:
- ${baseLoop.straightSegmentCount} straight segments (S1 to S${baseLoop.straightSegmentCount}), half on the top side and half on the bottom side
  - S1 to S${baseLoop.straightSegmentCount / 2} are on the top (first straight run)
  - S${baseLoop.straightSegmentCount / 2 + 1} to S${baseLoop.straightSegmentCount} are on the bottom (return straight run)
- ${baseLoop.curveSegmentCount} curve segments (${curvesPerHalf} curves of ${baseCurve.angle}° at each end = 360° total, ALREADY CORRECT)
- The loop is geometrically closed and correct. DO NOT modify curves.

Available catalog pieces for branches:
- Straights: ${catalog.straights.join(", ")}
- Curves: ${catalog.curves.join(", ")}
- Turnouts: ${catalog.turnouts.join(", ")}`;

  const systemPrompt = `You are an expert model railway layout enhancer. You receive a CORRECT base oval loop and your job is to make it interesting by adding turnouts, sidings, tunnels, and stations.

THE BASE LOOP IS ALREADY GEOMETRICALLY CORRECT (360° total turning). DO NOT change the curves. You can only:
1. Replace a straight segment with a turnout (to create a branch)
2. Mark sections as tunnels
3. Design branch routes (sidings, passing loops, stations)

OUTPUT FORMAT: Return a JSON object with this EXACT structure:
{
  "name": "Creative layout name in Czech",
  "modifications": [
    {"type": "add_turnout", "at_straight": 3, "direction": "left", "branch_id": "siding1"},
    {"type": "tunnel", "from_straight": 8, "to_straight": 10}
  ],
  "branches": [
    {
      "id": "siding1",
      "name": "Vlečka",
      "color": "#4a9eff",
      "commands": [
        ["curve", "left", 358, 15],
        ["straight", 230],
        ["straight", 230]
      ]
    }
  ],
  "bom_notes": "Material estimate in Czech"
}

MODIFICATION TYPES:
- "add_turnout": Replace straight segment at_straight (1-based index) with a turnout. Specify direction ("left" or "right") for the diverging branch and branch_id to link to a branch.
- "tunnel": Mark straights from_straight to to_straight as tunnel section (drawn dashed).

BRANCH COMMANDS:
- ["straight", length_mm]
- ["curve", "left"|"right", radius_mm, angle_degrees]
Use ONLY catalog dimensions for branches.

DESIGN RULES:
- For "horská trať": Add 1-2 tunnel sections on curves/straights, maybe one passing siding
- For "hlavní koridor": Add a parallel passing track (2 turnouts creating a passing loop)
- For "stanice s vlečkami": Add 2-3 turnouts with various sidings
- For "malá dioráma": Keep it simple, maybe one short siding
- For "průjezdná stanice": Add a passing loop (2 turnouts, parallel siding that reconnects)
- For "průmyslová vlečka": Multiple short dead-end sidings for loading

PASSING LOOP PATTERN (2 turnouts + parallel track):
Replace 2 straights with turnouts (one diverging left, one diverging right — or same direction), connect with a branch of appropriate length to form a parallel track.

BRANCH COLORS: #4a9eff (blue), #66bb6a (green), #ef5350 (red), #ab47bc (purple), #26c6da (cyan)

BE CREATIVE! Don't just add one siding. Make the layout interesting for the character. Use 2-4 modifications typically.`;

  const userMessage = `Board: ${boardDesc}
Scale: ${scale} (1:${scale === "H0" ? 87 : scale === "TT" ? 120 : 160})
Track system: ${catalog.name}
Character: ${characterLabels[character] ?? character}
${prompt ? `Special requirements: ${prompt}` : "No special requirements."}

${baseDescription}

Enhance this base oval for the chosen character. Return ONLY valid JSON. Name everything in Czech. Be creative!`;

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
        temperature: 0.8,
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
      return NextResponse.json(
        { error: `AI chyba (${response.status}): ${response.statusText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON from AI response
    let enhancement: AIEnhancement;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      enhancement = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", aiText);
      return NextResponse.json(
        { error: "AI vrátila neplatnou odpověď. Zkuste to znovu.", raw: aiText },
        { status: 502 }
      );
    }

    // Validate enhancement structure
    if (!enhancement.name) enhancement.name = "Kolejiště";
    if (!enhancement.modifications) enhancement.modifications = [];
    if (!enhancement.branches) enhancement.branches = [];

    // Sanitize modifications: clamp at_straight to valid range
    enhancement.modifications = enhancement.modifications.filter(mod => {
      if (mod.type === "add_turnout") {
        return mod.at_straight && mod.at_straight >= 1 && mod.at_straight <= baseLoop.straightSegmentCount;
      }
      if (mod.type === "tunnel") {
        return mod.from_straight && mod.to_straight &&
          mod.from_straight >= 1 && mod.to_straight <= baseLoop.straightSegmentCount;
      }
      return false;
    });

    // Step 3: Merge base loop with AI modifications
    const merged = mergeLayout(
      baseLoop.commands,
      enhancement,
      baseLoop.straightSegmentCount,
    );

    const result = {
      name: enhancement.name,
      routes: merged.routes,
      bom_notes: enhancement.bom_notes || undefined,
    };

    return NextResponse.json({ result });
  } catch (err: unknown) {
    console.error("Generate track error:", err);
    return NextResponse.json(
      { error: "Chyba při komunikaci s AI" },
      { status: 500 }
    );
  }
}
