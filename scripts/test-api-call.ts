/**
 * Test: Simulate an actual API call with the simple-oval template
 * and check if the returned tracks are valid
 */

import { computeLayout, layoutResultToAPIResponse } from "../src/lib/track-layout-engine";
import { getTemplateLayout } from "../src/lib/track-templates";
import { getTrackPiece } from "../src/lib/track-library";
import { connectionToWorld } from "../src/lib/track-designer-store";

// Test simple oval TT - this should work
const layout = getTemplateLayout("simple-oval", "TT")!;
const result = computeLayout(layout, "TT", 200, 100);
const apiTracks = layoutResultToAPIResponse(result);

console.log("=== SIMPLE OVAL TT - API Output ===\n");
console.log(`Total tracks: ${apiTracks.length}`);
console.log(`Loop closed: ${result.loopClosed}, gap: ${result.loopGapMm}mm\n`);

// Print each track
for (let i = 0; i < apiTracks.length; i++) {
  const t = apiTracks[i];
  const piece = getTrackPiece(t.pieceId)!;
  const rotDeg = ((t.rotation * 180 / Math.PI) % 360 + 360) % 360;
  
  // Calculate exit point (connection b)
  const exitConn = piece.connections.find(c => c.id === "b");
  const exitWorld = exitConn 
    ? connectionToWorld(exitConn, { x: t.x, y: 0, z: t.z }, t.rotation)
    : null;
  
  console.log(`[${i}] ${t.pieceId.padEnd(12)} pos=(${t.x.toFixed(1)}, ${t.z.toFixed(1)}) rot=${rotDeg.toFixed(1)}° → exit=(${exitWorld?.position.x.toFixed(1)}, ${exitWorld?.position.z.toFixed(1)})`);
}

// Now test oval-with-siding TT
console.log("\n\n=== OVAL WITH SIDING TT - API Output ===\n");
const layout2 = getTemplateLayout("oval-with-siding", "TT")!;
const result2 = computeLayout(layout2, "TT", 200, 100);
const apiTracks2 = layoutResultToAPIResponse(result2);

console.log(`Total tracks: ${apiTracks2.length}`);
console.log(`Loop closed: ${result2.loopClosed}, gap: ${result2.loopGapMm}mm`);
console.log(`Main loop segments: ${layout2.mainLoop.length}, Branch segments: ${layout2.branches[0]?.segments.length || 0}\n`);

for (let i = 0; i < apiTracks2.length; i++) {
  const t = apiTracks2[i];
  const piece = getTrackPiece(t.pieceId)!;
  const rotDeg = ((t.rotation * 180 / Math.PI) % 360 + 360) % 360;
  
  const isMainLoop = i < layout2.mainLoop.length;
  const label = isMainLoop ? "MAIN" : "BRANCH";
  
  console.log(`[${i}] ${label.padEnd(6)} ${t.pieceId.padEnd(12)} pos=(${t.x.toFixed(1)}, ${t.z.toFixed(1)}) rot=${rotDeg.toFixed(1)}° connectedTo=${JSON.stringify(t.connectedTo || {})}`);
}

// Now check: what does the client do with these tracks?
// The client creates PlacedTrack[] and feeds them ALL to Scene3D
// Scene3D renders ALL tracks - each at its own position/rotation
// This should be correct IF the positions are correct.

// The real question: are the branch positions correct?
console.log("\n--- Branch track positions ---");
const mainLoopCount = layout2.mainLoop.length;
for (let i = mainLoopCount; i < apiTracks2.length; i++) {
  const t = apiTracks2[i];
  console.log(`Branch track: ${t.pieceId} at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) rot=${((t.rotation * 180 / Math.PI) % 360).toFixed(1)}°`);
}

// Check turnout's C connection
const turnoutTrack = apiTracks2[0]; // First track is the ewl turnout
const turnoutPiece = getTrackPiece(turnoutTrack.pieceId)!;
const connC = turnoutPiece.connections.find(c => c.id === "c");
if (connC) {
  const cWorld = connectionToWorld(connC, { x: turnoutTrack.x, y: 0, z: turnoutTrack.z }, turnoutTrack.rotation);
  console.log(`\nTurnout C connection at: (${cWorld.position.x.toFixed(1)}, ${cWorld.position.z.toFixed(1)}) angle=${((cWorld.angle * 180 / Math.PI) % 360).toFixed(1)}°`);
  
  // First branch track's A connection
  if (apiTracks2.length > mainLoopCount) {
    const branchTrack = apiTracks2[mainLoopCount];
    const branchPiece = getTrackPiece(branchTrack.pieceId)!;
    const connA = branchPiece.connections.find(c => c.id === "a");
    if (connA) {
      const aWorld = connectionToWorld(connA, { x: branchTrack.x, y: 0, z: branchTrack.z }, branchTrack.rotation);
      const dx = cWorld.position.x - aWorld.position.x;
      const dz = cWorld.position.z - aWorld.position.z;
      const gap = Math.sqrt(dx*dx + dz*dz);
      console.log(`Branch first track A at: (${aWorld.position.x.toFixed(1)}, ${aWorld.position.z.toFixed(1)})`);
      console.log(`Gap between turnout C and branch A: ${gap.toFixed(3)}mm`);
    }
  }
}
