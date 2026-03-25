"use client";

interface TrackStatsBarProps {
  pieceCount: number;
  totalLengthM: number;
  freeConnections: number;
  turnouts: number;
}

export function TrackStatsBar({ pieceCount, totalLengthM, freeConnections, turnouts }: TrackStatsBarProps) {
  return (
    <div className="border-t px-4 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="flex flex-wrap items-center gap-5 text-sm" style={{ color: "var(--text-body)" }}>
        <span>
          Kusů: <strong>{pieceCount}</strong>
        </span>
        <span>
          Délka: <strong>{totalLengthM.toFixed(2)} m</strong>
        </span>
        <span style={{ color: freeConnections > 0 ? "#ff6b6b" : "#4caf50" }}>
          Volné konce: <strong>{freeConnections}</strong>
        </span>
        <span>
          Výhybky: <strong>{turnouts}</strong>
        </span>
      </div>
    </div>
  );
}
