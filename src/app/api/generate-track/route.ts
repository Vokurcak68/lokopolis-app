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

  const systemPrompt = `You are an expert model railway track layout designer. You design track plans as a sequence of turtle-graphics commands.

OUTPUT FORMAT: Return a JSON object with this EXACT structure:
{
  "name": "Layout name in Czech",
  "routes": [
    {
      "id": "main",
      "name": "Hlavní trať",
      "color": "#e8a030",
      "commands": [
        ["straight", 230],
        ["curve", "right", 380, 30],
        ["turnout", "left", "siding1"],
        ["tunnel_start"],
        ["straight", 230],
        ["tunnel_end"]
      ]
    },
    {
      "id": "siding1",
      "name": "Vlečka",
      "color": "#4a9eff",
      "commands": [
        ["curve", "left", 380, 15],
        ["straight", 200]
      ]
    }
  ],
  "bom_notes": "Rough material estimate in Czech"
}

COMMAND TYPES:
- ["straight", length_mm] — straight track piece
- ["curve", "left"|"right", radius_mm, angle_degrees] — curved track arc
- ["turnout", "left"|"right", "branch_route_id"] — a turnout/switch. Acts as a short straight (~100mm) on the main route; the branch route starts here with a diverging curve.
- ["tunnel_start"] — marks start of tunnel section (subsequent track drawn dashed)
- ["tunnel_end"] — marks end of tunnel section

CRITICAL RULES FOR CLOSED LOOPS:
1. The "main" route MUST form a closed loop. The total turning must equal exactly 360°.
   - Simple oval: 12 curves of 30° all turning "right" (or all "left") = 360°
   - Figure-8: NOT recommended (crossing issues)
   - Dog-bone: curves at each end totaling 180° each side
2. All curves in the same direction add up. For a simple oval with 30° curves, you need exactly 12 curves.
3. Straights connect the curved sections.

GEOMETRY GUIDANCE for board ${boardW_mm}×${boardH_mm}mm:
- A simple oval: two straight sections along the length, connected by 180° of curves at each end
- For 30° curves with radius R: a 180° turn uses 6 curves and the turn diameter is 2*R
- The straight sections should be roughly: board_length - 2*R
- Make sure the layout fits within the board dimensions!

TRACK CATALOG (${catalog.name}):
Straights: ${catalog.straights.join(", ")}
Curves: ${catalog.curves.join(", ")}
Turnouts: ${catalog.turnouts.join(", ")}

USE ONLY piece dimensions from this catalog! For example, if curves are 30° and radius 358mm, use those exact values.

DESIGN PRINCIPLES:
- Main route = closed loop (360° total turning)
- Branch routes start from turnouts on the main route
- Branch routes can be dead-end sidings (just end) or passing loops (rejoin main)
- Be creative based on the requested character
- Use tunnels for mountain themes
- Use multiple turnouts/sidings for station/industrial themes
- Keep realistic spacing between parallel tracks (at least 50mm)

ROUTE COLORS: Use distinct, visible colors on dark background:
- Main: #e8a030 (warm orange)
- Branches: #4a9eff (blue), #66bb6a (green), #ef5350 (red), #ab47bc (purple), #26c6da (cyan)`;

  const userMessage = `Design a model railway layout:
- Board: ${boardDesc}
- Scale: ${scale} (1:${scale === "H0" ? 87 : scale === "TT" ? 120 : 160})
- Track system: ${catalog.name}
- Character: ${characterLabels[character] ?? character}
${prompt ? `- Special requirements: ${prompt}` : "- No special requirements, design a typical layout for the chosen character."}

Return ONLY valid JSON. Use the EXACT piece dimensions from the catalog. The main route MUST close (360° total turning). Name everything in Czech.`;

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
        temperature: 0.7,
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
    let parsed;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", aiText);
      return NextResponse.json(
        { error: "AI vrátila neplatnou odpověď. Zkuste to znovu.", raw: aiText },
        { status: 502 }
      );
    }

    // Validate basic structure
    if (!parsed.name || !parsed.routes || !Array.isArray(parsed.routes)) {
      return NextResponse.json(
        { error: "AI vrátila neúplná data — chybí name nebo routes.", raw: parsed },
        { status: 502 }
      );
    }

    // Validate that routes have commands arrays
    for (const route of parsed.routes) {
      if (!route.commands || !Array.isArray(route.commands)) {
        return NextResponse.json(
          { error: `Trasa "${route.id || route.name}" nemá příkazy (commands).`, raw: parsed },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ result: parsed });
  } catch (err: unknown) {
    console.error("Generate track error:", err);
    return NextResponse.json(
      { error: "Chyba při komunikaci s AI" },
      { status: 500 }
    );
  }
}
