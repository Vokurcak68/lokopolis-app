/**
 * Render track layout as SVG to visually verify connections
 */

import { computeLayout, layoutResultToAPIResponse } from "../src/lib/track-layout-engine";
import { TEMPLATES, getTemplateLayout } from "../src/lib/track-templates";
import { getTrackPiece, type TrackScale } from "../src/lib/track-library";
import { connectionToWorld } from "../src/lib/track-designer-store";
import { writeFileSync } from "fs";

function renderLayoutSVG(templateId: string, scale: TrackScale): string {
  const layout = getTemplateLayout(templateId, scale);
  if (!layout) return "";
  
  const boardW = scale === "TT" ? 200 : 250;
  const boardD = scale === "TT" ? 100 : 120;
  const result = computeLayout(layout, scale, boardW, boardD);
  const apiTracks = layoutResultToAPIResponse(result);
  
  const boardWmm = boardW * 10;
  const boardDmm = boardD * 10;
  
  // SVG with padding
  const padding = 50;
  const svgW = boardWmm + padding * 2;
  const svgH = boardDmm + padding * 2;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#1a1a2e"/>`;
  svg += `<rect x="${padding}" y="${padding}" width="${boardWmm}" height="${boardDmm}" fill="#2a4a2a" stroke="#4a6a4a" stroke-width="2"/>`;
  
  // Draw each track
  for (let i = 0; i < apiTracks.length; i++) {
    const t = apiTracks[i];
    const piece = getTrackPiece(t.pieceId);
    if (!piece) continue;
    
    // Draw from connection A to connection B
    const connA = piece.connections.find(c => c.id === "a");
    const connB = piece.connections.find(c => c.id === "b");
    if (!connA || !connB) continue;
    
    const worldA = connectionToWorld(connA, { x: t.x, y: 0, z: t.z }, t.rotation);
    const worldB = connectionToWorld(connB, { x: t.x, y: 0, z: t.z }, t.rotation);
    
    const x1 = worldA.position.x + padding;
    const y1 = worldA.position.z + padding;
    const x2 = worldB.position.x + padding;
    const y2 = worldB.position.z + padding;
    
    // Color: straight=white, curve=yellow, turnout=orange, branch pieces after mainLoop = cyan
    const mainCount = (layout.mainLoop || []).length;
    let color = "#ffffff";
    if (i >= mainCount) color = "#00ccff"; // branch
    else if (piece.type === "curve") color = "#ffcc00";
    else if (piece.type === "turnout") color = "#ff6600";
    
    if (piece.type === "curve") {
      // For curves, draw an arc path using intermediate points
      const steps = Math.ceil(piece.angle! / 5);
      let path = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        // Interpolate along the curve
        const angleRad = (piece.angle! * Math.PI / 180) * frac;
        const localX = piece.radius! * Math.sin(angleRad);
        const localZ = piece.radius! - piece.radius! * Math.cos(angleRad);
        const cos = Math.cos(t.rotation);
        const sin = Math.sin(t.rotation);
        const wx = t.x + localX * cos - localZ * sin + padding;
        const wz = t.z + localX * sin + localZ * cos + padding;
        path += ` L ${wx.toFixed(1)} ${wz.toFixed(1)}`;
      }
      svg += `<path d="${path}" stroke="${color}" stroke-width="3" fill="none" opacity="0.9"/>`;
    } else {
      svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="3" opacity="0.9"/>`;
    }
    
    // Draw turnout branch
    if (piece.type === "turnout") {
      const connC = piece.connections.find(c => c.id === "c");
      if (connC) {
        const worldC = connectionToWorld(connC, { x: t.x, y: 0, z: t.z }, t.rotation);
        const x3 = worldC.position.x + padding;
        const y3 = worldC.position.z + padding;
        svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x3.toFixed(1)}" y2="${y3.toFixed(1)}" stroke="#ff3300" stroke-width="2" stroke-dasharray="4,4" opacity="0.7"/>`;
      }
    }
    
    // Connection point markers
    svg += `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2" fill="#00ff00" opacity="0.5"/>`;
    svg += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2" fill="#ff0000" opacity="0.5"/>`;
  }
  
  // Title
  const template = TEMPLATES.find(t => t.id === templateId);
  svg += `<text x="${svgW/2}" y="20" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif">${template?.nameCs || templateId} (${scale}) — ${apiTracks.length} tracks, gap: ${result.loopGapMm.toFixed(4)}mm</text>`;
  
  svg += `</svg>`;
  return svg;
}

// Generate SVGs for all templates
const templates = ["simple-oval", "oval-with-siding", "figure-eight", "station-with-yard", "mountain-loop", "industrial-spur"];
const scales: TrackScale[] = ["TT", "H0"];

let html = `<!DOCTYPE html><html><head><title>Layout Test</title><style>body{background:#111;color:white;font-family:sans-serif;} .grid{display:flex;flex-wrap:wrap;gap:20px;padding:20px;} .item{border:1px solid #333;padding:10px;}</style></head><body><h1>Track Layout Visual Test</h1><div class="grid">`;

for (const tmpl of templates) {
  for (const scale of scales) {
    const svg = renderLayoutSVG(tmpl, scale);
    if (svg) {
      html += `<div class="item">${svg}</div>`;
    }
  }
}

html += `</div></body></html>`;

writeFileSync("/tmp/layout-test.html", html);
console.log("Written to /tmp/layout-test.html");

// Also write individual SVGs
for (const tmpl of templates) {
  const svg = renderLayoutSVG(tmpl, "TT");
  if (svg) {
    writeFileSync(`/tmp/layout-${tmpl}-TT.svg`, svg);
    console.log(`Written /tmp/layout-${tmpl}-TT.svg`);
  }
}
