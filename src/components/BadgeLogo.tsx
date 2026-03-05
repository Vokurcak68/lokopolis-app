"use client";

interface BadgeLogoProps {
  size?: "sm" | "lg";
}

export default function BadgeLogo({ size = "sm" }: BadgeLogoProps) {
  const isLarge = size === "lg";

  return (
    <div
      className={`
        inline-flex flex-col items-center justify-center
        border-2 border-primary rounded-lg
        select-none
        ${isLarge
          ? "px-10 py-6 gap-1"
          : "px-4 py-2 gap-0.5"
        }
      `}
    >
      {/* Top: est. 2026 */}
      <span
        className={`
          uppercase tracking-[0.3em] text-text-muted font-light
          ${isLarge ? "text-sm" : "text-[10px]"}
        `}
      >
        · est. 2026 ·
      </span>

      {/* Middle: LOKOPOLIS */}
      <span
        className={`
          font-bold tracking-wider leading-none
          ${isLarge ? "text-5xl md:text-6xl" : "text-xl"}
        `}
      >
        <span className="text-white">LOKO</span>
        <span className="text-primary">POLIS</span>
      </span>

      {/* Bottom: modelová železnice */}
      <span
        className={`
          uppercase tracking-[0.25em] text-text-muted font-light
          ${isLarge ? "text-sm mt-1" : "text-[9px]"}
        `}
      >
        modelová železnice
      </span>
    </div>
  );
}
