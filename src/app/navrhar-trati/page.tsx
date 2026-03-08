"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

/* ===========================
   TYPES
   =========================== */
type Scale = "H0" | "TT" | "N";
type TrackSystem = "roco-line" | "roco-geo" | "tillig" | "piko-a" | "fleischmann";
type BoardShape = "rectangle" | "l-shape" | "u-shape";
type LCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type LayoutCharacter =
  | "horska-trat"
  | "hlavni-koridor"
  | "stanice-vlecky"
  | "mala-diorama"
  | "prujezdna-stanice"
  | "prumyslova-vlecka";

interface FormData {
  boardShape: BoardShape;
  width: number;
  height: number;
  width2: number;
  height2: number;
  lCorner: LCorner;
  uArmDepth: number;
  scale: Scale;
  trackSystem: TrackSystem;
  character: LayoutCharacter;
  prompt: string;
}

/* ===========================
   AI LAYOUT TYPES (Command-based)
   =========================== */
type TrackCommand =
  | ["straight", number]
  | ["curve", "left" | "right", number, number]
  | ["turnout", "left" | "right", string]
  | ["tunnel_start"]
  | ["tunnel_end"];

interface AIRoute {
  id: string;
  name: string;
  color: string;
  commands: TrackCommand[];
}

interface AILayoutData {
  name: string;
  routes: AIRoute[];
  bom_notes?: string;
}

/* ===========================
   TRACK CATALOGS
   =========================== */
const SCALE_FACTOR: Record<Scale, number> = { H0: 87, TT: 120, N: 160 };

const TRACK_CATALOGS: Record<TrackSystem, { name: string }> = {
  "roco-line": { name: "ROCO GeoLine" },
  "roco-geo": { name: "ROCO Line" },
  tillig: { name: "Tillig (TT)" },
  "piko-a": { name: "PIKO A" },
  fleischmann: { name: "Fleischmann Profi" },
};

/* ===========================
   CHARACTER DEFINITIONS
   =========================== */
const CHARACTER_OPTIONS: { value: LayoutCharacter; label: string; icon: string; desc: string }[] = [
  { value: "horska-trat", label: "Horská trať", icon: "🏔️", desc: "Jednokolejka, tunely, stoupání" },
  { value: "hlavni-koridor", label: "Hlavní koridor", icon: "🚄", desc: "Dvoukolejná trať, rychlé vlaky" },
  { value: "stanice-vlecky", label: "Stanice + vlečky", icon: "🏛️", desc: "Stanice, vlečky, posun" },
  { value: "mala-diorama", label: "Malá dioráma", icon: "🏠", desc: "Kompaktní scéna, jednoduchý ovál" },
  { value: "prujezdna-stanice", label: "Průjezdná stanice", icon: "🔄", desc: "Ovál s výhybnou stanicí" },
  { value: "prumyslova-vlecka", label: "Průmyslová vlečka", icon: "🏭", desc: "Vlečky, rampy, posun" },
];

/* ===========================
   BOARD SHAPE OPTIONS
   =========================== */
const BOARD_SHAPES: { value: BoardShape; label: string; icon: string }[] = [
  { value: "rectangle", label: "Obdélník", icon: "▬" },
  { value: "l-shape", label: "Tvar L", icon: "⌐" },
  { value: "u-shape", label: "Tvar U", icon: "⊔" },
];

const L_CORNERS: { value: LCorner; label: string }[] = [
  { value: "top-left", label: "Vlevo nahoře" },
  { value: "top-right", label: "Vpravo nahoře" },
  { value: "bottom-left", label: "Vlevo dole" },
  { value: "bottom-right", label: "Vpravo dole" },
];

/* ===========================
   TURTLE GRAPHICS RENDERER
   =========================== */

interface TurtleState {
  x: number;
  y: number;
  heading: number; // radians, 0 = right (+x), PI/2 = down (+y)
}

interface DrawCommand {
  type: "straight" | "curve" | "turnout_dot";
  // straight
  x1?: number; y1?: number; x2?: number; y2?: number;
  heading?: number;
  // curve
  cx?: number; cy?: number; radius?: number;
  startAngle?: number; endAngle?: number; counterclockwise?: boolean;
  // common
  color: string;
  dashed?: boolean;
  isMain?: boolean;
  // turnout marker
  dotX?: number; dotY?: number;
}

