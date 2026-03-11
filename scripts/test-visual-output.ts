/**
 * End-to-end test: Simulate what the browser does
 * 
 * 1. Call the API endpoint logic (template mode)
 * 2. Parse the response exactly like TrackDesigner.tsx does
 * 3. Compute visual positions (what Three.js would render)
 * 4. Check that adjacent tracks visually connect
 */

import { computeLayout, layoutResultToAPIResponse } from "../src/lib/track-layout-engine";
import { TEMPLATES, getTemplateLayout } from "../src/lib/track-templates";
import { getTrackPiece, type TrackScale, type TrackPieceDefinition } from "../src/lib/track-library";
import { connectionToWorld } from "../src/lib/track-designer-store";

// This is what the API returns
interface APITrack {
  pieceId: string;
  x: number;
  z: number;
  rotation: number;
  elevation?: number;
  isTunnel?: boolean;
  isBridge?: boolean;
  connectedTo?: Record<string, string>;
}

// This is what TrackDesigner.tsx creates from the API response
interface ClientTrack {
  instanceId: string;
  pieceId: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  elevation: number;
  snappedConnections: Record<string, string>;
  isTunnel: boolean;
  isBridge: boolean;
  isRamp: boolean;
}

// Simulate TrackDesigner.tsx handleAIGenerate
function simulateClientParsing(apiTracks: APITrack[]): ClientTrack[] {
  const tracks: ClientTrack[] = [];
  let counter = 0;
  
  for (const t of apiTracks) {
    const piece = getTrackPiece(t.pieceId);
    if (!piece) {
      console.log(`  ⚠️ Unknown piece: ${t.pieceId}`);
      continue;
    }
    counter++;
    tracks.push({
      instanceId: `track-test-${counter}`,
      pieceId: t.pieceId,
      position: { x: t.x || 0, y: 0, z: t.z || 0 },
      rotation: t.rotation || 0,
      elevation: t.elevation || 0,
      snappedConnections: (t as any).snappedConnections || {},
      isTunnel: t.isTunnel || false,
      isBridge: t.isBridge || false,
      isRamp: false,
    });
  }
  
  return tracks;
}

// Check visual connections: for each sequential pair of tracks,
// verify that the exit point of track[i] matches the entry point of track[i+1]
function checkVisualConnections(tracks: ClientTrack[]): { maxGap: number; gaps: string[] } {
  let maxGap = 0;
  const gaps: string[] = [];
  
  for (let i = 0; i < tracks.length - 1; i++) {
    const curr = tracks[i];
    const next = tracks[i + 1];
    
    const currPiece = getTrackPiece(curr.pieceId);
    const nextPiece = getTrackPiece(next.pieceId);
    if (!currPiece || !nextPiece) continue;
    
    // Get exit point of current piece (connection "b")
    const exitConn = currPiece.connections.find(c => c.id === "b");
    if (!exitConn) continue;
    
    const exitWorld = connectionToWorld(exitConn, curr.position, curr.rotation);
    
    // Get entry point of next piece (connection "a")
    const entryConn = nextPiece.connections.find(c => c.id === "a");
    if (!entryConn) continue;
    
    const entryWorld = connectionToWorld(entryConn, next.position, next.rotation);
    
    const dx = exitWorld.position.x - entryWorld.position.x;
    const dz = exitWorld.position.z - entryWorld.position.z;
    const gap = Math.sqrt(dx * dx + dz * dz);
    
    if (gap > maxGap) maxGap = gap;
    if (gap > 1.0) {
      gaps.push(`  Track ${i} (${curr.pieceId}) → Track ${i+1} (${next.pieceId}): gap ${gap.toFixed(2)}mm`);
    }
  }
  
  // Check loop closure (last → first for main loop)
  if (tracks.length > 2) {
    const last = tracks[tracks.length - 1];
    const first = tracks[0];
    const lastPiece = getTrackPiece(last.pieceId);
    const firstPiece = getTrackPiece(first.pieceId);
    if (lastPiece && firstPiece) {
      const exitConn = lastPiece.connections.find(c => c.id === "b");
      const entryConn = firstPiece.connections.find(c => c.id === "a");
      if (exitConn && entryConn) {
        const exitWorld = connectionToWorld(exitConn, last.position, last.rotation);
        const entryWorld = connectionToWorld(entryConn, first.position, first.rotation);
        const dx = exitWorld.position.x - entryWorld.position.x;
        const dz = exitWorld.position.z - entryWorld.position.z;
        const loopGap = Math.sqrt(dx * dx + dz * dz);
        if (loopGap > 1.0) {
          gaps.push(`  LOOP: Track ${tracks.length-1} → Track 0: gap ${loopGap.toFixed(2)}mm`);
        }
      }
    }
  }
  
  return { maxGap, gaps };
}

