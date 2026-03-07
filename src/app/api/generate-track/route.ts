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

  if (!prompt || !trackSystem || !scale) {
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

  // Find the smallest curve radius from catalog for reference
  const curveRadii = catalog.curves.map(c => {
    const match = c.match(/(\d+(?:\.\d+)?)\s*mm/);
    return match ? parseFloat(match[1]) : 300;
  });
  const minRadius = Math.min(...curveRadii);

  const systemPrompt = `Jsi expert na návrh kolejišť pro modelovou železnici. Navrhneš geometrický kolejový plán — přesné souřadnice tratí v milimetrech.

PRAVIDLA:
1. Souřadnicový systém: (0,0) = levý horní roh desky, (${boardW_mm}, ${boardH_mm}) = pravý dolní roh.
2. Všechny souřadnice jsou v mm (reálné rozměry modelu).
3. Trať MUSÍ tvořit uzavřené smyčky, NEBO mít zarážky (buffer) na koncových bodech.
4. Používej REALISTICKÉ poloměry oblouků z katalogu: ${catalog.curves.join(", ")}. Minimální poloměr je ${minRadius}mm.
5. Pro 180° zatáčku použij několik navazujících oblouků (ne jeden oblouk 180°).
6. Pro dvoukolejku (koridor) kresli dvě rovnoběžné čáry ~30mm od sebe.
7. Stanice = více rovnoběžných kolejí spojených výhybkami.
8. Trať musí být UVNITŘ desky — nechej okraj alespoň 50mm od kraje.
9. Přizpůsob složitost velikosti desky — malá deska = jednodušší plán.
10. Výhybka má polohu (x,y), úhel odbočení a směr (left/right).
11. Oblouky definuj středem (cx,cy), poloměrem r, a startAngle/endAngle ve stupních (0° = vpravo/east, 90° = dolů/south, 180° = vlevo/west, 270° = nahoru/north).

KATALOG (${catalog.name}):
Rovné: ${catalog.straights.join(", ")}
Oblouky: ${catalog.curves.join(", ")}
Výhybky: ${catalog.turnouts.join(", ")}

ODPOVĚZ PŘESNĚ V TOMTO JSON FORMÁTU (nic jiného):
{
  "description": "Český popis kolejiště (2-3 věty).",
  "bom": [
    {"name": "G230", "nameCz": "Rovná 230mm", "type": "straight", "count": 8},
    {"name": "R3 (419mm)", "nameCz": "Oblouk R3 (30°)", "type": "curve", "count": 12},
    {"name": "WL15", "nameCz": "Výhybka levá 15°", "type": "turnout-left", "count": 2}
  ],
  "warnings": ["Případná upozornění"],
  "tracks": [
    {"type": "straight", "x1": 100, "y1": 200, "x2": 900, "y2": 200, "label": "Hlavní trať"},
    {"type": "straight", "x1": 100, "y1": 200, "x2": 900, "y2": 200},
    {"type": "curve", "cx": 900, "cy": 350, "r": 150, "startAngle": 270, "endAngle": 360},
    {"type": "turnout", "x": 400, "y": 200, "angle": 15, "direction": "left", "label": "Výhybka 1"},
    {"type": "station", "x": 300, "y": 180, "width": 300, "tracks": 3, "label": "Stanice"},
    {"type": "buffer", "x": 100, "y": 300, "angle": 180},
    {"type": "tunnel", "x1": 200, "y1": 400, "x2": 500, "y2": 400},
    {"type": "bridge", "x1": 600, "y1": 200, "x2": 800, "y2": 200}
  ],
  "labels": [
    {"x": 500, "y": 450, "text": "Popis oblasti", "fontSize": 12}
  ],
  "board": {"width": ${boardW_mm}, "height": ${boardH_mm}}
}

TYPY tratí:
- "straight" — rovný úsek: x1,y1 → x2,y2 (volitelně label, volitelně "secondary": true pro vedlejší kolej)
- "curve" — oblouk: centrum cx,cy, poloměr r, startAngle a endAngle ve stupních (volitelně "secondary": true)
- "turnout" — výhybka: pozice x,y, úhel odbočení angle, směr direction ("left"/"right")
- "station" — stanice: pozice x,y (levý horní roh), šířka width, počet kolejí tracks, label
- "buffer" — zarážka: pozice x,y, úhel angle (směr trati ke které patří, 0=doprava, 90=dolů, 180=doleva, 270=nahoru)
- "tunnel" — tunel: x1,y1 → x2,y2 (kreslí se čárkovaně)
- "bridge" — most: x1,y1 → x2,y2 (s pilíři pod tratí)

DŮLEŽITÉ:
- Hlavní trať kresli jako PŘÍMÉ LINIE + OBLOUKY, nikoliv elipsy
- Pro ovál: dvě dlouhé rovné na horní a spodní straně + 4-6 oblouků na každém konci (tvořících 180° zatáčku)
- Oblouky musí na sebe navazovat — konec jednoho oblouku = začátek dalšího
- Nech board.width a board.height přesně ${boardW_mm} a ${boardH_mm}`;

  const userMessage = `Navrhni kolejiště:
- Deska: ${boardDesc}
- Měřítko: ${scale} (1:${scale === "H0" ? 87 : scale === "TT" ? 120 : 160})
- Systém kolejí: ${catalog.name}
- Charakter: ${characterLabels[character] ?? character}
- Další požadavky: ${prompt}

Vrať POUZE platný JSON objekt.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
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

    return NextResponse.json({ result: parsed });
  } catch (err: unknown) {
    console.error("Generate track error:", err);
    return NextResponse.json(
      { error: "Chyba při komunikaci s AI" },
      { status: 500 }
    );
  }
}
