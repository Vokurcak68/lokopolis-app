"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type {
  Competition,
  CompetitionEntry,
  CompetitionStatus,
  Profile,
} from "@/types/database";

/* ============================================================
   HELPERS
   ============================================================ */

function optimizeImageUrl(url: string, width: number = 400): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat(`?width=${width}&quality=75`);
}

const CZECH_MONTHS: Record<string, string> = {
  "01": "Leden",
  "02": "Únor",
  "03": "Březen",
  "04": "Duben",
  "05": "Květen",
  "06": "Červen",
  "07": "Červenec",
  "08": "Srpen",
  "09": "Září",
  "10": "Říjen",
  "11": "Listopad",
  "12": "Prosinec",
};

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${CZECH_MONTHS[m] || m} ${year}`;
}

interface EntryWithAuthor extends CompetitionEntry {
  author: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
}

/* ============================================================
   COUNTDOWN
   ============================================================ */

function Countdown({ target }: { target: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ukončeno");
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    }
    calc();
    const iv = setInterval(calc, 60_000);
    return () => clearInterval(iv);
  }, [target]);

  return (
    <span
      style={{
        fontWeight: 700,
        color: "var(--accent)",
        fontSize: "18px",
      }}
    >
      ⏱ {timeLeft}
    </span>
  );
}

/* ============================================================
   NEW COMPETITION MODAL
   ============================================================ */

function NewCompetitionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [month, setMonth] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [prize, setPrize] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !month.trim() || !startsAt || !endsAt || !user) return;

    setSaving(true);
    setError("");

    const { error: err } = await supabase.from("competitions").insert({
      title: title.trim(),
      description: description.trim() || null,
      month: month.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      prize: prize.trim() || null,
      status: "upcoming" as CompetitionStatus,
      created_by: user.id,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            🏆 Vyhlásit novou soutěž
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "24px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Název soutěže *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Kolejiště měsíce — Březen 2026"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Popis
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pravidla, téma soutěže..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Měsíc (YYYY-MM) *
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                  fontWeight: 500,
                }}
              >
                Začátek *
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-input)",
                  borderRadius: "8px",
                  color: "var(--text-body)",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                  fontWeight: 500,
                }}
              >
                Konec *
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-input)",
                  borderRadius: "8px",
                  color: "var(--text-body)",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Cena
            </label>
            <input
              type="text"
              value={prize}
              onChange={(e) => setPrize(e.target.value)}
              placeholder="Např. Voucher 500 Kč do obchodu..."
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--danger-bg)",
                border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: "8px",
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !title.trim() || !month || !startsAt || !endsAt}
            style={{
              width: "100%",
              padding: "12px",
              background: saving ? "var(--border-hover)" : "var(--accent)",
              color: saving ? "var(--text-dimmer)" : "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Ukládám..." : "Vyhlásit soutěž"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   ENTRY CARD
   ============================================================ */

function EntryCard({ entry }: { entry: EntryWithAuthor }) {
  const authorName =
    entry.author?.display_name || entry.author?.username || "Anonym";
  const firstImage =
    entry.images && entry.images.length > 0 ? entry.images[0] : null;

  return (
    <Link href={`/soutez/${entry.id}`} style={{ textDecoration: "none" }}>
      <div
        className="article-card"
        style={{ borderBottom: "3px solid var(--accent)" }}
      >
        <div
          style={{
            width: "100%",
            height: "200px",
            position: "relative",
            overflow: "hidden",
            background: "var(--bg-page)",
          }}
        >
          {firstImage ? (
            <Image
              src={optimizeImageUrl(firstImage, 400)}
              alt={entry.title}
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "48px",
                color: "var(--border-hover)",
              }}
            >
              <img src="https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/competition-entry.png" alt="" style={{ width: "96px", height: "96px", objectFit: "contain", opacity: 0.5 }} />
            </div>
          )}
          {entry.scale && (
            <span
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                background: "rgba(15,17,23,0.8)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--accent)",
                fontWeight: 600,
              }}
            >
              {entry.scale}
            </span>
          )}
        </div>
        <div style={{ padding: "16px" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "8px",
              lineHeight: 1.4,
            }}
          >
            {entry.title}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {entry.author?.avatar_url ? (
                <Image
                  src={entry.author.avatar_url}
                  alt=""
                  width={20}
                  height={20}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "var(--border-hover)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-dimmer)",
                }}
              >
                {authorName}
              </span>
            </div>
            <span
              style={{
                fontSize: "14px",
                color: "var(--accent)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ❤️ {entry.vote_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function CompetitionPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [entries, setEntries] = useState<EntryWithAuthor[]>([]);
  const [winnerEntries, setWinnerEntries] = useState<
    Record<string, EntryWithAuthor>
  >({});
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: comps } = await supabase
        .from("competitions")
        .select("*")
        .order("starts_at", { ascending: false });

      const allComps = (comps || []) as Competition[];
      setCompetitions(allComps);

      // Get the current active/voting competition
      const activComp = allComps.find(
        (c) => c.status === "active" || c.status === "voting"
      );

      if (activComp) {
        const { data: entriesData } = await supabase
          .from("competition_entries")
          .select(
            "*, author:profiles!competition_entries_user_id_fkey(username, display_name, avatar_url)"
          )
          .eq("competition_id", activComp.id)
          .order("vote_count", { ascending: false });

        setEntries((entriesData as unknown as EntryWithAuthor[]) || []);
      } else {
        setEntries([]);
      }

      // Load winner entries for finished competitions
      const finished = allComps.filter(
        (c) => c.status === "finished" && c.winner_id
      );
      if (finished.length > 0) {
        const winnerIds = finished
          .map((c) => c.winner_id)
          .filter(Boolean) as string[];
        if (winnerIds.length > 0) {
          const { data: winnerData } = await supabase
            .from("competition_entries")
            .select(
              "*, author:profiles!competition_entries_user_id_fkey(username, display_name, avatar_url)"
            )
            .in("id", winnerIds);

          const map: Record<string, EntryWithAuthor> = {};
          if (winnerData) {
            for (const w of winnerData as unknown as EntryWithAuthor[]) {
              map[w.id] = w;
            }
          }
          setWinnerEntries(map);
        }
      }
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [fetchData, authLoading]);

  const activeComp = competitions.find(
    (c) => c.status === "active" || c.status === "voting"
  );
  const finishedComps = competitions.filter((c) => c.status === "finished");

  async function updateStatus(compId: string, newStatus: CompetitionStatus) {
    setStatusUpdating(compId);
    const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };

    // If finishing, pick the winner (entry with most votes)
    if (newStatus === "finished") {
      const { data: topEntry } = await supabase
        .from("competition_entries")
        .select("id")
        .eq("competition_id", compId)
        .order("vote_count", { ascending: false })
        .limit(1)
        .single();

      if (topEntry) {
        updateData.winner_id = topEntry.id;
      }
    }

    await supabase.from("competitions").update(updateData).eq("id", compId);
    setStatusUpdating(null);
    fetchData();
  }

  async function setWinner(compId: string, entryId: string) {
    await supabase
      .from("competitions")
      .update({ winner_id: entryId, updated_at: new Date().toISOString() })
      .eq("id", compId);
    fetchData();
  }

  if (loading || authLoading) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
          Načítám soutěže...
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "40px",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          <img
            src="https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/competition-trophy.png?v=2"
            alt="Soutěž"
            style={{ width: "56px", height: "56px", objectFit: "contain", display: "inline-block", verticalAlign: "middle", marginRight: "12px" }}
          />
          Kolejiště měsíce
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "var(--text-dim)",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          Měsíční soutěž pro modeláře — přihlaste svůj kolejiště a získejte hlasy
          komunity!
        </p>
        {isAdmin && (
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              marginTop: "16px",
              padding: "10px 24px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Vyhlásit novou soutěž
          </button>
        )}
      </div>

      {/* Active / Voting competition */}
      {activeComp && (
        <section style={{ marginBottom: "48px" }}>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--accent-border)",
              borderRadius: "16px",
              padding: "32px",
              marginBottom: "24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "var(--accent)",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background:
                        activeComp.status === "voting"
                          ? "rgba(59,130,246,0.15)"
                          : "rgba(34,197,94,0.15)",
                      color:
                        activeComp.status === "voting" ? "#3b82f6" : "#22c55e",
                    }}
                  >
                    {activeComp.status === "voting"
                      ? "🗳️ Hlasování"
                      : "🟢 Přihlašování"}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--text-dimmer)",
                    }}
                  >
                    {formatMonth(activeComp.month)}
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: "8px",
                  }}
                >
                  {activeComp.title}
                </h2>
                {activeComp.description && (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--text-dim)",
                      lineHeight: 1.6,
                      marginBottom: "8px",
                    }}
                  >
                    {activeComp.description}
                  </p>
                )}
                {activeComp.prize && (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--accent)",
                    }}
                  >
                    🎁 Cena: {activeComp.prize}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-dimmer)",
                    marginBottom: "4px",
                  }}
                >
                  Zbývá:
                </div>
                <Countdown target={activeComp.ends_at} />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "20px",
                flexWrap: "wrap",
              }}
            >
              {activeComp.status === "active" && user && (
                <Link
                  href="/soutez/prihlasit"
                  style={{
                    padding: "10px 24px",
                    background: "var(--accent)",
                    color: "var(--accent-text-on)",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <img src="https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/competition-entry.png" alt="" style={{ width: "18px", height: "18px", objectFit: "contain", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
                  Přihlásit kolejiště
                </Link>
              )}
              {activeComp.status === "active" && !user && (
                <Link
                  href="/prihlaseni"
                  style={{
                    padding: "10px 24px",
                    background: "var(--border-hover)",
                    color: "var(--text-dim)",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  Přihlaste se pro účast
                </Link>
              )}
              {activeComp.status === "voting" && (
                <span
                  style={{
                    padding: "10px 24px",
                    background: "rgba(59,130,246,0.1)",
                    color: "#3b82f6",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  🗳️ Hlasování probíhá!
                </span>
              )}

              {/* Admin controls */}
              {isAdmin && (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginLeft: "auto",
                  }}
                >
                  {activeComp.status === "active" && (
                    <button
                      onClick={() => updateStatus(activeComp.id, "voting")}
                      disabled={statusUpdating === activeComp.id}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(59,130,246,0.15)",
                        color: "#3b82f6",
                        border: "1px solid rgba(59,130,246,0.3)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      → Spustit hlasování
                    </button>
                  )}
                  {activeComp.status === "voting" && (
                    <button
                      onClick={() => updateStatus(activeComp.id, "finished")}
                      disabled={statusUpdating === activeComp.id}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(239,68,68,0.15)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      → Ukončit soutěž
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Entries grid */}
          {entries.length > 0 ? (
            <>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "16px",
                }}
              >
                Přihlášená kolejiště ({entries.length})
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "20px",
                }}
              >
                {entries.map((entry) => (
                  <div key={entry.id}>
                    <EntryCard entry={entry} />
                    {isAdmin &&
                      activeComp.status === "finished" &&
                      activeComp.winner_id !== entry.id && (
                        <button
                          onClick={() => setWinner(activeComp.id, entry.id)}
                          style={{
                            marginTop: "4px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            background: "var(--accent-bg)",
                            color: "var(--accent)",
                            border: "1px solid var(--accent-border)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            width: "100%",
                          }}
                        >
                          🏆 Nastavit jako vítěze
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><img src="https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/competition-entry.png" alt="" style={{ width: "96px", height: "96px", objectFit: "contain", opacity: 0.5 }} /></div>
              <p
                style={{
                  fontSize: "16px",
                  color: "var(--text-dim)",
                  marginBottom: "4px",
                }}
              >
                Zatím žádné přihlášky
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>
                Buďte první, kdo přihlásí své kolejiště!
              </p>
            </div>
          )}
        </section>
      )}

      {/* No active competition */}
      {!activeComp && finishedComps.length === 0 && competitions.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "64px 0",
          }}
        >
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🏆</div>
          <p
            style={{
              fontSize: "18px",
              color: "var(--text-dim)",
              marginBottom: "8px",
            }}
          >
            Zatím nebyla vyhlášena žádná soutěž
          </p>
          <p style={{ fontSize: "14px", color: "var(--text-dimmer)" }}>
            Sledujte Lokopolis pro novinky o první soutěži!
          </p>
        </div>
      )}

      {/* History of finished competitions */}
      {finishedComps.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "20px",
            }}
          >
            📜 Historie soutěží
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {finishedComps.map((comp) => {
              const winner = comp.winner_id
                ? winnerEntries[comp.winner_id]
                : null;
              const winnerImage =
                winner?.images && winner.images.length > 0
                  ? winner.images[0]
                  : null;
              const winnerName =
                winner?.author?.display_name ||
                winner?.author?.username ||
                null;

              return (
                <div
                  key={comp.id}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    borderBottom: "3px solid var(--accent)",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "160px",
                      position: "relative",
                      overflow: "hidden",
                      background: "var(--bg-page)",
                    }}
                  >
                    {winnerImage ? (
                      <Image
                        src={optimizeImageUrl(winnerImage, 400)}
                        alt={winner?.title || "Vítěz"}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "48px",
                          color: "var(--border-hover)",
                        }}
                      >
                        🏆
                      </div>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        background: "rgba(240,160,48,0.9)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#000",
                        fontWeight: 700,
                      }}
                    >
                      🏆 Vítěz
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--accent)",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                    >
                      {formatMonth(comp.month)}
                    </div>
                    <h3
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: "6px",
                      }}
                    >
                      {comp.title}
                    </h3>
                    {winner && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "var(--text-dimmer)",
                        }}
                      >
                        {winner.title}
                        {winnerName && (
                          <span style={{ color: "var(--text-faint)" }}>
                            {" "}
                            — {winnerName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* New competition modal */}
      {showNewModal && (
        <NewCompetitionModal
          onClose={() => setShowNewModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
