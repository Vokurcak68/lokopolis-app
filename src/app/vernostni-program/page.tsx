"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { LoyaltyLevel, LoyaltyPointEntry } from "@/types/database";

interface LoyaltyData {
  points: number;
  pointsValueCzk: number;
  currentLevel: LoyaltyLevel | null;
  nextLevel: LoyaltyLevel | null;
  levels: LoyaltyLevel[];
}

export default function LoyaltyPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [history, setHistory] = useState<LoyaltyPointEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setLoading(false); return; }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [infoRes, histRes] = await Promise.all([
        fetch("/api/shop/loyalty", { headers }),
        fetch("/api/shop/loyalty/history", { headers }),
      ]);
      if (infoRes.ok) setData(await infoRes.json());
      if (histRes.ok) {
        const h = await histRes.json();
        setHistory(h.entries || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const reasonLabels: Record<string, string> = {
    purchase: "🛒 Nákup",
    review: "⭐ Recenze",
    registration: "🎉 Registrace",
    referral: "🤝 Doporučení",
    admin: "👑 Admin bonus",
    redeem: "🎁 Uplatnění",
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
        <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
        ⭐ Věrnostní program
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>
        Sbírejte body za každý nákup a získejte trvalé slevy!
      </p>

      {!user ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "16px" }}>
            Pro zapojení do věrnostního programu se přihlaste
          </p>
          <Link href="/prihlaseni" style={{ padding: "12px 32px", background: "var(--accent)", color: "var(--accent-text-on)", borderRadius: "10px", fontWeight: 600, textDecoration: "none" }}>
            Přihlásit se
          </Link>
        </div>
      ) : (
        <>
          {/* Current status */}
          {data && (
            <div style={{ background: "var(--bg-card)", border: "2px solid var(--accent)", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "32px" }}>{data.currentLevel?.icon || "⭐"}</span>
                    <span style={{ fontSize: "24px", fontWeight: 700, color: data.currentLevel?.color || "var(--accent)" }}>
                      {data.currentLevel?.name || "Bronzový"}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                    {data.currentLevel?.perks?.map((p, i) => (
                      <span key={i} style={{ marginRight: "12px" }}>✓ {p}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: "var(--accent)" }}>{data.points}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>bodů (= {data.pointsValueCzk} Kč)</div>
                </div>
              </div>

              {/* Progress to next level */}
              {data.nextLevel && (
                <div style={{ marginTop: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                    <span>{data.currentLevel?.name}</span>
                    <span>{data.nextLevel.icon} {data.nextLevel.name} ({data.nextLevel.min_points} bodů)</span>
                  </div>
                  <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, ((data.points - (data.currentLevel?.min_points || 0)) / (data.nextLevel.min_points - (data.currentLevel?.min_points || 0))) * 100)}%`,
                        background: `linear-gradient(90deg, ${data.currentLevel?.color || "#cd7f32"}, ${data.nextLevel.color})`,
                        borderRadius: "4px",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", textAlign: "center" }}>
                    Ještě {data.nextLevel.min_points - data.points} bodů do {data.nextLevel.name}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Levels overview */}
          {data && (
            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>Úrovně</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                {data.levels.map((level) => {
                  const isCurrent = data.currentLevel?.id === level.id;
                  return (
                    <div
                      key={level.id}
                      style={{
                        background: isCurrent ? `${level.color}15` : "var(--bg-card)",
                        border: `2px solid ${isCurrent ? level.color : "var(--border)"}`,
                        borderRadius: "12px",
                        padding: "16px",
                        opacity: data.points >= level.min_points ? 1 : 0.6,
                      }}
                    >
                      <div style={{ fontSize: "24px", marginBottom: "4px" }}>{level.icon}</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: level.color }}>{level.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>od {level.min_points} bodů</div>
                      {level.discount_percent > 0 && (
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>🏷️ {level.discount_percent}% sleva</div>
                      )}
                      {level.points_multiplier > 1 && (
                        <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>✨ {level.points_multiplier}× body</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>Historie bodů</h2>
            {history.length === 0 ? (
              <p style={{ color: "var(--text-dimmer)", textAlign: "center", padding: "24px 0" }}>
                Zatím žádné body. Nakupujte a sbírejte! 🛒
              </p>
            ) : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                {history.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                        {reasonLabels[entry.reason] || entry.reason}
                      </div>
                      {entry.description && (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{entry.description}</div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: entry.points > 0 ? "#22c55e" : "#ef4444" }}>
                        {entry.points > 0 ? "+" : ""}{entry.points}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>
                        {new Date(entry.created_at).toLocaleDateString("cs-CZ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div style={{ marginTop: "32px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>❓ Jak to funguje</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>🛒</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Nakupujte</div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Za každou 1 Kč nákupu získáte 1 bod</div>
              </div>
              <div>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>📈</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Stoupejte výš</div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Více bodů = vyšší úroveň = větší sleva + násobitel bodů</div>
              </div>
              <div>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>🎁</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Uplatněte body</div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>100 bodů = 10 Kč sleva, použijte při placení</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
