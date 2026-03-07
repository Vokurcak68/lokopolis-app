"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import type { ForumSection } from "@/types/database";

interface SectionWithStats extends ForumSection {
  thread_count: number;
  post_count: number;
  last_thread_title: string | null;
  last_thread_id: string | null;
  last_post_at_val: string | null;
}

export default function ForumPage() {
  const { profile } = useAuth();
  const [sections, setSections] = useState<SectionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState<ForumSection | null>(null);
  const [newSection, setNewSection] = useState({ name: "", slug: "", description: "", icon: "", sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === "admin";

  const fetchSections = useCallback(async () => {
    try {
      // Two parallel queries: sections + all threads (lightweight)
      const [secRes, threadRes] = await Promise.all([
        supabase
          .from("forum_sections")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("forum_threads")
          .select("id, section_id, title, post_count, last_post_at")
          .order("last_post_at", { ascending: false }),
      ]);

      const secs = secRes.data;
      const allThreads = threadRes.data || [];
      if (!secs) { setSections([]); return; }

      // Group threads by section (single pass)
      const bySection = new Map<string, typeof allThreads>();
      for (const t of allThreads) {
        const arr = bySection.get(t.section_id) || [];
        arr.push(t);
        bySection.set(t.section_id, arr);
      }

      const enriched: SectionWithStats[] = secs.map((sec) => {
        const threads = bySection.get(sec.id) || [];
        const threadCount = threads.length;
        const totalPosts = threads.reduce((sum, t) => sum + (t.post_count || 0), 0);
        const lastThread = threads[0] || null; // already sorted by last_post_at DESC

        return {
          ...sec,
          thread_count: threadCount,
          post_count: totalPosts,
          last_thread_title: lastThread?.title || null,
          last_thread_id: lastThread?.id || null,
          last_post_at_val: lastThread?.last_post_at || null,
        };
      });

      setSections(enriched);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  async function handleAddSection() {
    if (!newSection.name.trim() || !newSection.slug.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("forum_sections").insert({
        name: newSection.name.trim(),
        slug: newSection.slug.trim(),
        description: newSection.description.trim() || null,
        icon: newSection.icon.trim() || null,
        sort_order: newSection.sort_order,
      });
      if (error) throw error;
      setNewSection({ name: "", slug: "", description: "", icon: "", sort_order: 0 });
      fetchSections();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSection() {
    if (!editingSection) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("forum_sections")
        .update({
          name: editingSection.name,
          slug: editingSection.slug,
          description: editingSection.description,
          icon: editingSection.icon,
          sort_order: editingSection.sort_order,
        })
        .eq("id", editingSection.id);
      if (error) throw error;
      setEditingSection(null);
      fetchSections();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSection(id: string, name: string) {
    if (!confirm(`Opravdu smazat sekci "${name}" a všechna její vlákna?`)) return;
    try {
      const { error } = await supabase.from("forum_sections").delete().eq("id", id);
      if (error) throw error;
      fetchSections();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    }
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
            <span style={{ color: "var(--text-primary)" }}>Diskuzní </span>
            <span style={{ color: "var(--accent)" }}>fórum</span>
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
            Povídejte si s ostatními modeláři, sdílejte zkušenosti a ptejte se
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              padding: "10px 20px",
              background: editMode ? "rgba(220,53,69,0.15)" : "var(--accent-border)",
              color: editMode ? "#ff6b6b" : "var(--accent)",
              border: `1px solid ${editMode ? "rgba(220,53,69,0.3)" : "var(--accent-border-strong)"}`,
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {editMode ? "✕ Zavřít správu" : "⚙️ Správa sekcí"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám fórum...</p>
        </div>
      ) : (
        <>
          {/* Sections list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sections.map((sec) => (
              <div key={sec.id}>
                {editingSection?.id === sec.id ? (
                  <div style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--accent)",
                    borderRadius: "12px",
                    padding: "20px",
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <input value={editingSection.name} onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })} placeholder="Název" style={inputStyle} />
                      <input value={editingSection.slug} onChange={(e) => setEditingSection({ ...editingSection, slug: e.target.value })} placeholder="Slug" style={inputStyle} />
                      <input value={editingSection.description || ""} onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })} placeholder="Popis" style={inputStyle} />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input value={editingSection.icon || ""} onChange={(e) => setEditingSection({ ...editingSection, icon: e.target.value })} placeholder="Ikona" style={{ ...inputStyle, flex: 1 }} />
                        <input type="number" value={editingSection.sort_order} onChange={(e) => setEditingSection({ ...editingSection, sort_order: parseInt(e.target.value) || 0 })} placeholder="Pořadí" style={{ ...inputStyle, width: "80px" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={handleUpdateSection} disabled={saving} style={{ ...btnStyle, background: "var(--accent)", color: "var(--bg-page)" }}>
                        {saving ? "Ukládám..." : "Uložit"}
                      </button>
                      <button onClick={() => setEditingSection(null)} style={{ ...btnStyle, background: "var(--border-hover)", color: "var(--text-muted)" }}>
                        Zrušit
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link href={`/forum/${sec.slug}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        transition: "all 0.2s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-hover)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "12px",
                        background: "var(--accent-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                        flexShrink: 0,
                      }}>
                        {sec.icon || "💬"}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>
                          {sec.name}
                        </h3>
                        {sec.description && (
                          <p style={{ fontSize: "13px", color: "var(--text-dimmer)", lineHeight: 1.4 }}>{sec.description}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="hidden md:flex" style={{ alignItems: "center", gap: "24px", flexShrink: 0 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent)" }}>{sec.thread_count}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>vláken</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-muted)" }}>{sec.post_count}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>příspěvků</div>
                        </div>
                        {sec.last_thread_title && (
                          <div style={{ maxWidth: "200px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {sec.last_thread_title}
                            </div>
                            {sec.last_post_at_val && (
                              <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>
                                {timeAgo(sec.last_post_at_val)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Admin buttons */}
                      {editMode && isAdmin && (
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }} onClick={(e) => e.preventDefault()}>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSection(sec); }}
                            style={{ padding: "6px 12px", background: "var(--accent-border)", border: "1px solid var(--accent-border-strong)", borderRadius: "6px", color: "var(--accent)", fontSize: "12px", cursor: "pointer" }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteSection(sec.id, sec.name); }}
                            style={{ padding: "6px 12px", background: "rgba(220,53,69,0.15)", border: "1px solid rgba(220,53,69,0.3)", borderRadius: "6px", color: "#ff6b6b", fontSize: "12px", cursor: "pointer" }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Add section form */}
          {editMode && isAdmin && (
            <div style={{
              background: "var(--bg-card)",
              border: "1px dashed var(--border-hover)",
              borderRadius: "12px",
              padding: "20px",
              marginTop: "16px",
            }}>
              <h4 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "12px", fontWeight: 600 }}>➕ Přidat sekci</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <input value={newSection.name} onChange={(e) => setNewSection({ ...newSection, name: e.target.value })} placeholder="Název" style={inputStyle} />
                <input value={newSection.slug} onChange={(e) => setNewSection({ ...newSection, slug: e.target.value })} placeholder="Slug (url-friendly)" style={inputStyle} />
                <input value={newSection.description} onChange={(e) => setNewSection({ ...newSection, description: e.target.value })} placeholder="Popis" style={inputStyle} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={newSection.icon} onChange={(e) => setNewSection({ ...newSection, icon: e.target.value })} placeholder="Emoji ikona" style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" value={newSection.sort_order} onChange={(e) => setNewSection({ ...newSection, sort_order: parseInt(e.target.value) || 0 })} placeholder="Pořadí" style={{ ...inputStyle, width: "80px" }} />
                </div>
              </div>
              <button onClick={handleAddSection} disabled={saving || !newSection.name.trim() || !newSection.slug.trim()} style={{
                padding: "10px 20px",
                background: !newSection.name.trim() || !newSection.slug.trim() ? "var(--border-hover)" : "var(--accent)",
                color: !newSection.name.trim() || !newSection.slug.trim() ? "var(--text-dimmer)" : "var(--bg-page)",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: !newSection.name.trim() || !newSection.slug.trim() ? "not-allowed" : "pointer",
              }}>
                {saving ? "Přidávám..." : "Přidat sekci"}
              </button>
            </div>
          )}

          {/* Admin links */}
          {(isAdmin || profile?.role === "moderator") && (
            <div style={{ display: "flex", gap: "12px", marginTop: "32px", flexWrap: "wrap" }}>
              <Link href="/forum/nahlasene" style={{
                padding: "10px 20px",
                background: "rgba(220,53,69,0.1)",
                border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: "10px",
                color: "#ff6b6b",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}>
                ⚠️ Nahlášené příspěvky
              </Link>
              <Link href="/forum/bany" style={{
                padding: "10px 20px",
                background: "rgba(138,142,160,0.1)",
                border: "1px solid rgba(138,142,160,0.3)",
                borderRadius: "10px",
                color: "var(--text-dim)",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}>
                🚫 Správa banů
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-input)",
  borderRadius: "8px",
  color: "var(--text-body)",
  fontSize: "14px",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  border: "none",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};
