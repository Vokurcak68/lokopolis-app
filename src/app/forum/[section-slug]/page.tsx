"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import type { ForumSection, Profile } from "@/types/database";

interface ThreadRow {
  id: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  post_count: number;
  last_post_at: string;
  created_at: string;
  author: Pick<Profile, "id" | "display_name" | "username" | "avatar_url"> | null;
  last_poster: Pick<Profile, "id" | "display_name" | "username"> | null;
}

const THREADS_PER_PAGE = 20;

export default function SectionPage() {
  const params = useParams();
  const slug = params["section-slug"] as string;
  const { user, profile } = useAuth();
  const [section, setSection] = useState<ForumSection | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalThreads, setTotalThreads] = useState(0);
  const [isBanned, setIsBanned] = useState(false);

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";

  const fetchSection = useCallback(async () => {
    const { data } = await supabase
      .from("forum_sections")
      .select("*")
      .eq("slug", slug)
      .single();
    if (data) setSection(data);
    return data;
  }, [slug]);

  const fetchThreads = useCallback(async (sectionId: string, p: number) => {
    setLoading(true);
    try {
      const from = (p - 1) * THREADS_PER_PAGE;
      const to = from + THREADS_PER_PAGE - 1;

      // Parallel: count + data
      const [countRes, dataRes] = await Promise.all([
        supabase
          .from("forum_threads")
          .select("*", { count: "exact", head: true })
          .eq("section_id", sectionId),
        supabase
          .from("forum_threads")
          .select("id, title, is_pinned, is_locked, post_count, last_post_at, created_at, author:profiles!forum_threads_author_id_fkey(id, display_name, username, avatar_url), last_poster:profiles!forum_threads_last_post_by_fkey(id, display_name, username)")
          .eq("section_id", sectionId)
          .order("is_pinned", { ascending: false })
          .order("last_post_at", { ascending: false })
          .range(from, to),
      ]);

      setTotalThreads(countRes.count || 0);
      setThreads((dataRes.data as unknown as ThreadRow[]) || []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const sec = await fetchSection();
      if (sec) await fetchThreads(sec.id, page);
      else setLoading(false);
    }
    init();
  }, [fetchSection, fetchThreads, page]);

  // Check ban status
  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_forum_banned", { check_user_id: user.id }).then(({ data }) => {
      if (data) setIsBanned(true);
    });
  }, [user]);

  async function handlePin(threadId: string, pinned: boolean) {
    await supabase.from("forum_threads").update({ is_pinned: !pinned }).eq("id", threadId);
    if (section) fetchThreads(section.id, page);
  }

  async function handleLock(threadId: string, locked: boolean) {
    await supabase.from("forum_threads").update({ is_locked: !locked }).eq("id", threadId);
    if (section) fetchThreads(section.id, page);
  }

  async function handleDelete(threadId: string, title: string) {
    if (!confirm(`Opravdu smazat vlákno "${title}" a všechny odpovědi?`)) return;
    await supabase.from("forum_threads").delete().eq("id", threadId);
    if (section) fetchThreads(section.id, page);
  }

  const totalPages = Math.ceil(totalThreads / THREADS_PER_PAGE);

  if (!section && !loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>😕</div>
        <h1 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "8px" }}>Sekce nenalezena</h1>
        <Link href="/forum" style={{ color: "var(--accent)", textDecoration: "none" }}>← Zpět na fórum</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontSize: "13px", color: "var(--text-dimmer)" }}>
        <Link href="/forum" style={{ color: "var(--accent)", textDecoration: "none" }}>Fórum</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "var(--text-muted)" }}>{section?.name || "..."}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
            {section?.icon} {section?.name}
          </h1>
          {section?.description && (
            <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>{section.description}</p>
          )}
        </div>
        {user && !isBanned && (
          <Link
            href={`/forum/nove-vlakno?section=${slug}`}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--bg-page)",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            📝 Nové vlákno
          </Link>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám vlákna...</p>
        </div>
      ) : threads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
          <p style={{ color: "var(--text-dim)", fontSize: "16px" }}>Zatím zde nejsou žádná vlákna</p>
          {user && !isBanned && (
            <Link href={`/forum/nove-vlakno?section=${slug}`} style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px" }}>
              Buďte první a založte nové vlákno →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {threads.map((t) => {
              const authorName = t.author?.display_name || t.author?.username || "Anonym";
              const lastPosterName = t.last_poster?.display_name || t.last_poster?.username || null;
              const initials = authorName.charAt(0).toUpperCase();

              return (
                <div
                  key={t.id}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  {/* Avatar */}
                  <div style={{ flexShrink: 0 }}>
                    {t.author?.avatar_url ? (
                      <Image src={t.author.avatar_url} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", background: "var(--border-hover)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", color: "var(--text-muted)", fontWeight: 600,
                      }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Title & meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/forum/${slug}/${t.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                        {t.is_pinned && <span title="Připnuto">📌</span>}
                        {t.is_locked && <span title="Zamčeno">🔒</span>}
                        {t.title}
                      </h3>
                    </Link>
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>
                      {authorName} · {timeAgo(t.created_at)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex" style={{ alignItems: "center", gap: "20px", flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-muted)" }}>{t.post_count}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-faint)" }}>odpovědí</div>
                    </div>
                    <div style={{ maxWidth: "150px" }}>
                      {lastPosterName && (
                        <div style={{ fontSize: "12px", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {lastPosterName}
                        </div>
                      )}
                      <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>{timeAgo(t.last_post_at)}</div>
                    </div>
                  </div>

                  {/* Admin actions */}
                  {isAdminOrMod && (
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <button
                        onClick={() => handlePin(t.id, t.is_pinned)}
                        title={t.is_pinned ? "Odepnout" : "Připnout"}
                        style={adminBtnStyle}
                      >
                        {t.is_pinned ? "📌" : "📍"}
                      </button>
                      <button
                        onClick={() => handleLock(t.id, t.is_locked)}
                        title={t.is_locked ? "Odemknout" : "Zamknout"}
                        style={adminBtnStyle}
                      >
                        {t.is_locked ? "🔓" : "🔒"}
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.title)}
                        title="Smazat"
                        style={{ ...adminBtnStyle, color: "#ff6b6b" }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "32px" }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    padding: "8px 14px",
                    background: p === page ? "var(--accent)" : "var(--bg-card)",
                    color: p === page ? "var(--bg-page)" : "var(--text-muted)",
                    border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: p === page ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const adminBtnStyle: React.CSSProperties = {
  padding: "6px 8px",
  background: "rgba(138,142,160,0.1)",
  border: "1px solid rgba(138,142,160,0.2)",
  borderRadius: "6px",
  fontSize: "14px",
  cursor: "pointer",
  color: "var(--text-muted)",
};
