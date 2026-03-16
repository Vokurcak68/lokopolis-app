"use client";

export default function EscrowBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const isSmall = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? "4px" : "6px",
        padding: isSmall ? "2px 8px" : "4px 12px",
        borderRadius: "6px",
        fontSize: isSmall ? "11px" : "13px",
        fontWeight: 600,
        background: "rgba(34,197,94,0.12)",
        color: "#22c55e",
        border: "1px solid rgba(34,197,94,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      🛡️ Bezpečná platba
    </span>
  );
}
