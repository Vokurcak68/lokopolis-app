"use client";

interface BadgeLogoProps {
  size?: "sm" | "lg";
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
        border: "2px solid #f0a030",
        borderRadius: "10px",
        padding: "6px 16px 5px",
      }}
    >
      <span
        style={{
          fontSize: "8px",
          letterSpacing: "3px",
          color: "#f0a030",
          textTransform: "uppercase",
        }}
      >
        · est. 2026 ·
      </span>
      <span
        style={{
          fontSize: "20px",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          lineHeight: 1.2,
        }}
      >
        <span style={{ color: "#fff" }}>LOKO</span>
        <span style={{ color: "#f0a030" }}>POLIS</span>
      </span>
      <span
        style={{
          fontSize: "7px",
          letterSpacing: "2px",
          color: "#6a6e80",
          textTransform: "uppercase",
        }}
      >
        modelová železnice
      </span>
    </div>
  );
}
