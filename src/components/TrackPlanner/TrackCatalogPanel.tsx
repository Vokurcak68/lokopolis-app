"use client";

import { useEffect, useRef } from "react";
import type { TrackPieceDefinition } from "@/lib/track-library";
import { drawTrackPiecePreview } from "@/lib/track-canvas-renderer";

interface CatalogItemProps {
  piece: TrackPieceDefinition;
  active: boolean;
  onClick: () => void;
}

function CatalogItem({ piece, active, onClick }: CatalogItemProps) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    drawTrackPiecePreview(previewRef.current, piece, active);
  }, [piece, active]);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border p-2 text-left transition"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--accent-bg)" : "transparent",
      }}
    >
      <div className="flex items-center gap-2">
        <canvas ref={previewRef} className="h-9 w-18 shrink-0 rounded border" style={{ borderColor: "var(--border)" }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" style={{ color: "var(--text-body)" }}>
            {piece.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>
            {piece.catalogNumber ? `#${piece.catalogNumber}` : "Bez katalogu"}
          </div>
        </div>
      </div>
    </button>
  );
}

interface TrackCatalogPanelProps {
  grouped: Record<string, TrackPieceDefinition[]>;
  activePieceId: string | null;
  openMobile: boolean;
  onCloseMobile: () => void;
  onTogglePiece: (pieceId: string) => void;
}

export function TrackCatalogPanel({ grouped, activePieceId, openMobile, onCloseMobile, onTogglePiece }: TrackCatalogPanelProps) {
  return (
    <>
      {openMobile && (
        <button
          className="fixed inset-0 z-20 bg-black/45 md:hidden"
          aria-label="Zavřít katalog"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`z-30 w-60 shrink-0 border-r p-3 transition md:relative md:translate-x-0 ${
          openMobile ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full"
        } md:block`}
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            Katalog
          </div>
          <button className="md:hidden text-sm" onClick={onCloseMobile} style={{ color: "var(--text-body)" }}>
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pb-6">
          {Object.entries(grouped).map(([groupName, pieces]) => (
            <section key={groupName}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {groupName}
              </div>
              <div className="space-y-1.5">
                {pieces.map((piece) => (
                  <CatalogItem
                    key={piece.id}
                    piece={piece}
                    active={piece.id === activePieceId}
                    onClick={() => onTogglePiece(piece.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
