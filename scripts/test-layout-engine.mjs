#!/usr/bin/env node

/**
 * Test script for the deterministic layout engine.
 *
 * This uses tsx to run TypeScript directly so we can import
 * from our source files.
 *
 * Usage: npx tsx scripts/test-layout-engine.mjs
 */

// We need to transpile TS on the fly
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Build a temporary test file that imports from our TS sources
const testCode = `
import { computeLayout, type LayoutDefinition, type LayoutResult } from "../src/lib/track-layout-engine";
import { getTemplateLayout, TEMPLATES } from "../src/lib/track-templates";
import type { TrackScale } from "../src/lib/track-library";

function printResult(name: string, result: LayoutResult) {
  console.log("\\n" + "=".repeat(60));
  console.log("TEST:", name);
  console.log("=".repeat(60));
  console.log("  Tracks placed:", result.tracks.length);
  console.log("  Loop gap:", result.loopGapMm.toFixed(2), "mm");
  console.log("  Loop closed:", result.loopClosed ? "✅ YES" : "❌ NO");

  if (result.warnings.length > 0) {
    console.log("  Warnings:");
    for (const w of result.warnings) {
      console.log("    ⚠️", w);
    }
  }

  if (result.debugInfo.length > 0) {
    console.log("  Debug:");
    for (const d of result.debugInfo) {
      console.log("    →", d);
    }
  }

  // Print first and last track positions
  if (result.tracks.length > 0) {
    const first = result.tracks[0];
    const last = result.tracks[result.tracks.length - 1];
    console.log("  First track:", first.pieceId, "at", \`(\${first.position.x.toFixed(1)}, \${first.position.z.toFixed(1)})\`, "rot=", ((first.rotation * 180) / Math.PI).toFixed(1) + "°");
    console.log("  Last track:", last.pieceId, "at", \`(\${last.position.x.toFixed(1)}, \${last.position.z.toFixed(1)})\`, "rot=", ((last.rotation * 180) / Math.PI).toFixed(1) + "°");
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log("  ✅", msg);
  } else {
    failed++;
    console.log("  ❌ FAIL:", msg);
  }
}

// ========================================
// Test 1: TT Simple Oval
// ========================================
console.log("\\n\\n🧪 Running layout engine tests...\\n");

{
  const layout = getTemplateLayout("simple-oval", "TT");
  if (!layout) {
    console.log("❌ Could not find TT simple-oval template");
    process.exit(1);
  }
  const result = computeLayout(layout, "TT", 200, 100);
  printResult("TT Simple Oval (200×100cm)", result);
  assert(result.tracks.length > 0, "Has tracks");
  assert(result.loopGapMm < 2, \`Loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);
  assert(result.warnings.length === 0, "No warnings");
}

// ========================================
// Test 2: H0 Simple Oval
// ========================================
{
  const layout = getTemplateLayout("simple-oval", "H0");
  if (!layout) {
    console.log("❌ Could not find H0 simple-oval template");
    process.exit(1);
  }
  const result = computeLayout(layout, "H0", 250, 150);
  printResult("H0 Simple Oval (250×150cm)", result);
  assert(result.tracks.length > 0, "Has tracks");
  assert(result.loopGapMm < 2, \`Loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);
  assert(result.warnings.length === 0, "No warnings");
}

// ========================================
// Test 3: TT Oval with Siding
// ========================================
{
  const layout = getTemplateLayout("oval-with-siding", "TT");
  if (!layout) {
    console.log("❌ Could not find TT oval-with-siding template");
    process.exit(1);
  }
  const result = computeLayout(layout, "TT", 250, 120);
  printResult("TT Oval with Siding (250×120cm)", result);
  assert(result.tracks.length > 0, "Has tracks");
  // Main loop should close
  assert(result.loopGapMm < 2, \`Main loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);

  // Check that branch tracks exist
  const branchTracks = result.tracks.filter(t => t.instanceId.includes("branch"));
  assert(branchTracks.length > 0, \`Has branch tracks (\${branchTracks.length} pieces)\`);
}

// ========================================
// Test 4: H0 Oval with Siding
// ========================================
{
  const layout = getTemplateLayout("oval-with-siding", "H0");
  if (!layout) {
    console.log("❌ Could not find H0 oval-with-siding template");
    process.exit(1);
  }
  const result = computeLayout(layout, "H0", 300, 150);
  printResult("H0 Oval with Siding (300×150cm)", result);
  assert(result.tracks.length > 0, "Has tracks");
  assert(result.loopGapMm < 2, \`Main loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);
}

// ========================================
// Test 5: TT Mountain Loop
// ========================================
{
  const layout = getTemplateLayout("mountain-loop", "TT");
  if (!layout) {
    console.log("❌ Could not find TT mountain-loop template");
    process.exit(1);
  }
  const result = computeLayout(layout, "TT", 200, 100);
  printResult("TT Mountain Loop (200×100cm)", result);
  assert(result.tracks.length > 0, "Has tracks");
  assert(result.loopGapMm < 2, \`Loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);

  // Check tunnel and bridge markers
  const tunnelTracks = result.tracks.filter(t => t.isTunnel);
  const bridgeTracks = result.tracks.filter(t => t.isBridge);
  assert(tunnelTracks.length > 0, \`Has tunnel tracks (\${tunnelTracks.length})\`);
  assert(bridgeTracks.length > 0, \`Has bridge tracks (\${bridgeTracks.length})\`);
}

// ========================================
// Test 6: TT Industrial Spur
// ========================================
{
  const layout = getTemplateLayout("industrial-spur", "TT");
  if (!layout) {
    console.log("❌ Could not find TT industrial-spur template");
    process.exit(1);
  }
  const result = computeLayout(layout, "TT", 200, 100);
  printResult("TT Industrial Spur (200×100cm)", result);
  assert(result.tracks.length > 0, "Has tracks");
  assert(result.loopGapMm < 2, \`Loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);

  const branchTracks = result.tracks.filter(t => t.instanceId.includes("branch"));
  assert(branchTracks.length > 0, \`Has spur tracks (\${branchTracks.length})\`);
}

// ========================================
// Test 7: Custom layout — pure programmatic
// ========================================
{
  // Build a minimal TT oval: 2 straights + 24 R1-15° curves
  const customLayout: LayoutDefinition = {
    mainLoop: [
      { pieceId: "tt-g1" },
      ...Array.from({ length: 12 }, () => ({ pieceId: "tt-r1-15" })),
      { pieceId: "tt-g1" },
      ...Array.from({ length: 12 }, () => ({ pieceId: "tt-r1-15" })),
    ],
    branches: [],
  };

  const result = computeLayout(customLayout, "TT", 150, 80);
  printResult("Custom minimal TT oval (2×G1 + 24×R1-15°)", result);
  assert(result.tracks.length === 26, \`Has 26 tracks (got \${result.tracks.length})\`);
  assert(result.loopGapMm < 2, \`Loop closed within 2mm (gap: \${result.loopGapMm.toFixed(2)}mm)\`);
}

// ========================================
// Test 8: All templates for both scales
// ========================================
console.log("\\n\\n🧪 Testing all templates...\\n");
for (const template of TEMPLATES) {
  for (const scale of ["TT", "H0"] as TrackScale[]) {
    const layout = template.layouts[scale];
    if (!layout) {
      console.log(\`  ⏭️  \${template.id} / \${scale}: no layout defined\`);
      continue;
    }
    const result = computeLayout(layout, scale, 250, 150);
    const status = result.loopGapMm < 2 ? "✅" : (result.loopGapMm < 10 ? "⚠️" : "❌");
    console.log(
      \`  \${status} \${template.id} / \${scale}: \${result.tracks.length} tracks, gap=\${result.loopGapMm.toFixed(2)}mm\` +
      (result.warnings.length > 0 ? \` (\${result.warnings.length} warnings)\` : "")
    );
  }
}

// ========================================
// Summary
// ========================================
console.log("\\n" + "=".repeat(60));
console.log(\`RESULTS: \${passed} passed, \${failed} failed\`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
`;

// Write the test file
const testFilePath = join(projectRoot, "scripts", "_test_runner.ts");
writeFileSync(testFilePath, testCode);

// Run with tsx
try {
  const output = execSync(`npx tsx scripts/_test_runner.ts`, {
    cwd: projectRoot,
    encoding: "utf-8",
    timeout: 30000,
    stdio: "pipe",
  });
  console.log(output);
} catch (err) {
  console.error("Test runner failed:");
  console.error(err.stdout || "");
  console.error(err.stderr || "");
  process.exit(1);
} finally {
  // Clean up
  if (existsSync(testFilePath)) {
    unlinkSync(testFilePath);
  }
}
