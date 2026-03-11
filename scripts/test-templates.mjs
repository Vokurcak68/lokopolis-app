#!/usr/bin/env node
/**
 * Test script — ověřuje že všechny šablony:
 * 1. Mají uzavřenou smyčku (loopGapMm < 2mm)
 * 2. Mají hasClosedLoop = true
 * 3. Nemají žádné warnings o neznámých piece IDs
 * 4. Mají více než 0 kolejí
 *
 * Spustit: node scripts/test-templates.mjs
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, unlinkSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const testCode = `
import { TEMPLATES, getTemplateLayout } from "./src/lib/track-templates";
import { computeLayout } from "./src/lib/track-layout-engine";
import type { TrackScale } from "./src/lib/track-library";

const scales: TrackScale[] = ["TT", "H0"];
let allPassed = true;
let totalTests = 0;
let passedTests = 0;

console.log("\\n╔════════════════════════════════════════════════════════╗");
console.log("║         TEMPLATE VERIFICATION TEST SUITE v2            ║");
console.log("╚════════════════════════════════════════════════════════╝\\n");

for (const template of TEMPLATES) {
  console.log(\`📐 \${template.nameCs} (\${template.id})\`);
  
  for (const scale of scales) {
    const layout = getTemplateLayout(template.id, scale);
    if (!layout) {
      console.log(\`   ⚠️  [\${scale}] No layout defined — skipping\`);
      continue;
    }

    totalTests++;
    
    // Test with standard board sizes
    const boardW = scale === "TT" ? 150 : 200;
    const boardD = scale === "TT" ? 80 : 100;
    
    const result = computeLayout(layout, scale, boardW, boardD);

    const prefix = \`   [\${scale}]\`;
    const issues: string[] = [];

    // Check 1: Loop gap < 1mm (strict)
    if (result.loopGapMm > 1.0) {
      issues.push(\`gap=\${result.loopGapMm.toFixed(2)}mm (max 1mm)\`);
    }

    // Check 2: Has closed loop
    if (!result.hasClosedLoop) {
      issues.push("no closed loop detected");
    }

    // Check 3: Track count > 0
    if (result.tracks.length === 0) {
      issues.push("0 tracks placed");
    }

    // Check 4: No unknown piece IDs
    const pieceWarnings = result.warnings.filter(w => w.includes("unknown pieceId"));
    if (pieceWarnings.length > 0) {
      issues.push(\`unknown pieces: \${pieceWarnings.join(", ")}\`);
    }

    // Check 5: No scale mismatches
    const scaleWarnings = result.warnings.filter(w => w.includes("expected"));
    if (scaleWarnings.length > 0) {
      issues.push(\`scale mismatch: \${scaleWarnings.join(", ")}\`);
    }

    // Check 6: Board fit (at least 50% of pieces should be within board bounds)
    const boardWmm = boardW * 10;
    const boardDmm = boardD * 10;
    const inBounds = result.tracks.filter(t => 
      t.position.x >= -50 && t.position.x <= boardWmm + 50 &&
      t.position.z >= -50 && t.position.z <= boardDmm + 50
    ).length;
    const fitPercent = result.tracks.length > 0 ? (inBounds / result.tracks.length * 100) : 0;
    if (fitPercent < 50) {
      issues.push(\`only \${fitPercent.toFixed(0)}% tracks on board\`);
    }

    if (issues.length === 0) {
      console.log(\`\${prefix} ✅ gap=\${result.loopGapMm.toFixed(2)}mm, tracks=\${result.tracks.length}, closed=YES, fit=\${fitPercent.toFixed(0)}%\`);
      passedTests++;
    } else {
      console.log(\`\${prefix} ❌ \${issues.join(" | ")}\`);
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.log(\`\${prefix}    ⚠ \${w}\`);
        }
      }
      allPassed = false;
    }
  }
  console.log("");
}

console.log("═".repeat(56));
console.log(\`  Results: \${passedTests}/\${totalTests} tests passed\`);
console.log("═".repeat(56));

if (!allPassed) {
  console.log("\\n❌ SOME TESTS FAILED\\n");
  process.exit(1);
} else {
  console.log("\\n✅ ALL TESTS PASSED\\n");
}
`;

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
