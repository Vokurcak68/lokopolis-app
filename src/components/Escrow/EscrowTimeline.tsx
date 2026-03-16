"use client";

import type { EscrowStatus } from "@/types/database";

const STEPS: { key: EscrowStatus | "start"; label: string; icon: string }[] = [
  { key: "created", label: "Vytvořeno", icon: "📝" },
  { key: "paid", label: "Zaplaceno", icon: "💰" },
  { key: "shipped", label: "Odesláno", icon: "📦" },
  { key: "delivered", label: "Doručeno", icon: "🏠" },
  { key: "completed", label: "Dokončeno", icon: "✅" },
];

const STATUS_INDEX: Record<string, number> = {
  created: 0,
  paid: 1,
  shipped: 2,
  delivered: 3,
  completed: 4,
  auto_completed: 4,
};

const TERMINAL_STATUSES: Record<string, { label: string; color: string; icon: string }> = {
  disputed: { label: "Spor", color: "#ef4444", icon: "⚠️" },
  refunded: { label: "Vráceno", color: "#f97316", icon: "↩️" },
  cancelled: { label: "Zrušeno", color: "#6b7280", icon: "❌" },
};

export default function EscrowTimeline({ status }: { status: EscrowStatus }) {
  const terminal = TERMINAL_STATUSES[status];
  const currentIndex = STATUS_INDEX[status] ?? -1;

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Progress steps */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        {/* Line behind */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "40px",
            right: "40px",
            height: "3px",
            background: "var(--border)",
            zIndex: 0,
          }}
        />
        {/* Filled line */}
        {currentIndex >= 0 && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "40px",
              width: `${Math.min(currentIndex / (STEPS.length - 1), 1) * (100 - 13)}%`,
              height: "3px",
              background: terminal ? terminal.color : "#22c55e",
              zIndex: 1,
              transition: "width 0.3s ease",
            }}
          />
        )}

        {STEPS.map((step, i) => {
          const isActive = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div
              key={step.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
                position: "relative",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  background: isActive
                    ? terminal && isCurrent
                      ? terminal.color
                      : "#22c55e"
                    : "var(--bg-card)",
                  border: `2px solid ${isActive ? (terminal && isCurrent ? terminal.color : "#22c55e") : "var(--border)"}`,
                  transition: "all 0.3s ease",
                }}
              >
                {terminal && isCurrent ? terminal.icon : step.icon}
              </div>
              <span
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  fontWeight: isCurrent ? 700 : 500,
                  color: isActive ? "var(--text-primary)" : "var(--text-dimmer)",
                  textAlign: "center",
                }}
              >
                {terminal && isCurrent ? terminal.label : step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Terminal status banner */}
      {terminal && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: `${terminal.color}15`,
            border: `1px solid ${terminal.color}30`,
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 600,
            color: terminal.color,
          }}
        >
          {terminal.icon} {terminal.label}
        </div>
      )}
    </div>
  );
}
