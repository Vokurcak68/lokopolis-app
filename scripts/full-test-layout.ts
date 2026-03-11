
import { computeLayout } from "../src/lib/track-layout-engine";
import { TEMPLATES, getTemplateLayout } from "../src/lib/track-templates";
import { getTrackPiece, getCatalogByScale, type TrackScale } from "../src/lib/track-library";
import { connectionToWorld } from "../src/lib/track-designer-store";

const scales: TrackScale[] = ["TT", "H0"];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log("  ✅ " + message);
  } else {
    failedTests++;
    console.log("  ❌ FAIL: " + message);
  }
}

console.log("=== FULL LAYOUT ENGINE TEST ===\n");

for (const template of TEMPLATES) {
  console.log(`\n📋 Template: ${template.nameCs} (${template.id})`);
  
  for (const scale of scales) {
    const layout = getTemplateLayout(template.id, scale);
    if (!layout) {
      console.log(`  ⚠️ No ${scale} layout for this template`);
      continue;
    }
    
    console.log(`\n  🔧 Scale: ${scale}`);
    
    // Use default board size
    const boardW = scale === "TT" ? 200 : 250;
    const boardD = scale === "TT" ? 100 : 120;
    
    const result = computeLayout(layout, scale, boardW, boardD);
    
    // Test 1: Loop closure
    assert(
      result.loopGapMm < 2.0,
      `Loop closure: ${result.loopGapMm.toFixed(2)}mm gap (need < 2mm)`
    );
    
    // Test 2: Has tracks
    assert(
      result.tracks.length > 0,
      `Has tracks: ${result.tracks.length} pieces`
    );
    
    // Test 3: No warnings about unknown pieces
    const unknownPieceWarnings = result.warnings.filter(w => w.includes("unknown"));
    assert(
      unknownPieceWarnings.length === 0,
      `No unknown pieces (${unknownPieceWarnings.length} warnings)`
    );
    
    // Test 4: All sequential main loop connections are tight
    const mainLoopCount = (layout.mainLoop || []).filter(s => getTrackPiece(s.pieceId)).length;
    let maxGapBetweenPieces = 0;
    let gapCount = 0;
    
    for (let i = 0; i < mainLoopCount - 1; i++) {
      const curr = result.tracks[i];
      const next = result.tracks[i + 1];
      if (!curr || !next) continue;
      
      const currPiece = getTrackPiece(curr.pieceId);
      if (!currPiece) continue;
      
      // Get exit connection (b for most, c for diverge)
      const seg = (layout.mainLoop || [])[i];
      const exitConnId = (currPiece.type === "turnout" && seg?.branch === "diverge") ? "c" : "b";
      const exitConn = currPiece.connections.find(c => c.id === exitConnId);
      if (!exitConn) continue;
      
      const exitWorld = connectionToWorld(exitConn, curr.position, curr.rotation);
      
      const nextPiece = getTrackPiece(next.pieceId);
      if (!nextPiece) continue;
      const entryConn = nextPiece.connections.find(c => c.id === "a");
      if (!entryConn) continue;
      
      const entryWorld = connectionToWorld(entryConn, next.position, next.rotation);
      
      const dx = exitWorld.position.x - entryWorld.position.x;
      const dz = exitWorld.position.z - entryWorld.position.z;
      const gap = Math.sqrt(dx * dx + dz * dz);
      
      if (gap > maxGapBetweenPieces) maxGapBetweenPieces = gap;
      if (gap > 1.0) gapCount++;
    }
    
    assert(
      maxGapBetweenPieces < 1.0,
      `Sequential connections tight: max gap ${maxGapBetweenPieces.toFixed(3)}mm (need < 1mm)`
    );
    
    assert(
      gapCount === 0,
      `No gaps > 1mm between pieces (${gapCount} found)`
    );
    
    // Test 5: All tracks within board bounds (with padding)
    const boardWmm = boardW * 10;
    const boardDmm = boardD * 10;
    const padding = 100; // allow 100mm outside (generous)
    let outOfBounds = 0;
    
    for (const track of result.tracks) {
      const piece = getTrackPiece(track.pieceId);
      if (!piece) continue;
      for (const conn of piece.connections) {
        const w = connectionToWorld(conn, track.position, track.rotation);
        if (w.position.x < -padding || w.position.x > boardWmm + padding ||
            w.position.z < -padding || w.position.z > boardDmm + padding) {
          outOfBounds++;
        }
      }
    }
    
    assert(
      outOfBounds === 0,
      `All tracks within board bounds (${outOfBounds} points outside)`
    );
    
    // Test 6: Check branch connections (if any)
    if ((layout.branches || []).length > 0) {
      for (let bi = 0; bi < (layout.branches || []).length; bi++) {
        const branch = (layout.branches || [])[bi];
        const srcTrack = result.tracks[branch.sourceSegmentIndex];
        if (!srcTrack) continue;
        
        const srcPiece = getTrackPiece(srcTrack.pieceId);
        if (!srcPiece) continue;
        
        // Check that turnout's "c" connection has a snap
        const hasSnap = srcTrack.snappedConnections["c"];
        assert(
          !!hasSnap,
          `Branch ${bi}: turnout connection "c" is snapped (${hasSnap || "NOT SNAPPED"})`
        );
      }
    }
    
    // Print debug info
    if (result.debugInfo.length > 0) {
      console.log("    Debug: " + result.debugInfo.slice(-2).join(" | "));
    }
  }
}

console.log(`\n==================================================`);
console.log(`Total: ${totalTests} tests | ✅ ${passedTests} passed | ❌ ${failedTests} failed`);
console.log(`==================================================\n`);

if (failedTests > 0) {
  process.exit(1);
}