interface LayoutRenderData {
  commands: DrawCommand[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  routes: { id: string; name: string; color: string; commandCount: number }[];
}

function computeLayout(data: AILayoutData): LayoutRenderData {
  const commands: DrawCommand[] = [];
  const allPoints: { x: number; y: number }[] = [];
  const routeSummary: { id: string; name: string; color: string; commandCount: number }[] = [];

  // Track turnout positions: routeId -> turtle state at turnout
  const turnoutPositions: Map<string, { turtle: TurtleState; direction: "left" | "right" }> = new Map();

  function addPoint(x: number, y: number) {
    allPoints.push({ x, y });
  }

  function processRoute(route: AIRoute, startTurtle: TurtleState) {
    const isMain = route.id === "main";
    let turtle = { ...startTurtle };
    let inTunnel = false;

    for (const cmd of route.commands) {
      const cmdType = cmd[0];

      switch (cmdType) {
        case "straight": {
          const length = cmd[1] as number;
          const endX = turtle.x + Math.cos(turtle.heading) * length;
          const endY = turtle.y + Math.sin(turtle.heading) * length;
          commands.push({
            type: "straight",
            x1: turtle.x, y1: turtle.y,
            x2: endX, y2: endY,
            heading: turtle.heading,
            color: route.color,
            dashed: inTunnel,
            isMain,
          });
          addPoint(turtle.x, turtle.y);
          addPoint(endX, endY);
          turtle = { x: endX, y: endY, heading: turtle.heading };
          break;
        }

        case "curve": {
          const direction = cmd[1] as "left" | "right";
          const radius = cmd[2] as number;
          const angleDeg = cmd[3] as number;
          const angleRad = (angleDeg * Math.PI) / 180;
          const sign = direction === "right" ? 1 : -1;

          // Center of arc: perpendicular to heading direction
          const centerX = turtle.x + Math.cos(turtle.heading + sign * Math.PI / 2) * radius;
          const centerY = turtle.y + Math.sin(turtle.heading + sign * Math.PI / 2) * radius;

          // Start angle: from center back to current position
          const startAngle = Math.atan2(turtle.y - centerY, turtle.x - centerX);
          // For right turn: sweep clockwise (positive angle in canvas coords)
          // For left turn: sweep counterclockwise (negative angle)
          const endAngle = startAngle + sign * angleRad;

          // New position: on the circle at the end angle
          const newX = centerX + radius * Math.cos(endAngle);
          const newY = centerY + radius * Math.sin(endAngle);
          const newHeading = turtle.heading + sign * angleRad;

          // For ctx.arc: counterclockwise parameter
          // Right turn (sign=+1): we sweep from startAngle to endAngle where endAngle > startAngle
          //   → counterclockwise = false (draw clockwise)
          // Left turn (sign=-1): we sweep from startAngle to endAngle where endAngle < startAngle
          //   → counterclockwise = true (draw counterclockwise)
          commands.push({
            type: "curve",
            cx: centerX, cy: centerY, radius,
            startAngle, endAngle,
            counterclockwise: direction === "left",
            color: route.color,
            dashed: inTunnel,
            isMain,
          });

          // Add bounding points for the arc
          addPoint(turtle.x, turtle.y);
          addPoint(newX, newY);
          const steps = Math.max(4, Math.ceil(angleDeg / 15));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const a = startAngle + sign * angleRad * t;
            addPoint(centerX + radius * Math.cos(a), centerY + radius * Math.sin(a));
          }

          turtle = { x: newX, y: newY, heading: newHeading };
          break;
        }

        case "turnout": {
          const direction = cmd[1] as "left" | "right";
          const branchId = cmd[2] as string;

          // Mark the turnout point
          commands.push({
            type: "turnout_dot",
            dotX: turtle.x, dotY: turtle.y,
            color: route.color,
            isMain,
          });
          addPoint(turtle.x, turtle.y);

          // Save turtle state for branch route (before advancing)
          turnoutPositions.set(branchId, { turtle: { ...turtle }, direction });

          // Turnout acts as a short straight on the main route (~100mm)
          const tLen = 100;
          const endX = turtle.x + Math.cos(turtle.heading) * tLen;
          const endY = turtle.y + Math.sin(turtle.heading) * tLen;
          commands.push({
            type: "straight",
            x1: turtle.x, y1: turtle.y,
            x2: endX, y2: endY,
            heading: turtle.heading,
            color: route.color,
            dashed: inTunnel,
            isMain,
          });
          addPoint(endX, endY);
          turtle = { x: endX, y: endY, heading: turtle.heading };
          break;
        }

        case "tunnel_start": {
          inTunnel = true;
          break;
        }

        case "tunnel_end": {
          inTunnel = false;
          break;
        }
      }
    }

    routeSummary.push({
      id: route.id,
      name: route.name,
      color: route.color,
      commandCount: route.commands.filter(c => c[0] !== "tunnel_start" && c[0] !== "tunnel_end").length,
    });
  }

