import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * 3D Track Generator API
 *
 * Uses GPT-4o to generate a layout of positioned track pieces
 * from the Tillig TT / Roco H0 catalog, then validates geometry.
 */

// Track catalog info for AI prompt
const CATALOG_DESCRIPTIONS: Record<string, string> = {
  TT: `Tillig TT (1:120) track catalog:
STRAIGHTS:
- tt-g1: 166mm straight
- tt-g2: 83mm straight
- tt-g3: 41.5mm straight
- tt-g4: 332mm straight
- tt-g5: 228mm straight

CURVES (all curve left in local space, mirror with rotation for right):
- tt-r1-15: R310mm, 15° curve
- tt-r1-30: R310mm, 30° curve
- tt-r2-15: R353mm, 15° curve
- tt-r2-30: R353mm, 30° curve
- tt-r3-15: R396mm, 15° curve
- tt-r3-30: R396mm, 30° curve

TURNOUTS:
- tt-ewl: Left turnout 166mm, 15° diverge, R310
- tt-ewr: Right turnout 166mm, 15° diverge, R310

CROSSING:
- tt-dk: Crossing 166mm at 15°

Connection geometry (in local space, piece faces +X):
- Straight: A at (0,0,0) facing -X, B at (length,0,0) facing +X
- Curve (left): A at (0,0,0), B at (R*sin(angle), 0, R-R*cos(angle)) — bends into +Z
- Turnout: A at (0,0,0), B at (length,0,0) main through, C is diverge branch end

To make a CLOSED OVAL with R310/15° curves:
- You need 12 curves per 180° turn (12×15°=180°), so 24 curves total for a full oval
- Each 180° turn spans ~2×310=620mm laterally
- Straights connect the two turns`,

  H0: `Roco H0 GeoLine (1:87) track catalog:
STRAIGHTS:
- h0-g230: 230mm straight
- h0-g200: 200mm straight
- h0-g100: 100mm straight
- h0-g345: 345mm straight

CURVES:
- h0-r2-30: R358mm, 30° curve
- h0-r2-15: R358mm, 15° curve
- h0-r3-30: R419mm, 30° curve
- h0-r4-30: R481mm, 30° curve

TURNOUTS:
- h0-wl15: Left turnout 230mm, 15° diverge, R502.7
- h0-wr15: Right turnout 230mm, 15° diverge, R502.7

CROSSING:
- h0-dk: Crossing 230mm at 15°

To make a CLOSED OVAL with R358/30° curves:
- You need 6 curves per 180° turn (6×30°=180°), so 12 curves total
- Each 180° turn spans ~2×358=716mm laterally`,
};

// Track geometry info for validation
interface PieceGeometry {
  type: "straight" | "curve" | "turnout" | "crossing";
  length?: number;
  radius?: number;
  angle?: number;
  direction?: "left" | "right";
}

const PIECE_GEOMETRIES: Record<string, PieceGeometry> = {
  "tt-g1": { type: "straight", length: 166 },
  "tt-g2": { type: "straight", length: 83 },
  "tt-g3": { type: "straight", length: 41.5 },
  "tt-g4": { type: "straight", length: 332 },
  "tt-g5": { type: "straight", length: 228 },
  "tt-r1-15": { type: "curve", radius: 310, angle: 15 },
  "tt-r1-30": { type: "curve", radius: 310, angle: 30 },
  "tt-r2-15": { type: "curve", radius: 353, angle: 15 },
  "tt-r2-30": { type: "curve", radius: 353, angle: 30 },
  "tt-r3-15": { type: "curve", radius: 396, angle: 15 },
  "tt-r3-30": { type: "curve", radius: 396, angle: 30 },
  "tt-ewl": { type: "turnout", length: 166, angle: 15, direction: "left", radius: 310 },
  "tt-ewr": { type: "turnout", length: 166, angle: 15, direction: "right", radius: 310 },
  "tt-dk": { type: "crossing", length: 166, angle: 15 },
  "h0-g230": { type: "straight", length: 230 },
  "h0-g200": { type: "straight", length: 200 },
  "h0-g100": { type: "straight", length: 100 },
  "h0-g345": { type: "straight", length: 345 },
  "h0-r2-30": { type: "curve", radius: 358, angle: 30 },
  "h0-r2-15": { type: "curve", radius: 358, angle: 15 },
  "h0-r3-30": { type: "curve", radius: 419, angle: 30 },
  "h0-r4-30": { type: "curve", radius: 481, angle: 30 },
  "h0-wl15": { type: "turnout", length: 230, angle: 15, direction: "left", radius: 502.7 },
  "h0-wr15": { type: "turnout", length: 230, angle: 15, direction: "right", radius: 502.7 },
  "h0-dk": { type: "crossing", length: 230, angle: 15 },
};