// Check that TrackMesh would render correctly
// TrackMesh uses: position={[track.position.x, track.position.y, track.position.z]}
//                 rotation={[0, track.rotation, 0]}
// Straights extend along +X in local space, curves bend in +Z direction
// So the rendered piece's exit point should be at the expected position
function checkThreeJSRendering(tracks: ClientTrack[]): string[] {
  const issues: string[] = [];
  
  for (const track of tracks) {
    const piece = getTrackPiece(track.pieceId);
    if (!piece) continue;
    
    // The piece is placed at position (x, y, z) with Y-rotation
    // TrackMesh renders straight tracks along +X in local space
    // A connection point at local (lx, 0, lz) appears at world:
    //   worldX = x + lx*cos(rot) - lz*sin(rot)
    //   worldZ = z + lx*sin(rot) + lz*cos(rot)
    // This should match connectionToWorld()
    
    for (const conn of piece.connections) {
      const worldFromStore = connectionToWorld(conn, track.position, track.rotation);
      
      // Manual computation (same as Three.js group transform)
      const cos = Math.cos(track.rotation);
      const sin = Math.sin(track.rotation);
      const manualX = track.position.x + conn.position.x * cos - conn.position.z * sin;
      const manualZ = track.position.z + conn.position.x * sin + conn.position.z * cos;
      
      const dx = Math.abs(worldFromStore.position.x - manualX);
      const dz = Math.abs(worldFromStore.position.z - manualZ);
      
      if (dx > 0.01 || dz > 0.01) {
        issues.push(`  ${track.pieceId} conn ${conn.id}: store says (${worldFromStore.position.x.toFixed(1)}, ${worldFromStore.position.z.toFixed(1)}) but Three.js would render at (${manualX.toFixed(1)}, ${manualZ.toFixed(1)})`);
      }
    }
  }
  
  return issues;
}

// ========== MAIN ==========

const scales: TrackScale[] = ["TT", "H0"];
let allPassed = true;

console.log("=== END-TO-END VISUAL TEST ===\n");
console.log("Testing: API response → Client parsing → Three.js rendering\n");

for (const template of TEMPLATES) {
  for (const scale of scales) {
    const layout = getTemplateLayout(template.id, scale);
    if (!layout) continue;
    
    console.log(`📋 ${template.nameCs} (${scale})`);
    
    // Step 1: Compute layout (what the API does)
    const boardW = scale === "TT" ? 200 : 250;
    const boardD = scale === "TT" ? 100 : 120;
    const result = computeLayout(layout, scale, boardW, boardD);
    
    // Step 2: Convert to API response format
    const apiResponse = layoutResultToAPIResponse(result);
    
    // Step 3: Parse like the client does
    const clientTracks = simulateClientParsing(apiResponse);
    
    console.log(`  Tracks: ${clientTracks.length} (API returned ${apiResponse.length})`);
    
    // Step 4: Check visual connections
    const { maxGap, gaps } = checkVisualConnections(clientTracks);
    
    if (gaps.length === 0) {
      console.log(`  ✅ All visual connections OK (max gap: ${maxGap.toFixed(3)}mm)`);
    } else {
      console.log(`  ❌ VISUAL GAPS FOUND:`);
      for (const g of gaps) console.log(g);
      allPassed = false;
    }
    
    // Step 5: Check Three.js rendering matches store positions
    const renderIssues = checkThreeJSRendering(clientTracks);
    if (renderIssues.length === 0) {
      console.log(`  ✅ Three.js rendering matches store positions`);
    } else {
      console.log(`  ❌ RENDERING MISMATCH:`);
      for (const issue of renderIssues) console.log(issue);
      allPassed = false;
    }
    
    // Step 6: Print first/last track for debug
    if (clientTracks.length > 0) {
      const first = clientTracks[0];
      const last = clientTracks[clientTracks.length - 1];
      console.log(`  First: ${first.pieceId} at (${first.position.x.toFixed(1)}, ${first.position.z.toFixed(1)}) rot=${(first.rotation * 180 / Math.PI).toFixed(1)}°`);
      console.log(`  Last:  ${last.pieceId} at (${last.position.x.toFixed(1)}, ${last.position.z.toFixed(1)}) rot=${(last.rotation * 180 / Math.PI).toFixed(1)}°`);
    }
    
    console.log();
  }
}

console.log("=".repeat(50));
console.log(allPassed ? "✅ ALL VISUAL TESTS PASSED" : "❌ SOME TESTS FAILED");
console.log("=".repeat(50));

if (!allPassed) process.exit(1);
