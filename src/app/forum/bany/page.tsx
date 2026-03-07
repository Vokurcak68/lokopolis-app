"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo, formatCzechDate } from "@/lib/timeAgo";
import type { Profile } from "@/types/database";

interface BanRow {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  user: Pick<Profile, "display_name" | "username" | "avatar_url"> | null;
  banner: Pick<Profile, "display_name" | "username"> | null;
}

export default function BansPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [bans, setBans] = useState<BanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<Pick<Profile, "id" | "display_name" | "username">[]>([]);

  // New ban form
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<"permanent" | "1d" | "7d" | "30d">("permanent");
  const [submitting, setSubmitting] = useState(false);

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";

  const fetchBans = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("forum_bans")
        .select(`
          id, user_id, banned_by, reason, expires_at, created_at,
          user:profiles!forum_bans_user_id_fkey(display_name, username, avatar_url),
          banner:profiles!forum_bans_banned_by_fkey(display_name, username)
        `)
        .order("created_at", { ascending: false });

      setBans((data as unknown as BanRow[]) || []);
    } catch {
      setBans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdminOrMod) {
      fetchBans();
      // Fetch all users for the dropdown
      supabase.from("profiles").select("id, display_name, username").order("username").then(({ data }) => {
        if (data) setAllUsers(data);
      });
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [fetchBans, authLoading, isAdminOrMod]);

  async function handleBan(e: React.FormEvent) {
    e.preventDefault();
    if (!banUserId || !user) return;
    setSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (banDuration !== "permanent") {
        const days = banDuration === "1d" ? 1 : banDuration === "7d" ? 7 : 30;
        expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      }

      const { error } = await supabase.from("forum_bans").insert({
        user_id: banUserId,
        banned_by: user.id,
        reason: banReason.trim() || null,
        expires_at: expiresAt,
      });
      if (error) throw error;
      setBanUserId("");
      setBanReason("");
      setBanDuration("permanent");
      fetchBans();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnban(banId: string) {
    if (!confirm("Opravdu odbanovat tohoto uživatele?")) return;
    await supabase.from("forum_bans").delete().eq("id", banId);
    fetchBans();
  }

  if (!authLoading && !isAdminOrMod) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "24px", color: "#fff", marginBottom: "8px" }}>Přístup odepřen</h1>
        <Link href="/forum" style={{ color: "#f0a030", textDecoration: "none" }}>← Zpět na fórum</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      <div style={{ marginBottom: "24px", fontSize: "13px", color: "#6a6e80" }}>
        <Link href="/forum" style={{ color: "#f0a030", textDecoration: "none" }}>Fórum</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#a0a4b8" }}>Správa banů</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", marginBottom: "32px" }}>
        🚫 Správa banů
      </h1>

      {/* New ban form */}
      <div style={{
        background: "#1a1e2e",
        border: "1px solid #252838",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "32px",
      }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#e0e0e0", marginBottom: "16px" }}>
          Zabanovat uživatele
        </h3>
        <form onSubmit={handleBan}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <select
              value={banUserId}
              onChange={(e) => setBanUserId(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">— Vyberte uživatele —</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username || u.id}</option>
              ))}
            </select>
            <select
              value={banDuration}
              onChange={(e) => setBanDuration(e.target.value as typeof banDuration)}
              style={inputStyle}
            >
              <option value="permanent">Permanentní</option>
              <option value="1d">1 den</option>
              <option value="7d">7 dní</option>
              <option value="30d">30 dní</option>
            </select>
          </div>
          <input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Důvod banu (volitelné)"
            style={{ ...inputStyle, marginBottom: "12px" }}
          />
          <button
            type="submit"
            disabled={submitting || !banUserId}
            style={{
              padding: "10px 20px",
              background: !banUserId ? "#353a50" : "#ef4444",
              color: !banUserId ? "#6a6e80" : "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: !banUserId ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Banuji..." : "🚫 Zabanovat"}
          </button>
        </form>
      </div>

      {/* Bans list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <p style={{ color: "#6a6e80", fontSize: "14px" }}>Načítám...</p>
        </div>
      ) : bans.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
          <p style={{ color: "#8a8ea0", fontSize: "16px" }}>Žádní zabanovaní uživatelé</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {bans.map((ban) => {
            const userName = ban.user?.display_name || ban.user?.username || "Neznámý";
            const bannerName = ban.banner?.display_name || ban.banner?.username || "—";
            const isExpired = ban.expires_at && new Date(ban.expires_at) < new Date();
            const isActive = !ban.expires_at || new Date(ban.expires_at) > new Date();

            return (
              <div key={ban.id} style={{
                background: "#1a1e2e",
                border: `1px solid ${isActive ? "rgba(220,53,69,0.3)" : "#252838"}`,
                borderRadius: "10px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                opacity: isExpired ? 0.5 : 1,
              }}>
                {/* Avatar */}
                {ban.user?.avatar_url ? (
                  <img src={ban.user.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: "#353a50",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", color: "#a0a4b8",
                  }}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#e0e0e0" }}>{userName}</div>
                  {ban.reason && <div style={{ fontSize: "12px", color: "#6a6e80", marginTop: "2px" }}>Důvod: {ban.reason}</div>}
                  <div style={{ fontSize: "11px", color: "#555a70", marginTop: "4px" }}>
                    Zabanoval: {bannerName} · {timeAgo(ban.created_at)}
                    {ban.expires_at && (
                      <span> · Vyprší: {formatCzechDate(ban.expires_at)}</span>
                    )}
                    {!ban.expires_at && <span> · Permanentní</span>}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: isActive ? "rgba(220,53,69,0.15)" : "rgba(138,142,160,0.15)",
                    color: isActive ? "#ff6b6b" : "#8a8ea0",
                  }}>
                    {isExpired ? "Vypršel" : "Aktivní"}
                  </span>
                  <button
                    onClick={() => handleUnban(ban.id)}
                    style={{
                      padding: "6px 14px",
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: "6px",
                      color: "#22c55e",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Odbanovat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#1e2233",
  border: "1px solid #2a2f45",
  borderRadius: "8px",
  color: "#e0e0e0",
  fontSize: "14px",
  outline: "none",
};