interface AITrackPiece {
  pieceId: string;
  x: number;
  z: number;
  rotation: number;
  elevation?: number;
  isTunnel?: boolean;
  isBridge?: boolean;
  connectedTo?: Record<string, string>;
}

/** Compute the B-end position of a track piece given its placement */
function computeEndPosition(
  piece: PieceGeometry,
  x: number,
  z: number,
  rotation: number,
): { x: number; z: number; angle: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  if (piece.type === "straight" || piece.type === "turnout" || piece.type === "crossing") {
    const len = piece.length || 100;
    return {
      x: x + len * cos,
      z: z + len * sin,
      angle: rotation,
    };
  }

  if (piece.type === "curve" && piece.radius && piece.angle) {
    const angleRad = (piece.angle * Math.PI) / 180;
    const endLocalX = piece.radius * Math.sin(angleRad);
    const endLocalZ = piece.radius - piece.radius * Math.cos(angleRad);
    return {
      x: x + endLocalX * cos - endLocalZ * sin,
      z: z + endLocalX * sin + endLocalZ * cos,
      angle: rotation + angleRad,
    };
  }

  return { x, z, angle: rotation };
}

/** Build a deterministic base oval, then let AI enhance it */
function buildBaseOval(
  scale: string,
  boardWmm: number,
  boardHmm: number,
): AITrackPiece[] {
  const isTT = scale === "TT";

  // Pick curve and straight pieces
  const curveId = isTT ? "tt-r1-15" : "h0-r2-30";
  const curveGeo = PIECE_GEOMETRIES[curveId]!;
  const curvesPerHalf = Math.round(180 / curveGeo.angle!);
  const radius = curveGeo.radius!;

  const straightId = isTT ? "tt-g1" : "h0-g230";
  const straightGeo = PIECE_GEOMETRIES[straightId]!;
  const straightLen = straightGeo.length!;

  // Calculate how many straights fit
  const turnDiameter = 2 * radius;
  const padding = 100;
  const availableLength = boardWmm - turnDiameter - padding;
  const straightCount = Math.max(1, Math.floor(availableLength / straightLen));

  const tracks: AITrackPiece[] = [];

  // Start position: centered on board
  const totalStraightLength = straightCount * straightLen;
  const totalWidth = totalStraightLength + turnDiameter;
  const startX = (boardWmm - totalWidth) / 2 + radius;
  const startZ = boardHmm / 2 - radius;

  let cx = startX;
  let cz = startZ;
  let cAngle = 0; // current direction in radians

  // Top straight section
  for (let i = 0; i < straightCount; i++) {
    tracks.push({ pieceId: straightId, x: cx, z: cz, rotation: cAngle });
    const end = computeEndPosition(straightGeo, cx, cz, cAngle);
    cx = end.x;
    cz = end.z;
    cAngle = end.angle;
  }

  // Right turn (180° in positive direction = curving right visually)
  // For left-bending curves, we need to flip: rotation includes PI offset for right turn
  for (let i = 0; i < curvesPerHalf; i++) {
    // Curves bend left in local space; to go right, we place them with adjusted rotation
    const curveRotation = cAngle - Math.PI; // flip so they curve right
    // Actually, simpler approach: use negative Z scaling concept
    // Place curve normally (bends left = +Z in local space)
    tracks.push({ pieceId: curveId, x: cx, z: cz, rotation: cAngle });
    const angleRad = (curveGeo.angle! * Math.PI) / 180;
    const endLocalX = radius * Math.sin(angleRad);
    const endLocalZ = radius - radius * Math.cos(angleRad);
    const cos = Math.cos(cAngle);
    const sin = Math.sin(cAngle);
    cx = cx + endLocalX * cos - endLocalZ * sin;
    cz = cz + endLocalX * sin + endLocalZ * cos;
    cAngle = cAngle + angleRad;
  }

  // Bottom straight section (going back)
  for (let i = 0; i < straightCount; i++) {
    tracks.push({ pieceId: straightId, x: cx, z: cz, rotation: cAngle });
    const end = computeEndPosition(straightGeo, cx, cz, cAngle);
    cx = end.x;
    cz = end.z;
    cAngle = end.angle;
  }

  // Left turn (another 180°)
  for (let i = 0; i < curvesPerHalf; i++) {
    tracks.push({ pieceId: curveId, x: cx, z: cz, rotation: cAngle });
    const angleRad = (curveGeo.angle! * Math.PI) / 180;
    const endLocalX = radius * Math.sin(angleRad);
    const endLocalZ = radius - radius * Math.cos(angleRad);
    const cos = Math.cos(cAngle);
    const sin = Math.sin(cAngle);
    cx = cx + endLocalX * cos - endLocalZ * sin;
    cz = cz + endLocalX * sin + endLocalZ * cos;
    cAngle = cAngle + angleRad;
  }

  return tracks;
}

