"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo, formatCzechDate } from "@/lib/timeAgo";
import type { ForumSection, ForumThread, Profile, ForumReaction } from "@/types/database";

interface PostRow {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  author: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "created_at"> | null;
}

const POSTS_PER_PAGE = 25;
const EMOJIS = ["👍", "❤️", "😂"];

export default function ThreadPage() {
  const params = useParams();
  const sectionSlug = params["section-slug"] as string;
  const threadId = params["thread-id"] as string;
  const { user, profile } = useAuth();
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const [section, setSection] = useState<ForumSection | null>(null);
  const [thread, setThread] = useState<(ForumThread & { author: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "created_at"> | null }) | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isBanned, setIsBanned] = useState(false);

  // Reply
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingThreadContent, setEditingThreadContent] = useState(false);
  const [editContent, setEditContent] = useState("");

  // Reactions
  const [threadReactions, setThreadReactions] = useState<ForumReaction[]>([]);
  const [postReactions, setPostReactions] = useState<Record<string, ForumReaction[]>>({});

  // Report modal
  const [reportTarget, setReportTarget] = useState<{ postId?: string; threadId?: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Author post counts cache
  const [authorPostCounts, setAuthorPostCounts] = useState<Record<string, number>>({});

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";

  const fetchThread = useCallback(async () => {
    const { data: sec } = await supabase
      .from("forum_sections")
      .select("*")
      .eq("slug", sectionSlug)
      .single();
    if (sec) setSection(sec);

    const { data: t } = await supabase
      .from("forum_threads")
      .select("*, author:profiles!forum_threads_author_id_fkey(id, display_name, username, avatar_url, created_at)")
      .eq("id", threadId)
      .single();
    if (t) setThread(t as typeof thread);
    return t;
  }, [sectionSlug, threadId]);

  const fetchPosts = useCallback(async (p: number) => {
    const from = (p - 1) * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;

    const { count } = await supabase
      .from("forum_posts")
      .select("*", { count: "exact", head: true })
      .eq("thread_id", threadId);
    setTotalPosts(count || 0);

    const { data } = await supabase
      .from("forum_posts")
      .select("*, author:profiles!forum_posts_author_id_fkey(id, display_name, username, avatar_url, created_at)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .range(from, to);

    setPosts((data as unknown as PostRow[]) || []);
  }, [threadId]);

  const fetchReactions = useCallback(async (postIds: string[]) => {
    // Parallel: thread reactions + post reactions for visible posts only
    const threadReactionsPromise = supabase
      .from("forum_reactions")
      .select("*")
      .eq("thread_id", threadId);

    const postReactionsPromise = postIds.length > 0
      ? supabase.from("forum_reactions").select("*").in("post_id", postIds)
      : Promise.resolve({ data: [] as ForumReaction[] });

    const [trRes, prRes] = await Promise.all([threadReactionsPromise, postReactionsPromise]);

    setThreadReactions((trRes.data as ForumReaction[]) || []);

    const pr = prRes.data as ForumReaction[] | null;
    if (pr) {
      const grouped: Record<string, ForumReaction[]> = {};
      for (const r of pr) {
        if (r.post_id) {
          if (!grouped[r.post_id]) grouped[r.post_id] = [];
          grouped[r.post_id].push(r);
        }
      }
      setPostReactions(grouped);
    } else {
      setPostReactions({});
    }
  }, [threadId]);

  const fetchAuthorPostCounts = useCallback(async (authorIds: string[]) => {
    // Fetch all post counts in parallel instead of sequential loop
    const uncached = authorIds.filter(aid => authorPostCounts[aid] === undefined);
    if (uncached.length === 0) return;

    const results = await Promise.all(
      uncached.map(aid =>
        supabase
          .from("forum_posts")
          .select("*", { count: "exact", head: true })
          .eq("author_id", aid)
          .then(({ count }) => ({ aid, count: count || 0 }))
      )
    );

    const counts: Record<string, number> = {};
    for (const r of results) counts[r.aid] = r.count;
    setAuthorPostCounts(prev => ({ ...prev, ...counts }));
  }, [authorPostCounts]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      // Parallel: thread + posts, then reactions (needs post IDs)
      const [, postsData] = await Promise.all([
        fetchThread(),
        fetchPosts(page),
      ]);
      // fetchReactions now called in a separate effect after posts are set
      setLoading(false);
    }
    init();
  }, [fetchThread, fetchPosts, page]);

  // Fetch reactions when posts change (needs post IDs)
  useEffect(() => {
    if (loading) return;
    const postIds = posts.map(p => p.id);
    fetchReactions(postIds);
  }, [posts, loading, fetchReactions]);

  // Fetch author post counts when posts change
  useEffect(() => {
    if (posts.length === 0 && !thread) return;
    const ids = new Set<string>();
    if (thread?.author_id) ids.add(thread.author_id);
    posts.forEach(p => ids.add(p.author_id));
    if (ids.size > 0) fetchAuthorPostCounts(Array.from(ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, thread]);

  // Check ban
  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_forum_banned", { check_user_id: user.id }).then(({ data }) => {
      if (data) setIsBanned(true);
    });
  }, [user]);

  async function handleReply() {
    if (!replyContent.trim() || !user || !thread) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("forum_posts").insert({
        thread_id: thread.id,
        author_id: user.id,
        content: replyContent.trim(),
      });
      if (error) throw error;
      setReplyContent("");
      // Go to last page
      const newCount = totalPosts + 1;
      const lastPage = Math.ceil(newCount / POSTS_PER_PAGE);
      setPage(lastPage);
      await fetchPosts(lastPage);
      await fetchThread();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba při odesílání");
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuote(authorName: string, content: string) {
    const lines = content.split("\n").map(l => `> ${l}`).join("\n");
    const quote = `> Citát od @${authorName}:\n${lines}\n\n`;
    setReplyContent(prev => prev + quote);
    replyRef.current?.focus();
    replyRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleEditPost(postId: string) {
    if (!editContent.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("forum_posts")
        .update({ content: editContent.trim() })
        .eq("id", postId);
      if (error) throw error;
      setEditingPostId(null);
      setEditContent("");
      await fetchPosts(page);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditThreadContent() {
    if (!editContent.trim() || !thread) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("forum_threads")
        .update({ content: editContent.trim() })
        .eq("id", thread.id);
      if (error) throw error;
      setEditingThreadContent(false);
      setEditContent("");
      await fetchThread();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePost(postId: string) {
    if (!confirm("Opravdu smazat tento příspěvek?")) return;
    await supabase.from("forum_posts").delete().eq("id", postId);
    await fetchPosts(page);
    await fetchThread();
  }

  async function handleHidePost(postId: string, currentlyHidden: boolean) {
    await supabase.from("forum_posts").update({ is_hidden: !currentlyHidden }).eq("id", postId);
    await fetchPosts(page);
  }

  async function handleToggleReaction(emoji: string, targetType: "thread" | "post", targetId: string) {
    if (!user) return;
    const reactions = targetType === "thread" ? threadReactions : (postReactions[targetId] || []);
    const existing = reactions.find(r => r.user_id === user.id);

    if (existing) {
      // Remove
      await supabase.from("forum_reactions").delete().eq("id", existing.id);
    } else {
      // Add
      const payload: Record<string, string> = {
        user_id: user.id,
        emoji,
      };
      if (targetType === "thread") payload.thread_id = targetId;
      else payload.post_id = targetId;
      await supabase.from("forum_reactions").insert(payload);
    }
    await fetchReactions(posts.map(p => p.id));
  }

  async function handleReport() {
    if (!reportReason.trim() || !user || !reportTarget) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("forum_reports").insert({
        post_id: reportTarget.postId || null,
        thread_id: reportTarget.threadId || null,
        reporter_id: user.id,
        reason: reportReason.trim(),
      });
      if (error) throw error;
      setReportTarget(null);
      setReportReason("");
      alert("Nahlášení bylo odesláno. Děkujeme.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setReportSubmitting(false);
    }
  }

  async function handleDeleteThread() {
    if (!thread) return;
    if (!confirm(`Opravdu smazat celé vlákno "${thread.title}"?`)) return;
    await supabase.from("forum_threads").delete().eq("id", thread.id);
    window.location.href = `/forum/${sectionSlug}`;
  }

  async function handlePin() {
    if (!thread) return;
    await supabase.from("forum_threads").update({ is_pinned: !thread.is_pinned }).eq("id", thread.id);
    await fetchThread();
  }

  async function handleLock() {
    if (!thread) return;
    await supabase.from("forum_threads").update({ is_locked: !thread.is_locked }).eq("id", thread.id);
    await fetchThread();
  }

  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám vlákno...</p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>😕</div>
        <h1 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "8px" }}>Vlákno nenalezeno</h1>
        <Link href="/forum" style={{ color: "var(--accent)", textDecoration: "none" }}>← Zpět na fórum</Link>
      </div>
    );
  }

  const threadAuthorName = thread.author?.display_name || thread.author?.username || "Anonym";

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontSize: "13px", color: "var(--text-dimmer)" }}>
        <Link href="/forum" style={{ color: "var(--accent)", textDecoration: "none" }}>Fórum</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <Link href={`/forum/${sectionSlug}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{section?.name || sectionSlug}</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "var(--text-muted)" }}>{thread.title}</span>
      </div>

      {/* Thread title & admin actions */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {thread.is_pinned && <span>📌</span>}
          {thread.is_locked && <span>🔒</span>}
          {thread.title}
        </h1>
        {isAdminOrMod && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
            <button onClick={handlePin} style={modBtnStyle}>
              {thread.is_pinned ? "📌 Odepnout" : "📍 Připnout"}
            </button>
            <button onClick={handleLock} style={modBtnStyle}>
              {thread.is_locked ? "🔓 Odemknout" : "🔒 Zamknout"}
            </button>
            <button onClick={handleDeleteThread} style={{ ...modBtnStyle, color: "#ff6b6b", borderColor: "rgba(220,53,69,0.3)" }}>
              🗑️ Smazat vlákno
            </button>
          </div>
        )}
      </div>

      {/* First post (thread content) */}
      <PostCard
        authorName={threadAuthorName}
        authorAvatar={thread.author?.avatar_url || null}
        authorRegistered={thread.author?.created_at || thread.created_at}
        authorPostCount={authorPostCounts[thread.author_id] || 0}
        content={thread.content}
        createdAt={thread.created_at}
        updatedAt={thread.updated_at}
        isHidden={false}
        isOwn={user?.id === thread.author_id}
        isAdminOrMod={isAdminOrMod}
        isEditing={editingThreadContent}
        editContent={editContent}
        onEditContentChange={setEditContent}
        onStartEdit={() => { setEditingThreadContent(true); setEditContent(thread.content); }}
        onSaveEdit={handleEditThreadContent}
        onCancelEdit={() => { setEditingThreadContent(false); setEditContent(""); }}
        onQuote={() => handleQuote(threadAuthorName, thread.content)}
        onReport={() => setReportTarget({ threadId: thread.id })}
        onDelete={undefined}
        onHide={undefined}
        reactions={threadReactions}
        userId={user?.id || null}
        onToggleReaction={(emoji) => handleToggleReaction(emoji, "thread", thread.id)}
        submitting={submitting}
        showUser={true}
      />

      {/* Posts */}
      {posts.map((post) => {
        const postAuthorName = post.author?.display_name || post.author?.username || "Anonym";
        return (
          <PostCard
            key={post.id}
            authorName={postAuthorName}
            authorAvatar={post.author?.avatar_url || null}
            authorRegistered={post.author?.created_at || post.created_at}
            authorPostCount={authorPostCounts[post.author_id] || 0}
            content={post.content}
            createdAt={post.created_at}
            updatedAt={post.updated_at}
            isHidden={post.is_hidden}
            isOwn={user?.id === post.author_id}
            isAdminOrMod={isAdminOrMod}
            isEditing={editingPostId === post.id}
            editContent={editContent}
            onEditContentChange={setEditContent}
            onStartEdit={() => { setEditingPostId(post.id); setEditContent(post.content); }}
            onSaveEdit={() => handleEditPost(post.id)}
            onCancelEdit={() => { setEditingPostId(null); setEditContent(""); }}
            onQuote={() => handleQuote(postAuthorName, post.content)}
            onReport={() => setReportTarget({ postId: post.id })}
            onDelete={() => handleDeletePost(post.id)}
            onHide={() => handleHidePost(post.id, post.is_hidden)}
            reactions={postReactions[post.id] || []}
            userId={user?.id || null}
            onToggleReaction={(emoji) => handleToggleReaction(emoji, "post", post.id)}
            submitting={submitting}
            showUser={true}
          />
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px", marginBottom: "24px" }}>
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

      {/* Reply editor */}
      {thread.is_locked ? (
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "24px",
          textAlign: "center",
          marginTop: "24px",
        }}>
          <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>🔒 Toto vlákno je zamčené</p>
        </div>
      ) : isBanned ? (
        <div style={{
          background: "rgba(220,53,69,0.05)",
          border: "1px solid rgba(220,53,69,0.2)",
          borderRadius: "12px",
          padding: "24px",
          textAlign: "center",
          marginTop: "24px",
        }}>
          <p style={{ fontSize: "15px", color: "#ff6b6b" }}>🚫 Máte zákaz přispívat na fórum</p>
        </div>
      ) : user ? (
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "20px",
          marginTop: "24px",
        }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-body)", marginBottom: "12px" }}>
            ✍️ Odpovědět
          </h3>
          <textarea
            ref={replyRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Napište svou odpověď..."
            rows={5}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              color: "var(--text-body)",
              fontSize: "14px",
              lineHeight: 1.6,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <button
              onClick={handleReply}
              disabled={submitting || !replyContent.trim()}
              style={{
                padding: "10px 24px",
                background: !replyContent.trim() ? "var(--border-hover)" : "var(--accent)",
                color: !replyContent.trim() ? "var(--text-dimmer)" : "var(--bg-page)",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: !replyContent.trim() ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Odesílám..." : "Odeslat odpověď"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "24px",
          textAlign: "center",
          marginTop: "24px",
        }}>
          <p style={{ fontSize: "14px", color: "var(--text-dim)" }}>
            Pro odpověď se musíte{" "}
            <Link href="/prihlaseni" style={{ color: "var(--accent)", textDecoration: "none" }}>přihlásit</Link>
          </p>
        </div>
      )}

      {/* Report modal */}
      {reportTarget && (
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
          onClick={(e) => { if (e.target === e.currentTarget) { setReportTarget(null); setReportReason(""); } }}
        >
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "480px",
            width: "100%",
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>⚠️ Nahlásit příspěvek</h2>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Popište důvod nahlášení..."
              rows={4}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setReportTarget(null); setReportReason(""); }}
                style={{ padding: "10px 20px", background: "var(--border-hover)", color: "var(--text-muted)", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}
              >
                Zrušit
              </button>
              <button
                onClick={handleReport}
                disabled={reportSubmitting || !reportReason.trim()}
                style={{
                  padding: "10px 20px",
                  background: !reportReason.trim() ? "var(--border-hover)" : "#ef4444",
                  color: !reportReason.trim() ? "var(--text-dimmer)" : "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: !reportReason.trim() ? "not-allowed" : "pointer",
                }}
              >
                {reportSubmitting ? "Odesílám..." : "Odeslat nahlášení"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PostCard component
   ============================================================ */

interface PostCardProps {
  authorName: string;
  authorAvatar: string | null;
  authorRegistered: string;
  authorPostCount: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  isHidden: boolean;
  isOwn: boolean;
  isAdminOrMod: boolean;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onQuote: () => void;
  onReport: () => void;
  onDelete: (() => void) | undefined;
  onHide: (() => void) | undefined;
  reactions: ForumReaction[];
  userId: string | null;
  onToggleReaction: (emoji: string) => void;
  submitting: boolean;
  showUser: boolean;
}

function PostCard(props: PostCardProps) {
  const initials = props.authorName.charAt(0).toUpperCase();
  const wasEdited = props.createdAt !== props.updatedAt;

  if (props.isHidden && !props.isAdminOrMod) return null;

  return (
    <div style={{
      background: props.isHidden ? "rgba(220,53,69,0.03)" : "var(--bg-card)",
      border: `1px solid ${props.isHidden ? "rgba(220,53,69,0.2)" : "var(--border)"}`,
      borderRadius: "12px",
      marginBottom: "12px",
      overflow: "hidden",
    }}>
      {props.isHidden && (
        <div style={{ background: "rgba(220,53,69,0.1)", padding: "6px 20px", fontSize: "12px", color: "#ff6b6b", fontWeight: 600 }}>
          [Skrytý příspěvek]
        </div>
      )}
      <div style={{ display: "flex", gap: "16px", padding: "20px" }}>
        {/* Author sidebar */}
        <div className="hidden md:flex" style={{ flexDirection: "column", alignItems: "center", width: "120px", flexShrink: 0 }}>
          {props.authorAvatar ? (
            <Image src={props.authorAvatar} alt="" width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", marginBottom: "8px" }} />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: "var(--border-hover)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", color: "var(--text-muted)", fontWeight: 600, marginBottom: "8px",
            }}>
              {initials}
            </div>
          )}
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-body)", textAlign: "center" }}>{props.authorName}</div>
          <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "4px" }}>
            Registrován: {formatCzechDate(props.authorRegistered)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>
            Příspěvků: {props.authorPostCount}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Mobile author info */}
          <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            {props.authorAvatar ? (
              <Image src={props.authorAvatar} alt="" width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: "50%", background: "var(--border-hover)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", color: "var(--text-muted)",
              }}>
                {initials}
              </div>
            )}
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-body)" }}>{props.authorName}</span>
          </div>

          {/* Date */}
          <div style={{ fontSize: "12px", color: "var(--text-faint)", marginBottom: "12px" }}>
            {timeAgo(props.createdAt)}
            {wasEdited && <span style={{ color: "var(--text-dimmer)", marginLeft: "8px" }}>(upraveno)</span>}
          </div>

          {/* Content or edit form */}
          {props.isEditing ? (
            <div>
              <textarea
                value={props.editContent}
                onChange={(e) => props.onEditContentChange(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-input)",
                  borderRadius: "8px",
                  color: "var(--text-body)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={props.onSaveEdit} disabled={props.submitting} style={{ padding: "8px 16px", background: "var(--accent)", color: "var(--bg-page)", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {props.submitting ? "Ukládám..." : "Uložit"}
                </button>
                <button onClick={props.onCancelEdit} style={{ padding: "8px 16px", background: "var(--border-hover)", color: "var(--text-muted)", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                  Zrušit
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "14px", color: "var(--text-body)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {props.content.split("\n").map((line, i) => {
                if (line.startsWith("> ")) {
                  return (
                    <div key={i} style={{ borderLeft: "3px solid var(--border-hover)", paddingLeft: "12px", color: "var(--text-dim)", fontStyle: "italic", margin: "4px 0" }}>
                      {line.substring(2)}
                    </div>
                  );
                }
                return <div key={i}>{line || "\u00A0"}</div>;
              })}
            </div>
          )}

          {/* Reactions */}
          {!props.isEditing && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
              {EMOJIS.map((emoji) => {
                const count = props.reactions.filter(r => r.emoji === emoji).length;
                const myReaction = props.reactions.find(r => r.user_id === props.userId && r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => props.onToggleReaction(emoji)}
                    disabled={!props.userId}
                    style={{
                      padding: "4px 10px",
                      background: myReaction ? "var(--accent-border)" : "rgba(138,142,160,0.08)",
                      border: `1px solid ${myReaction ? "rgba(240,160,48,0.4)" : "rgba(138,142,160,0.15)"}`,
                      borderRadius: "20px",
                      fontSize: "13px",
                      cursor: props.userId ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      color: myReaction ? "var(--accent)" : "var(--text-dim)",
                      transition: "all 0.15s",
                    }}
                  >
                    {emoji} {count > 0 && <span style={{ fontSize: "12px" }}>{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          {!props.isEditing && (
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
              {props.userId && (
                <button onClick={props.onQuote} style={actionBtnStyle}>
                  💬 Citovat
                </button>
              )}
              {(props.isOwn || props.isAdminOrMod) && (
                <button onClick={props.onStartEdit} style={actionBtnStyle}>
                  ✏️ Upravit
                </button>
              )}
              {props.onDelete && (props.isOwn || props.isAdminOrMod) && (
                <button onClick={props.onDelete} style={{ ...actionBtnStyle, color: "#ff6b6b" }}>
                  🗑️ Smazat
                </button>
              )}
              {props.onHide && props.isAdminOrMod && (
                <button onClick={props.onHide} style={{ ...actionBtnStyle, color: "#ff9800" }}>
                  {props.isHidden ? "👁️ Zobrazit" : "🙈 Skrýt"}
                </button>
              )}
              {props.userId && (
                <button onClick={props.onReport} style={{ ...actionBtnStyle, color: "#ff6b6b" }}>
                  ⚠️ Nahlásit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const modBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "rgba(138,142,160,0.1)",
  border: "1px solid rgba(138,142,160,0.2)",
  borderRadius: "6px",
  color: "var(--text-muted)",
  fontSize: "12px",
  cursor: "pointer",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "none",
  border: "none",
  color: "var(--text-dimmer)",
  fontSize: "12px",
  cursor: "pointer",
  transition: "color 0.15s",
};
