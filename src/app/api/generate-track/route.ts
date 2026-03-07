import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
  if (!ANTHROPIC_API_KEY) {
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

  // Build board description
  let boardDesc = `${width}×${height} cm obdélník`;
  if (boardShape === "l-shape") {
    boardDesc = `Tvar L: hlavní rameno ${width}×${height} cm + boční rameno ${width2 ?? 80}×${height2 ?? 60} cm (roh: ${lCorner ?? "bottom-right"})`;
  } else if (boardShape === "u-shape") {
    boardDesc = `Tvar U: hlavní pás ${width}×${height} cm + dvě ramena hloubky ${uArmDepth ?? 60} cm`;
  }

  const characterLabels: Record<string, string> = {
    "horska-trat": "Horská trať (jednokolejka, tunely, stoupání, výhybny)",
    "hlavni-koridor": "Hlavní koridor (dvoukolejná trať, rychlé vlaky, průjezdná stanice)",
    "stanice-vlecky": "Stanice s vlečkami (mnoho výhybek, nákladiště, depo)",
    "mala-diorama": "Malá dioráma (kompaktní scéna, jednoduchý provoz)",
    "prujezdna-stanice": "Průjezdná stanice (ovál/smyčka s nádražím, výhybny)",
    "prumyslova-vlecka": "Průmyslová vlečka (vlečky, rampy, posun, nákladní provoz)",
  };

  const systemPrompt = `Jsi expert na návrh kolejišť pro modelovou železnici. Navrhneš kolejový plán podle zadání uživatele.

PRAVIDLA:
1. Použij POUZE díly z daného katalogu kolejí.
2. Plán musí být geometricky uzavřený (smyčka) nebo mít logické koncové body.
3. Musí se vejít do zadaných rozměrů desky.
4. Pro 180° zatáčku potřebuješ ${Math.ceil(180 / (trackSystem.includes("tillig") ? 15 : 30))} oblouků.
5. Přizpůsob složitost velikosti desky — malá deska = jednodušší plán.
6. Pro každý rovný úsek počítej kolik dílů potřebuješ: délka úseku / délka dílu.

KATALOG (${catalog.name}):
Rovné: ${catalog.straights.join(", ")}
Oblouky: ${catalog.curves.join(", ")}
Výhybky: ${catalog.turnouts.join(", ")}

ODPOVĚZ PŘESNĚ V TOMTO JSON FORMÁTU (nic jiného, žádný markdown):
{
  "description": "Český popis navrženého kolejiště (2-4 věty). Zmíň typ provozu, zajímavé prvky, doporučení pro krajinu.",
  "bom": [
    {"name": "G230", "nameCz": "Rovná 230mm", "type": "straight", "count": 8},
    {"name": "R3 (419mm)", "nameCz": "Oblouk R3 (30°)", "type": "curve", "count": 12},
    {"name": "WL15", "nameCz": "Výhybka levá 15°", "type": "turnout-left", "count": 2}
  ],
  "features": ["tunel", "nádraží", "odstavná kolej", "most"],
  "warnings": ["Pokud je nějaký problém nebo doporučení, uveď ho sem"],
  "trackPlan": {
    "segments": [
      {"type": "mainline", "description": "Hlavní trať — ovál kolem celé desky"},
      {"type": "station", "description": "Stanice uprostřed horního rovného úseku, 3 koleje", "position": "top-center"},
      {"type": "siding", "description": "Odstavná kolej vpravo dole", "position": "bottom-right"},
      {"type": "tunnel", "description": "Tunel v levém oblouku", "position": "left"}
    ]
  }
}

TYPY segmentů: mainline, station, siding, tunnel, bridge, depot, freight-yard, passing-loop, industrial-spur, turntable
POZICE: top, bottom, left, right, center, top-left, top-right, bottom-left, bottom-right, top-center, bottom-center`;

  const userMessage = `Navrhni kolejiště:
- Deska: ${boardDesc}
- Měřítko: ${scale} (1:${scale === "H0" ? 87 : scale === "TT" ? 120 : 160})
- Systém kolejí: ${catalog.name}
- Charakter: ${characterLabels[character] ?? character}
- Další požadavky: ${prompt}

Vrať POUZE platný JSON objekt, žádný markdown ani vysvětlení kolem.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          { role: "user", content: userMessage },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `AI chyba (${response.status}): ${response.statusText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text ?? "";

    // Parse JSON from AI response (might be wrapped in ```json)
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