/** Validate that tracks are within board bounds */
function validateBounds(tracks: AITrackPiece[], boardWmm: number, boardHmm: number): string[] {
  const errors: string[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    if (t.x < -50 || t.x > boardWmm + 50 || t.z < -50 || t.z > boardHmm + 50) {
      errors.push(`Track ${i} (${t.pieceId}) is outside board bounds at (${Math.round(t.x)}, ${Math.round(t.z)})`);
    }
    if (!PIECE_GEOMETRIES[t.pieceId]) {
      errors.push(`Track ${i} has unknown pieceId "${t.pieceId}"`);
    }
  }
  return errors;
}

/** Validate connection alignment between sequential tracks */
function validateConnections(tracks: AITrackPiece[]): string[] {
  const errors: string[] = [];
  const TOLERANCE = 5; // mm

  for (let i = 0; i < tracks.length - 1; i++) {
    const t = tracks[i];
    const next = tracks[i + 1];
    const geo = PIECE_GEOMETRIES[t.pieceId];
    if (!geo) continue;

    const end = computeEndPosition(geo, t.x, t.z, t.rotation);
    const dx = Math.abs(end.x - next.x);
    const dz = Math.abs(end.z - next.z);
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > TOLERANCE) {
      errors.push(
        `Gap of ${Math.round(dist)}mm between track ${i} end (${Math.round(end.x)},${Math.round(end.z)}) and track ${i + 1} start (${Math.round(next.x)},${Math.round(next.z)})`
      );
    }
  }

  return errors;
}

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
  // Legacy support
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

  // Board shape
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

  // Character
  if (body.character && CHARACTER_LABELS[body.character]) {
    parts.push(`Charakter: ${CHARACTER_LABELS[body.character]}.`);
  }

  // Complexity
  if (body.complexity && COMPLEXITY_LABELS[body.complexity]) {
    parts.push(`Složitost: ${COMPLEXITY_LABELS[body.complexity]}.`);
  }

  // Features
  if (body.features && body.features.length > 0) {
    const labels = body.features
      .map((f) => FEATURE_LABELS[f])
      .filter(Boolean);
    if (labels.length > 0) {
      parts.push(`Speciální prvky: ${labels.join(", ")}.`);
    }
  }

  // Additional user prompt
  if (body.additionalPrompt && body.additionalPrompt.trim()) {
    parts.push(`Další požadavky: ${body.additionalPrompt.trim()}`);
  }

  return parts.join("\n");
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

  const { scale, boardWidth, boardDepth } = body;

  if (!scale || !boardWidth || !boardDepth) {
    return NextResponse.json({ error: "Chybí povinné parametry (scale, boardWidth, boardDepth)" }, { status: 400 });
  }

  const boardWmm = boardWidth * 10;
  const boardHmm = boardDepth * 10;

  // Build the prompt from structured form data (or use legacy prompt field)
  const prompt = body.character ? buildPromptFromForm(body) : (body.prompt || "");

  // Step 1: Build deterministic base oval
  const baseTracks = buildBaseOval(scale, boardWmm, boardHmm);

  // If no prompt, just return the base oval
  if (!prompt || prompt.trim() === "") {
    // Add connection info
    const tracksWithSnaps = addSnapConnections(baseTracks);
    return NextResponse.json({ tracks: tracksWithSnaps });
  }

  // Step 2: Ask AI to enhance the layout
  const catalogDesc = CATALOG_DESCRIPTIONS[scale] || CATALOG_DESCRIPTIONS["TT"];

  // Build board shape description for AI
  let boardShapeDesc = `Rectangular board: ${boardWidth}×${boardDepth} cm`;
  if (body.boardShape === "l-shape") {
    boardShapeDesc = `L-shaped board: main ${boardWidth}×${boardDepth} cm, arm at ${body.lCorner || "top-right"} corner, arm width ${body.lArmWidth || 60} cm, arm depth ${body.lArmDepth || 40} cm. Only place tracks within the L-shape area!`;
  } else if (body.boardShape === "u-shape") {
    boardShapeDesc = `U-shaped board: main ${boardWidth}×${boardDepth} cm, arms depth ${body.uArmDepth || 40} cm on both sides. Only place tracks within the U-shape area!`;
  }

  const systemPrompt = `You are an expert model railway 3D layout designer. You'll receive a base oval loop as a JSON array of positioned track pieces, and you should enhance it based on the user's request.

TRACK CATALOG:
${catalogDesc}

COORDINATE SYSTEM:
- X axis = horizontal (along straights)
- Z axis = depth (perpendicular to straights)
- Y axis = up (elevation)
- Rotation in radians around Y axis. 0 = facing +X direction.
- Board dimensions are in mm.

BOARD SHAPE: ${boardShapeDesc}

YOUR TASK:
1. Start with the provided base oval tracks
2. Add turnouts, sidings, tunnels, bridges as requested
3. For turnouts: replace a straight with a turnout at the same position
4. For sidings: add new tracks branching from turnout's diverge point
5. For tunnels: mark tracks with isTunnel: true
6. For bridges: mark elevated tracks with isBridge: true, elevation > 0
7. Match the requested character, complexity, and special features

COMPLEXITY GUIDE:
- Simple: basic oval with minimal additions (1-2 turnouts max)
- Medium: add station area, sidings, passing loops
- Complex: multiple routes, crossings, elevation changes, tunnels, bridges

RULES:
- Each track piece must have: pieceId, x, z, rotation
- Optional: elevation (mm above board), isTunnel, isBridge
- Pieces must connect: end of piece N = start of piece N+1 (for main loop)
- Use ONLY piece IDs from the catalog
- Keep the base oval intact unless replacing straights with turnouts
- All coordinates in mm
- Respect the board shape — don't place tracks outside the board area

OUTPUT FORMAT: Return ONLY a JSON object:
{
  "tracks": [
    { "pieceId": "tt-g1", "x": 100, "z": 500, "rotation": 0 },
    { "pieceId": "tt-r1-15", "x": 266, "z": 500, "rotation": 0 },
    ...
  ],
  "description": "Short description of the layout in Czech"
}`;

  const userMessage = `Board: ${boardWidth}×${boardDepth} cm (${boardWmm}×${boardHmm} mm)
Scale: ${scale}

BASE OVAL (${baseTracks.length} pieces):
${JSON.stringify(baseTracks.map(t => ({ ...t, x: Math.round(t.x), z: Math.round(t.z), rotation: Math.round(t.rotation * 1000) / 1000 })), null, 2)}

USER REQUEST:
${prompt}

Enhance this layout. Return ONLY valid JSON with the "tracks" array containing ALL pieces (base + additions).`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 8000,
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

    let parsed: { tracks?: AITrackPiece[]; description?: string };
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", aiText);
      // Fall back to base oval
      const tracksWithSnaps = addSnapConnections(baseTracks);
      return NextResponse.json({
        tracks: tracksWithSnaps,
        warning: "AI vrátila neplatnou odpověď, zobrazuji základní ovál.",
      });
    }

    let aiTracks = parsed.tracks || baseTracks;

    // Validate piece IDs
    aiTracks = aiTracks.filter(t => PIECE_GEOMETRIES[t.pieceId]);

    if (aiTracks.length === 0) {
      const tracksWithSnaps = addSnapConnections(baseTracks);
      return NextResponse.json({
        tracks: tracksWithSnaps,
        warning: "AI nevygenerovala žádné platné koleje, zobrazuji základní ovál.",
      });
    }

    // Validate bounds
    const boundErrors = validateBounds(aiTracks, boardWmm, boardHmm);
    if (boundErrors.length > 0) {
      console.warn("Track bounds issues:", boundErrors);
    }

    // Validate connections
    const connErrors = validateConnections(aiTracks);
    if (connErrors.length > 0) {
      console.warn("Track connection issues:", connErrors);
    }

    const tracksWithSnaps = addSnapConnections(aiTracks);

    return NextResponse.json({
      tracks: tracksWithSnaps,
      description: parsed.description,
      validation: {
        boundErrors: boundErrors.length,
        connectionErrors: connErrors.length,
      },
    });
  } catch (err) {
    console.error("Generate track 3D error:", err);
    // Fall back to base oval
    const tracksWithSnaps = addSnapConnections(baseTracks);
    return NextResponse.json({
      tracks: tracksWithSnaps,
      warning: "Chyba při komunikaci s AI, zobrazuji základní ovál.",
    });
  }
}

