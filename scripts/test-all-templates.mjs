#!/usr/bin/env node
/**
 * Test ALL šablony — spustí layout engine pro každou šablonu a ověří:
 * - Loop je uzavřený (gap < 2mm)
 * - Žádné warningy
 * - Počet kolejí > 0
 */

// Dynamický import — potřebujeme TypeScript support
import { execSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import path from "path";

// Compile the test via tsx
const testCode = `
import { TEMPLATES, getTemplateLayout } from "../src/lib/track-templates";
import { computeLayout } from "../src/lib/track-layout-engine";
import type { TrackScale } from "../src/lib/track-library";

const scales: TrackScale[] = ["TT", "H0"];
let allPassed = true;
let totalTests = 0;
let failedTests = 0;

console.log("=== Testing ALL templates ===\\n");

for (const template of TEMPLATES) {
  for (const scale of scales) {
    const layout = getTemplateLayout(template.id, scale);
    if (!layout) {
      console.log(\`⏭️  \${template.id} / \${scale}: no layout defined — SKIPPED\`);
      continue;
    }

    totalTests++;
    const result = computeLayout(layout, scale, 200, 100);
    
    const gapOk = result.loopGapMm < 2.0;
    const noWarnings = result.warnings.length === 0;
    const hasTracks = result.tracks.length > 0;
    const passed = gapOk && noWarnings && hasTracks;

    if (!passed) {
      allPassed = false;
      failedTests++;
    }

    const status = passed ? "✅" : "❌";
    console.log(\`\${status} \${template.id} / \${scale}: \${result.tracks.length} tracks, gap=\${result.loopGapMm.toFixed(2)}mm, closed=\${result.loopClosed}\`);

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.log(\`   ⚠️  \${w}\`);
      }
    }

    if (!gapOk) {
      console.log(\`   ❌ Gap too large: \${result.loopGapMm.toFixed(2)}mm (max 2mm)\`);
    }

    // Check branches
    const mainTrackCount = layout.mainLoop.length;
    const branchTrackCount = result.tracks.length - mainTrackCount;
    if (layout.branches.length > 0) {
      console.log(\`   📌 Main: \${mainTrackCount} tracks, Branches: \${branchTrackCount} tracks (\${layout.branches.length} branches)\`);
    }
  }
}

console.log(\`\\n=== Results: \${totalTests - failedTests}/\${totalTests} passed ===\`);
if (!allPassed) {
  process.exit(1);
}
`;

const tmpPath = path.join(process.cwd(), "scripts", "_test-all-templates-runner.ts");
writeFileSync(tmpPath, testCode);

try {
  execSync(`npx tsx ${tmpPath}`, { stdio: "inherit", cwd: process.cwd() });
} catch (e) {
  process.exit(1);
} finally {
  // Clean up temp file
  try { execSync(`rm -f ${tmpPath}`); } catch {}
}
