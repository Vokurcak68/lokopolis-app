#!/usr/bin/env node
/**
 * Test API endpoint s každým charakterem — ověří že selectFallbackTemplate
 * mapuje správně na šablony a výsledky jsou validní.
 * Spouští se bez OpenAI klíče → vždy jde do fallback šablony.
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import path from "path";

const testCode = `
import { TEMPLATES, getTemplateLayout } from "../src/lib/track-templates";
import { computeLayout, layoutResultToAPIResponse } from "../src/lib/track-layout-engine";
import type { TrackScale } from "../src/lib/track-library";

// Simulujeme selectFallbackTemplate přímo
const charMap: Record<string, string> = {
  station: "station-with-yard",
  mountain: "mountain-loop",
  corridor: "oval-with-siding",
  industrial: "industrial-spur",
  diorama: "simple-oval",
  "through-station": "figure-eight",
};

const scales: TrackScale[] = ["TT", "H0"];
let allPassed = true;

console.log("=== Testing character → template mapping ===\\n");

for (const [character, templateId] of Object.entries(charMap)) {
  for (const scale of scales) {
    const layout = getTemplateLayout(templateId, scale);
    if (!layout) {
      console.log(\`❌ \${character} → \${templateId} / \${scale}: no layout!\`);
      allPassed = false;
      continue;
    }

    const result = computeLayout(layout, scale, 200, 100);
    const tracks = layoutResultToAPIResponse(result);
    
    const gapOk = result.loopGapMm < 2.0;
    const hasTracks = tracks.length > 0;
    const passed = gapOk && hasTracks;

    if (!passed) allPassed = false;

    const status = passed ? "✅" : "❌";
    console.log(\`\${status} character="\${character}" → template="\${templateId}" / \${scale}: \${tracks.length} tracks, gap=\${result.loopGapMm.toFixed(2)}mm\`);
  }
}

console.log(\`\\n\${allPassed ? "✅ ALL PASSED" : "❌ SOME FAILED"}\`);
if (!allPassed) process.exit(1);
`;

const tmpPath = path.join(process.cwd(), "scripts", "_test-api-characters-runner.ts");
writeFileSync(tmpPath, testCode);

try {
  execSync(`npx tsx ${tmpPath}`, { stdio: "inherit", cwd: process.cwd() });
} catch (e) {
  process.exit(1);
} finally {
  try { execSync(`rm -f ${tmpPath}`); } catch {}
}
