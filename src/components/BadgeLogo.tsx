"use client";

interface BadgeLogoProps {
  size?: "xs" | "sm" | "lg";
}

export default function BadgeLogo({ size = "sm" }: BadgeLogoProps) {
  const isLarge = size === "lg";

  if (isLarge) {
    return (
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          border: "3px solid #f0a030",
          borderRadius: "16px",
          padding: "16px 40px 14px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            letterSpacing: "4px",
            color: "#f0a030",
            textTransform: "uppercase",
            marginBottom: "2px",
          }}
        >
          · est. 2026 ·
        </span>
        <span
          style={{
            fontSize: "56px",
            fontWeight: 800,
            letterSpacing: "-1px",
            lineHeight: 1.1,
          }}
        >
          <span style={{ color: "#fff" }}>LOKO</span>
          <span style={{ color: "#f0a030" }}>POLIS</span>
        </span>
        <span
          style={{
            fontSize: "11px",
            letterSpacing: "3px",
            color: "#6a6e80",
            textTransform: "uppercase",
            marginTop: "2px",
          }}
        >
          modelová železnice
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1.5px solid #f0a030",
        borderRadius: "7px",
        padding: "4px 11px 3px",
      }}
    >
      <span
        style={{
          fontSize: "6px",
          letterSpacing: "2px",
          color: "#f0a030",
          textTransform: "uppercase",
        }}
      >
        · est. 2026 ·
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 800,
          letterSpacing: "-0.3px",
          lineHeight: 1.2,
        }}
      >
        <span style={{ color: "#fff" }}>LOKO</span>
        <span style={{ color: "#f0a030" }}>POLIS</span>
      </span>
      <span
        style={{
          fontSize: "5px",
          letterSpacing: "1.5px",
          color: "#6a6e80",
          textTransform: "uppercase",
        }}
      >
        modelová železnice
      </span>
    </div>
  );
}
