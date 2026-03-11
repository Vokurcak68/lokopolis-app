#!/usr/bin/env node
/**
 * Test script — ověřuje že všechny šablony:
 * 1. Mají uzavřenou smyčku (loopGapMm < 2mm)
 * 2. Mají hasClosedLoop = true
 * 3. Nemají žádné warnings o neznámých piece IDs
 *
 * Spustit: node scripts/test-templates.mjs
 */

// We need to use the compiled output. Run build first!
// Instead, we'll do a quick tsx eval.

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Use tsx to run TypeScript directly
const testCode = `
import { TEMPLATES, getTemplateLayout } from "./src/lib/track-templates";
import { computeLayout } from "./src/lib/track-layout-engine";
import type { TrackScale } from "./src/lib/track-library";

const scales: TrackScale[] = ["TT", "H0"];
let allPassed = true;
let totalTests = 0;
let passedTests = 0;

for (const template of TEMPLATES) {
  for (const scale of scales) {
    const layout = getTemplateLayout(template.id, scale);
    if (!layout) continue;

    totalTests++;
    const result = computeLayout(layout, scale, 150, 80);

    const prefix = \`[\${scale}] \${template.id}\`;
    const issues: string[] = [];

    if (result.loopGapMm > 2.0) {
      issues.push(\`gap=\${result.loopGapMm.toFixed(2)}mm (max 2mm)\`);
    }

    if (!result.loopClosed) {
      issues.push("loop NOT closed");
    }

    if (!result.hasClosedLoop) {
      issues.push("no closed loop detected");
    }

    const pieceWarnings = result.warnings.filter(w => w.includes("unknown pieceId"));
    if (pieceWarnings.length > 0) {
      issues.push(\`unknown pieces: \${pieceWarnings.join(", ")}\`);
    }

    if (issues.length === 0) {
      console.log(\`✅ \${prefix}: gap=\${result.loopGapMm.toFixed(2)}mm, tracks=\${result.tracks.length}, loop=closed\`);
      passedTests++;
    } else {
      console.log(\`❌ \${prefix}: \${issues.join(" | ")}\`);
      if (result.warnings.length > 0) {
        console.log(\`   warnings: \${result.warnings.join(", ")}\`);
      }
      allPassed = false;
    }
  }
}

console.log(\`\\n=== \${passedTests}/\${totalTests} tests passed ===\`);
if (!allPassed) {
  process.exit(1);
}
`;

// Write temp file and run with tsx
import { writeFileSync, unlinkSync } from "fs";

const tmpFile = join(projectRoot, "_test_templates_tmp.ts");
writeFileSync(tmpFile, testCode);

try {
  const result = execSync(`npx tsx ${tmpFile}`, {
    cwd: projectRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
  });
  console.log(result);
} catch (err) {
  console.log(err.stdout || "");
  console.error(err.stderr || "");
  process.exit(1);
} finally {
  try { unlinkSync(tmpFile); } catch {}
}