/** Add snap connection info between sequential tracks */
function addSnapConnections(tracks: AITrackPiece[]): AITrackPiece[] {
  const result: AITrackPiece[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const snapped: Record<string, string> = {};

    // Check if this track's start connects to previous track's end
    if (i > 0) {
      const prev = tracks[i - 1];
      const prevGeo = PIECE_GEOMETRIES[prev.pieceId];
      if (prevGeo) {
        const end = computeEndPosition(prevGeo, prev.x, prev.z, prev.rotation);
        const dist = Math.sqrt((end.x - tracks[i].x) ** 2 + (end.z - tracks[i].z) ** 2);
        if (dist < 10) {
          snapped["a"] = `track-seq-${i - 1}:b`;
        }
      }
    }

    // Check if this track's end connects to next track's start
    if (i < tracks.length - 1) {
      const geo = PIECE_GEOMETRIES[tracks[i].pieceId];
      if (geo) {
        const end = computeEndPosition(geo, tracks[i].x, tracks[i].z, tracks[i].rotation);
        const next = tracks[i + 1];
        const dist = Math.sqrt((end.x - next.x) ** 2 + (end.z - next.z) ** 2);
        if (dist < 10) {
          snapped["b"] = `track-seq-${i + 1}:a`;
        }
      }
    }

    // Check if last track connects back to first (closed loop)
    if (i === tracks.length - 1) {
      const geo = PIECE_GEOMETRIES[tracks[i].pieceId];
      if (geo) {
        const end = computeEndPosition(geo, tracks[i].x, tracks[i].z, tracks[i].rotation);
        const first = tracks[0];
        const dist = Math.sqrt((end.x - first.x) ** 2 + (end.z - first.z) ** 2);
        if (dist < 15) {
          snapped["b"] = `track-seq-0:a`;
        }
      }
    }
    if (i === 0 && tracks.length > 1) {
      const last = tracks[tracks.length - 1];
      const lastGeo = PIECE_GEOMETRIES[last.pieceId];
      if (lastGeo) {
        const end = computeEndPosition(lastGeo, last.x, last.z, last.rotation);
        const dist = Math.sqrt((end.x - tracks[0].x) ** 2 + (end.z - tracks[0].z) ** 2);
        if (dist < 15) {
          snapped["a"] = `track-seq-${tracks.length - 1}:b`;
        }
      }
    }

    result.push({
      ...tracks[i],
      connectedTo: Object.keys(snapped).length > 0 ? snapped : undefined,
    });
  }
  return result;
}
