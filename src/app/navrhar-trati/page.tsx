"use client";

import React from "react";
import dynamic from "next/dynamic";

// Dynamic import — Three.js cannot run on server
const TrackDesigner = dynamic(
  () => import("@/components/TrackDesigner/TrackDesigner"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "calc(100vh - 64px)",
          background: "var(--bg-page)",
          color: "var(--text-muted)",
          fontSize: "16px",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "32px" }}>🛤️</span>
        <span>Načítám 3D návrhář...</span>
      </div>
    ),
  }
);

export default function NavrharTratiPage() {
  return <TrackDesigner />;
}
