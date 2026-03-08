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

  const systemPrompt = `Jsi expert na návrh kolejišť pro modelovou železnici. Tvým úkolem je navrhnout kolejový plán jako strukturovaný popis TRAS (routes) — logických sekvencí úseků kolejí.

DŮLEŽITÉ: Nenavrhuj souřadnice! Popisuješ LOGICKOU STRUKTURU trati — sekvenci rovných úseků, oblouků, výhybek, tunelů atd. Deterministický renderer pak geometrii vykreslí.

PRAVIDLA PRO NÁVRH:
1. Hlavní trať (id "main") MUSÍ tvořit UZAVŘENOU SMYČKU — poslední segment se musí geometricky napojit na první.
2. Pro uzavření smyčky: součet všech zatáček musí dát 360° (např. 4×90° nebo 6×60° apod.).
3. Celkové rozměry trati musí přibližně odpovídat desce ${boardW_mm}×${boardH_mm} mm.
4. Vedlejší trasy (sidings, station tracks) odbočují z hlavní přes "turnout" a buď se napojí zpět ("merge") nebo končí zarážkou ("buffer").
5. Používej realistické rozměry: rovné úseky 100-600mm, poloměry oblouků ${catalog.curves.map(c => c.match(/(\d+(?:\.\d+)?)\s*mm/)?.[1]).filter(Boolean).join("/")}mm, úhly 15°/30°/45°/90°.
6. Buď kreativní — ne jen oválky! Navrhuj S-křivky, osmičky, dog-bone, průjezdné stanice, nákladiště, tunely.
7. Každá trasa má unikátní barvu.
8. Navrhni 2-6 tras pro zajímavé kolejiště.

KATALOG (${catalog.name}):
Rovné: ${catalog.straights.join(", ")}
Oblouky: ${catalog.curves.join(", ")}
Výhybky: ${catalog.turnouts.join(", ")}

ODPOVĚZ PŘESNĚ V TOMTO JSON FORMÁTU:
{
  "name": "Název kolejiště (česky, výstižný)",
  "routes": [
    {
      "id": "main",
      "name": "Hlavní trať",
      "color": "#f0a030",
      "segments": [
        { "type": "straight", "length": 400 },
        { "type": "curve", "direction": "right", "angle": 90, "radius": 380 },
        { "type": "straight", "length": 600 },
        { "type": "turnout", "direction": "left", "branch": "station-2" },
        { "type": "straight", "length": 300 },
        { "type": "curve", "direction": "right", "angle": 90, "radius": 380 },
        { "type": "straight", "length": 400 },
        { "type": "tunnel", "length": 350 },
        { "type": "curve", "direction": "right", "angle": 90, "radius": 380 },
        { "type": "straight", "length": 600 },
        { "type": "curve", "direction": "right", "angle": 90, "radius": 380 }
      ]
    },
    {
      "id": "station-2",
      "name": "Stanice kolej 2",
      "color": "#4a9eff",
      "parentRoute": "main",
      "branchFromSegment": 3,
      "segments": [
        { "type": "curve", "direction": "left", "angle": 10, "radius": 500 },
        { "type": "straight", "length": 300, "station": "Hlavní nádraží" },
        { "type": "curve", "direction": "right", "angle": 10, "radius": 500 },
        { "type": "merge", "into": "main", "atSegment": 5 }
      ]
    },
    {
      "id": "siding",
      "name": "Vlečka",
      "color": "#66bb6a",
      "parentRoute": "main",
      "branchFromSegment": 7,
      "segments": [
        { "type": "curve", "direction": "right", "angle": 15, "radius": 400 },
        { "type": "straight", "length": 200 },
        { "type": "buffer" }
      ]
    }
  ],
  "features": [
    { "type": "station", "name": "Hlavní nádraží", "routeIds": ["main", "station-2"] },
    { "type": "tunnel", "name": "Horský tunel", "routeId": "main" },
    { "type": "depot", "name": "Depo", "routeId": "siding" }
  ],
  "bom_notes": "Odhad: 24 rovných 230mm, 12 oblouků R2, 4 výhybky"
}

TYPY SEGMENTŮ:
- "straight" — rovný úsek, povinně "length" (mm). Volitelně "station": "Název stanice" pro stanici na tomto úseku.
- "curve" — oblouk, povinně "direction" ("left"/"right"), "angle" (stupně), "radius" (mm).
- "turnout" — výhybka/odbočka, povinně "direction" ("left"/"right"), "branch" (id vedlejší trasy která zde začíná).
- "tunnel" — tunel (rovný), povinně "length" (mm). Renderer ho vykreslí čárkovaně s portály.
- "bridge" — most (rovný), povinně "length" (mm).
- "merge" — napojení zpět na jinou trasu, povinně "into" (id trasy) a "atSegment" (index segmentu, kam se napojuje).
- "buffer" — zarážka/konec trati (bez dalších parametrů).

PRAVIDLA PRO UZAVŘENÉ SMYČKY:
- Pro jednoduchý ovál: 4 rovné + 4 oblouky po 90° (všechny stejným směrem, např. "right")
- Pro osmičku: 2 sady oblouků, střídavě "left" a "right"
- Pro dog-bone: rovné s oblouky na obou koncích
- Součet úhlů zatáček (ve stejném směru) minus součet protisměrných = 360° pro uzavření smyčky

PRAVIDLA PRO ROZMĚRY:
- Celková délka hlavní trati by měla zhruba odpovídat obvodu desky
- Pro desku ${boardW_mm}×${boardH_mm}mm: obvod ≈ ${2 * (boardW_mm + boardH_mm)}mm
- Poloměry oblouků musí být realistické (min. 300mm pro H0, 200mm pro TT/N)
- Nechej okraj alespoň 50mm od kraje desky`;

  const userMessage = `Navrhni kolejiště:
- Deska: ${boardDesc}
- Měřítko: ${scale} (1:${scale === "H0" ? 87 : scale === "TT" ? 120 : 160})
- Systém kolejí: ${catalog.name}
- Charakter: ${characterLabels[character] ?? character}
${prompt ? `- Speciální požadavky uživatele: ${prompt}` : "- Žádné speciální požadavky, navrhni typické kolejiště pro zvolený charakter."}

Vrať POUZE platný JSON objekt.`;

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

    return NextResponse.json({ result: parsed });
  } catch (err: unknown) {
    console.error("Generate track error:", err);
    return NextResponse.json(
      { error: "Chyba při komunikaci s AI" },
      { status: 500 }
    );
  }
}
