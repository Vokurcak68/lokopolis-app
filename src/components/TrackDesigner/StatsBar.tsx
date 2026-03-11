"use client";

import React, { useMemo } from "react";
import type { PlacedTrack } from "@/lib/track-designer-store";
import type { TrackPieceDefinition } from "@/lib/track-library";

interface StatsBarProps {
  tracks: PlacedTrack[];
  catalog: Record<string, TrackPieceDefinition>;
}

export default function StatsBar({ tracks, catalog }: StatsBarProps) {
  const stats = useMemo(() => {
    let totalLength = 0;
    let freeEnds = 0;
    let snapped = 0;
    const typeCounts: Record<string, number> = {};

    for (const track of tracks) {
      const piece = catalog[track.pieceId];
      if (!piece) continue;

      // Count by type
      typeCounts[piece.type] = (typeCounts[piece.type] || 0) + 1;

      // Length
      if (piece.type === "straight" || piece.type === "turnout" || piece.type === "crossing") {
        totalLength += piece.length || 0;
      } else if (piece.type === "curve" && piece.radius && piece.angle) {
        totalLength += (piece.radius * piece.angle * Math.PI) / 180;
      }

      // Connection stats
      for (const conn of piece.connections) {
        if (track.snappedConnections[conn.id]) {
          snapped++;
        } else {
          freeEnds++;
        }
      }
    }

    return {
      totalPieces: tracks.length,
      totalLength: Math.round(totalLength),
      freeEnds,
      snappedConnections: Math.floor(snapped / 2), // each snap counted twice
      typeCounts,
    };
  }, [tracks, catalog]);

  const statItems = [
    { label: "Kolejí", value: stats.totalPieces, icon: "🛤️" },
    { label: "Délka", value: `${stats.totalLength}mm`, icon: "📏" },
    { label: "Volné konce", value: stats.freeEnds, icon: "🔴", warn: stats.freeEnds > 0 },
    { label: "Napojení", value: stats.snappedConnections, icon: "🟢" },
    ...(stats.typeCounts["straight"] ? [{ label: "Přímé", value: stats.typeCounts["straight"], icon: "━" }] : []),
    ...(stats.typeCounts["curve"] ? [{ label: "Oblouky", value: stats.typeCounts["curve"], icon: "↩" }] : []),
    ...(stats.typeCounts["turnout"] ? [{ label: "Výhybky", value: stats.typeCounts["turnout"], icon: "⑂" }] : []),
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        padding: "8px 16px",
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        flexWrap: "wrap",
        fontSize: "12px",
      }}
    >
      {statItems.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: item.warn ? "#ff6b6b" : "var(--text-muted)",
          }}
        >
          <span>{item.icon}</span>
          <span style={{ fontWeight: 600 }}>{item.value}</span>
          <span style={{ color: "var(--text-dim)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