  // Process main route first
  const mainRoute = data.routes.find(r => r.id === "main") || data.routes[0];
  if (mainRoute) {
    processRoute(mainRoute, { x: 0, y: 0, heading: 0 });
  }

  // Process branch routes
  for (const route of data.routes) {
    if (route === mainRoute) continue;
    const turnoutInfo = turnoutPositions.get(route.id);
    if (turnoutInfo) {
      // Branch starts at turnout position with a diverging angle
      const divergeAngle = (15 * Math.PI) / 180;
      const sign = turnoutInfo.direction === "left" ? -1 : 1;
      const branchHeading = turnoutInfo.turtle.heading + sign * divergeAngle;
      processRoute(route, { ...turnoutInfo.turtle, heading: branchHeading });
    } else {
      // No turnout found — start at origin with offset
      processRoute(route, { x: 0, y: 200, heading: 0 });
    }
  }

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 600; }

  // Add some margin
  const pad = 60;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;

  return { commands, bounds: { minX, minY, maxX, maxY }, routes: routeSummary };
}

function drawTrackOnCanvas(
  canvas: HTMLCanvasElement,
  layoutData: LayoutRenderData,
  form: FormData,
  aiData: AILayoutData,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { commands, bounds } = layoutData;
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;

  // Compute scale to fit canvas with padding
  const canvasPad = 50;
  const availW = displayWidth - canvasPad * 2;
  const availH = displayHeight - canvasPad * 2 - 60; // leave space for legend
  const scaleX = availW / contentW;
  const scaleY = availH / contentH;
  const drawScale = Math.min(scaleX, scaleY);

  // Center offset
  const offsetX = canvasPad + (availW - contentW * drawScale) / 2 - bounds.minX * drawScale;
  const offsetY = canvasPad + (availH - contentH * drawScale) / 2 - bounds.minY * drawScale;

  // Transform: world coords -> canvas coords
  function tx(x: number) { return x * drawScale + offsetX; }
  function ty(y: number) { return y * drawScale + offsetY; }

  // Clear with dark background
  ctx.fillStyle = "#1a1b2e";
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  // Draw subtle grid
  const gridStep = 100; // mm
  const gridStartX = Math.floor(bounds.minX / gridStep) * gridStep;
  const gridStartY = Math.floor(bounds.minY / gridStep) * gridStep;
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let gx = gridStartX; gx <= bounds.maxX; gx += gridStep) {
    for (let gy = gridStartY; gy <= bounds.maxY; gy += gridStep) {
      ctx.beginPath();
      ctx.arc(tx(gx), ty(gy), 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Helper: draw sleepers along a straight
  function drawSleepers(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, heading: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6) return;
    const perpX = -Math.sin(heading);
    const perpY = Math.cos(heading);
    const spacing = 20 * drawScale; // every 20 scaled units
    const count = Math.max(1, Math.floor(len / spacing));
    const halfW = 6 * drawScale;

    c.strokeStyle = "#555";
    c.lineWidth = 1;
    c.globalAlpha = 0.25;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      c.beginPath();
      c.moveTo(px - perpX * halfW, py - perpY * halfW);
      c.lineTo(px + perpX * halfW, py + perpY * halfW);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Helper: draw sleepers along an arc
  function drawArcSleepers(c: CanvasRenderingContext2D, cxW: number, cyW: number, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean) {
    let angleDiff = endAngle - startAngle;
    if (!counterclockwise && angleDiff < 0) angleDiff += Math.PI * 2;
    if (counterclockwise && angleDiff > 0) angleDiff -= Math.PI * 2;
    const arcLen = Math.abs(angleDiff) * radius * drawScale;
    const spacing = 20;
    const count = Math.max(1, Math.floor(arcLen / spacing));
    const halfW = 6 * drawScale;

    c.strokeStyle = "#555";
    c.lineWidth = 1;
    c.globalAlpha = 0.25;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const a = startAngle + angleDiff * t;
      const px = tx(cxW + radius * Math.cos(a));
      const py = ty(cyW + radius * Math.sin(a));
      // Radial direction for sleeper
      const nx = Math.cos(a) * halfW;
      const ny = Math.sin(a) * halfW;
      c.beginPath();
      c.moveTo(px - nx, py - ny);
      c.lineTo(px + nx, py + ny);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Draw all commands
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const cmd of commands) {
    const trackWidth = cmd.isMain ? 4 : 3;

    switch (cmd.type) {
      case "straight": {
        const sx = tx(cmd.x1!);
        const sy = ty(cmd.y1!);
        const ex = tx(cmd.x2!);
        const ey = ty(cmd.y2!);

        // Sleepers
        if (!cmd.dashed) {
          drawSleepers(ctx, sx, sy, ex, ey, cmd.heading!);
        }

        // Track line
        ctx.strokeStyle = cmd.color;
        ctx.lineWidth = trackWidth;
        if (cmd.dashed) {
          ctx.setLineDash([8, 5]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case "curve": {
        const cxCanvas = tx(cmd.cx!);
        const cyCanvas = ty(cmd.cy!);
        const rCanvas = cmd.radius! * drawScale;

        // Sleepers
        if (!cmd.dashed) {
          drawArcSleepers(ctx, cmd.cx!, cmd.cy!, cmd.radius!, cmd.startAngle!, cmd.endAngle!, !!cmd.counterclockwise);
        }

        // Arc
        ctx.strokeStyle = cmd.color;
        ctx.lineWidth = trackWidth;
        if (cmd.dashed) {
          ctx.setLineDash([8, 5]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.arc(cxCanvas, cyCanvas, rCanvas, cmd.startAngle!, cmd.endAngle!, !!cmd.counterclockwise);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case "turnout_dot": {
        const dx = tx(cmd.dotX!);
        const dy = ty(cmd.dotY!);
        // Outer ring
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(dx, dy, 7, 0, Math.PI * 2);
        ctx.stroke();
        // Inner dot
        ctx.fillStyle = cmd.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  // Draw legend at bottom
  const legendY = displayHeight - 35;
  const legendRoutes = aiData.routes;

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("LEGENDA", 20, legendY - 8);

  let legendX = 20;
  ctx.font = "11px system-ui, sans-serif";
  for (const route of legendRoutes) {
    // Color line
    ctx.strokeStyle = route.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 5);
    ctx.lineTo(legendX + 24, legendY + 5);
    ctx.stroke();
    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillText(route.name, legendX + 30, legendY + 9);
    legendX += ctx.measureText(route.name).width + 50;
  }

  // Board dimensions + scale label at bottom right
  const dimLabel = `${form.width} × ${form.height} cm`;
  const scaleLabel = `${form.scale} (1:${SCALE_FACTOR[form.scale]}) · ${TRACK_CATALOGS[form.trackSystem].name}`;

  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.textAlign = "right";
  ctx.fillText(dimLabel, displayWidth - 20, legendY);
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillText(scaleLabel, displayWidth - 20, legendY + 16);
  ctx.textAlign = "left";
}

/* ===========================
   CANVAS COMPONENT
   =========================== */
function TrackCanvas({
  layoutData,
  aiData,
  form,
}: {
  layoutData: LayoutRenderData;
  aiData: AILayoutData;
  form: FormData;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawTrackOnCanvas(canvas, layoutData, form, aiData);

    const handleResize = () => {
      drawTrackOnCanvas(canvas, layoutData, form, aiData);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [layoutData, aiData, form]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "600px",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        display: "block",
      }}
    />
  );
}

/* ===========================
   MAIN PAGE
   =========================== */
export default function TrackDesignerPage() {
  const [form, setForm] = useState<FormData>({
    boardShape: "rectangle",
    width: 200,
    height: 100,
    width2: 80,
    height2: 60,
    lCorner: "bottom-right",
    uArmDepth: 40,
    scale: "H0",
    trackSystem: "roco-line",
    character: "prujezdna-stanice",
    prompt: "",
  });
  const [aiData, setAiData] = useState<AILayoutData | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutRenderData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setAiData(null);
    setLayoutData(null);

    try {
      const res = await fetch("/api/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: form.prompt,
          boardShape: form.boardShape,
          width: form.width,
          height: form.height,
          width2: form.width2,
          height2: form.height2,
          uArmDepth: form.uArmDepth,
          lCorner: form.lCorner,
          scale: form.scale,
          trackSystem: form.trackSystem,
          character: form.character,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || `Chyba serveru (${res.status})`);
        return;
      }

      const data: AILayoutData = json.result;
      setAiData(data);

      // Compute layout geometry
      const rendered = computeLayout(data);
      setLayoutData(rendered);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setError("Chyba při komunikaci se serverem: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }, [form]);

  const update = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-input)",
    borderRadius: "8px",
    color: "var(--text-body)",
    fontSize: "14px",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8ea0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "36px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: "6px",
    display: "block",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "24px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-hero-start) 0%, var(--bg-hero-mid) 50%, var(--bg-hero-end) 100%)",
          padding: "48px 20px 40px",
          textAlign: "center",
          borderBottom: "1px solid var(--border)",
          position: "relative",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🛤️</div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Návrhář tratí
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-dim)", maxWidth: "500px", margin: "0 auto" }}>
          AI navrhne koncept kolejiště, renderer ho vykreslí s přesnou geometrií
        </p>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Form */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
            ⚙️ Parametry kolejiště
          </h2>

          {/* Board shape selector */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Tvar desky</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {BOARD_SHAPES.map((bs) => (
                <button
                  key={bs.value}
                  onClick={() => update("boardShape", bs.value)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: `2px solid ${form.boardShape === bs.value ? "var(--accent)" : "var(--border)"}`,
                    background: form.boardShape === bs.value ? "var(--accent-bg)" : "var(--bg-input)",
                    color: form.boardShape === bs.value ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: form.boardShape === bs.value ? 700 : 500,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ marginRight: "6px" }}>{bs.icon}</span>
                  {bs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={labelStyle}>
                {form.boardShape === "rectangle" ? "Šířka desky (cm)" : "Šířka hlavní části (cm)"}
              </label>
              <input
                type="number" value={form.width}
                onChange={(e) => update("width", Number(e.target.value))}
                min={60} max={600} style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                {form.boardShape === "rectangle" ? "Hloubka desky (cm)" : "Hloubka hlavní části (cm)"}
              </label>
              <input
                type="number" value={form.height}
                onChange={(e) => update("height", Number(e.target.value))}
                min={40} max={400} style={inputStyle}
              />
            </div>

            {form.boardShape === "l-shape" && (
              <>
                <div>
                  <label style={labelStyle}>Šířka ramene L (cm)</label>
                  <input
                    type="number" value={form.width2}
                    onChange={(e) => update("width2", Number(e.target.value))}
                    min={30} max={300} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Hloubka ramene L (cm)</label>
                  <input
                    type="number" value={form.height2}
                    onChange={(e) => update("height2", Number(e.target.value))}
                    min={30} max={300} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Roh L</label>
                  <select
                    value={form.lCorner}
                    onChange={(e) => update("lCorner", e.target.value as LCorner)}
                    style={selectStyle}
                  >
                    {L_CORNERS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {form.boardShape === "u-shape" && (
              <div>
                <label style={labelStyle}>Hloubka ramen U (cm)</label>
                <input
                  type="number" value={form.uArmDepth}
                  onChange={(e) => update("uArmDepth", Number(e.target.value))}
                  min={20} max={200} style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Scale & Track system */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label style={labelStyle}>Měřítko</label>
              <select value={form.scale} onChange={(e) => update("scale", e.target.value as Scale)} style={selectStyle}>
                <option value="H0">H0 (1:87)</option>
                <option value="TT">TT (1:120)</option>
                <option value="N">N (1:160)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Systém kolejí</label>
              <select value={form.trackSystem} onChange={(e) => update("trackSystem", e.target.value as TrackSystem)} style={selectStyle}>
                <option value="roco-line">ROCO GeoLine</option>
                <option value="roco-geo">ROCO Line</option>
                <option value="piko-a">PIKO A</option>
                <option value="fleischmann">Fleischmann Profi</option>
                <option value="tillig">Tillig (TT)</option>
              </select>
            </div>
          </div>

          {/* Layout character picker */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Charakter tratě</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "10px" }}>
              {CHARACTER_OPTIONS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => update("character", ch.value)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: "10px",
                    border: `2px solid ${form.character === ch.value ? "var(--accent)" : "var(--border)"}`,
                    background: form.character === ch.value ? "var(--accent-bg)" : "var(--bg-input)",
                    color: form.character === ch.value ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: form.character === ch.value ? 700 : 500,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "4px" }}>{ch.icon}</div>
                  <div>{ch.label}</div>
                  <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.7, fontWeight: 400 }}>{ch.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* User prompt */}
          <div style={{ marginBottom: "28px" }}>
            <label style={labelStyle}>Vlastní požadavky (volitelné)</label>
            <textarea
              value={form.prompt}
              onChange={(e) => update("prompt", e.target.value)}
              placeholder="Např.: chci horskou trať s tunelem a malou stanicí, dvě smyčky propojené mostem..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "10px",
              border: "none",
              background: generating ? "var(--border-hover)" : "linear-gradient(135deg, #667eea, #764ba2)",
              color: generating ? "var(--text-dim)" : "#fff",
              fontSize: "17px",
              fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.3px",
            }}
          >
            {generating ? (
              <span>
                <span style={{
                  display: "inline-block",
                  animation: "trainMove 2s linear infinite",
                }}>
                  🚂
                </span>
                {" "}AI navrhuje kolejiště...
              </span>
            ) : (
              "🤖 Navrhnout kolejiště"
            )}
          </button>

          {/* Train animation keyframes */}
          {generating && (
            <style>{`
              @keyframes trainMove {
                0% { transform: translateX(-20px); }
                50% { transform: translateX(20px); }
                100% { transform: translateX(-20px); }
              }
            `}</style>
          )}
        </div>

        {/* Results area */}
        <div ref={resultRef} style={{ marginTop: "32px" }}>
          {/* Error */}
          {error && (
            <div style={{ ...cardStyle, marginBottom: "20px", borderColor: "rgba(244, 67, 54, 0.4)" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f44336", marginBottom: "12px" }}>
                ❌ Chyba
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {error}
              </p>
              <button
                onClick={handleGenerate}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-body)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                🔄 Zkusit znovu
              </button>
            </div>
          )}

          {/* Results */}
          {aiData && layoutData && (
            <>
              {/* Layout name */}
              <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                  🚂 {aiData.name}
                </h2>
              </div>

              {/* Canvas Track Plan */}
              <div style={{ ...cardStyle, marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", textAlign: "left" }}>
                  📐 Kolejový plán
                </h2>
                <TrackCanvas layoutData={layoutData} aiData={aiData} form={form} />
              </div>

              {/* BOM notes from AI */}
              {aiData.bom_notes && (
                <div style={{ ...cardStyle, marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                    🛒 Odhad materiálu (AI)
                  </h2>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {aiData.bom_notes}
                  </p>
                </div>
              )}

              {/* Route details */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                  🗂️ Trasy
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Barva", "Název", "Typ", "Příkazy"].map((header, hi) => (
                          <th key={hi} style={{
                            textAlign: hi === 3 ? "center" : "left",
                            padding: "10px 12px",
                            borderBottom: "2px solid var(--border)",
                            color: "var(--accent)",
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.5px",
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {layoutData.routes.map((route, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light, var(--border))" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{
                              width: "20px",
                              height: "4px",
                              borderRadius: "2px",
                              background: route.color,
                            }} />
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "14px", color: "var(--text-body)", fontWeight: 600 }}>
                            {route.name}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-dim)" }}>
                            {route.id === "main" ? "Hlavní" : "Odbočka"}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "16px", fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>
                            {route.commandCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{
                  marginTop: "16px", paddingTop: "12px",
                  borderTop: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>Celkem tras</span>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {layoutData.routes.length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
