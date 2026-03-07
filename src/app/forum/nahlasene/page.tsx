"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import type { ForumReportStatus, Profile } from "@/types/database";

interface ReportRow {
  id: string;
  post_id: string | null;
  thread_id: string | null;
  reason: string;
  status: ForumReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: Pick<Profile, "display_name" | "username"> | null;
  post: { content: string; thread_id: string; thread: { title: string; section: { slug: string } | null } | null } | null;
  thread: { title: string; section: { slug: string } | null } | null;
}

export default function ReportsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ForumReportStatus | "all">("pending");

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("forum_reports")
        .select(`
          id, post_id, thread_id, reason, status, resolved_by, resolved_at, created_at,
          reporter:profiles!forum_reports_reporter_id_fkey(display_name, username),
          post:forum_posts(content, thread_id, thread:forum_threads(title, section:forum_sections(slug))),
          thread:forum_threads(title, section:forum_sections(slug))
        `)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data } = await query;
      setReports((data as unknown as ReportRow[]) || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!authLoading && isAdminOrMod) fetchReports();
    else if (!authLoading) setLoading(false);
  }, [fetchReports, authLoading, isAdminOrMod]);

  async function handleResolve(reportId: string, newStatus: "resolved" | "dismissed") {
    if (!profile) return;
    await supabase.from("forum_reports").update({
      status: newStatus,
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
    }).eq("id", reportId);
    fetchReports();
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
        <span style={{ color: "#a0a4b8" }}>Nahlášené příspěvky</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", marginBottom: "24px" }}>
        ⚠️ Nahlášené příspěvky
      </h1>

      {/* Filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {([
          { value: "pending", label: "Čekající" },
          { value: "resolved", label: "Vyřešené" },
          { value: "dismissed", label: "Zamítnuté" },
          { value: "all", label: "Vše" },
        ] as { value: ForumReportStatus | "all"; label: string }[]).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "8px 16px",
              background: filter === f.value ? "rgba(240,160,48,0.15)" : "#1a1e2e",
              border: `1px solid ${filter === f.value ? "#f0a030" : "#252838"}`,
              borderRadius: "8px",
              color: filter === f.value ? "#f0a030" : "#a0a4b8",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "#6a6e80", fontSize: "14px" }}>Načítám...</p>
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
          <p style={{ color: "#8a8ea0", fontSize: "16px" }}>Žádná nahlášení</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {reports.map((r) => {
            const reporterName = r.reporter?.display_name || r.reporter?.username || "Anonym";
            let targetTitle = "";
            let targetLink = "#";
            let contentPreview = "";

            if (r.post && r.post.thread) {
              targetTitle = r.post.thread.title;
              const secSlug = r.post.thread.section?.slug || "forum";
              targetLink = `/forum/${secSlug}/${r.post.thread_id}`;
              contentPreview = r.post.content.substring(0, 200);
            } else if (r.thread) {
              targetTitle = r.thread.title;
              const secSlug = r.thread.section?.slug || "forum";
              targetLink = `/forum/${secSlug}/${r.thread_id}`;
            }

            return (
              <div key={r.id} style={{
                background: "#1a1e2e",
                border: "1px solid #252838",
                borderRadius: "12px",
                padding: "20px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "#555a70", marginBottom: "4px" }}>
                      Nahlásil: <span style={{ color: "#a0a4b8" }}>{reporterName}</span> · {timeAgo(r.created_at)}
                    </div>
                    <Link href={targetLink} style={{ fontSize: "15px", fontWeight: 600, color: "#e0e0e0", textDecoration: "none" }}>
                      {targetTitle}
                    </Link>
                  </div>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background:
                      r.status === "pending" ? "rgba(240,160,48,0.15)" :
                      r.status === "resolved" ? "rgba(34,197,94,0.15)" :
                      "rgba(138,142,160,0.15)",
                    color:
                      r.status === "pending" ? "#f0a030" :
                      r.status === "resolved" ? "#22c55e" :
                      "#8a8ea0",
                  }}>
                    {r.status === "pending" ? "Čekající" : r.status === "resolved" ? "Vyřešeno" : "Zamítnuto"}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#ff6b6b", marginBottom: "8px" }}>
                  Důvod: {r.reason}
                </div>

                {contentPreview && (
                  <div style={{
                    fontSize: "12px",
                    color: "#6a6e80",
                    background: "#1e2233",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    lineHeight: 1.5,
                  }}>
                    {contentPreview}{contentPreview.length >= 200 ? "..." : ""}
                  </div>
                )}

                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleResolve(r.id, "resolved")}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: "6px",
                        color: "#22c55e",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ✅ Vyřešit
                    </button>
                    <button
                      onClick={() => handleResolve(r.id, "dismissed")}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(138,142,160,0.1)",
                        border: "1px solid rgba(138,142,160,0.2)",
                        borderRadius: "6px",
                        color: "#8a8ea0",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ❌ Zamítnout
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
