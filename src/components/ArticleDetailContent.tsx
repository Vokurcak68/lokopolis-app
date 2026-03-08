"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { ArticleWithRelations, CommentWithAuthor, Tag } from "@/types/database";

interface ArticleDetailContentProps {
  article: ArticleWithRelations;
  initialComments: CommentWithAuthor[];
  tags: Tag[];
}

export default function ArticleDetailContent({
  article,
  initialComments,
  tags,
}: ArticleDetailContentProps) {
  const { user } = useAuth();
  const router = useRouter();
  const slug = article.slug;

  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAuthor = user && user.id === article.author_id;

  // Increment view count on mount (fire & forget)
  useEffect(() => {
    void (async () => {
      try {
        await supabase.rpc("increment_article_view", { target_article_id: article.id });
      } catch {}
    })();
  }, [article.id]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        article_id: article.id,
        author_id: user.id,
        content: newComment.trim(),
      })
      .select("*, author:profiles(*)")
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data as unknown as CommentWithAuthor]);
      setNewComment("");
    }
    setSubmitting(false);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatCommentDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div style={{ maxWidth: '896px', margin: '0 auto', padding: '64px 24px' }}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-8">
        <Link href="/" className="hover:text-primary transition-colors">
          Domů
        </Link>
        <span>/</span>
        <Link href="/clanky" className="hover:text-primary transition-colors">
          Články
        </Link>
        {article.category && (
          <>
            <span>/</span>
            <span className="text-primary">
              {article.category.icon} {article.category.name}
            </span>
          </>
        )}
      </nav>

      {/* Article header */}
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center">
        {article.title}
      </h1>

      <div className="flex items-center justify-center gap-4 text-sm text-text-muted mb-8">
        {/* Autor */}
        <div className="flex items-center gap-2">
          {article.author?.avatar_url ? (
            <Image
              src={article.author.avatar_url}
              alt=""
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {(article.author?.display_name || article.author?.username || "A")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}
          <span className="text-white font-medium">
            {article.author?.display_name || article.author?.username || "Anonym"}
          </span>
        </div>
        <span>·</span>
        <span>{formatDate(article.published_at)}</span>
      </div>

      {/* Author actions */}
      {isAuthor && (
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link
            href={`/clanky/${slug}/upravit`}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-bg-card border border-border-subtle text-text-nav hover:border-primary hover:text-primary transition-colors"
          >
            ✏️ Upravit článek
          </Link>
          <button
            onClick={async () => {
              if (!confirm("Opravdu chcete smazat tento článek? Tuto akci nelze vrátit zpět.")) return;
              setDeleting(true);
              const { error } = await supabase
                .from("articles")
                .delete()
                .eq("id", article.id);
              if (error) {
                alert("Chyba při mazání: " + error.message);
                setDeleting(false);
              } else {
                router.push("/clanky");
              }
            }}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-bg-card border border-border-subtle text-red-400 hover:border-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {deleting ? "Mazání…" : "🗑️ Smazat"}
          </button>
        </div>
      )}

      {/* Cover image */}
      {article.cover_image_url && (
        <div className="rounded-xl overflow-hidden mb-12 relative" style={{ maxHeight: "500px" }}>
          <Image
            src={article.cover_image_url}
            alt={article.title}
            width={1200}
            height={500}
            className="w-full object-cover"
            style={{ maxHeight: "500px" }}
            sizes="(max-width: 1200px) 100vw, 1200px"
            priority
          />
        </div>
      )}

      {/* Obsah */}
      <article
        className="article-content mb-16"
        dangerouslySetInnerHTML={{ __html: article.content || "<p>Tento článek zatím nemá obsah.</p>" }}
      />

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "48px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: "13px", color: "var(--text-dimmer)", marginRight: "4px", lineHeight: "28px" }}>🏷️</span>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/hledat?tag=${tag.slug}`}
              style={{
                display: "inline-block",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border-strong)",
                borderRadius: "20px",
                padding: "4px 12px",
                color: "var(--accent)",
                fontSize: "12px",
                textDecoration: "none",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-border)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-bg)")}
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Komentáře */}
      <section className="border-t border-border-subtle pt-10">
        <h2 className="text-xl font-bold text-white mb-6">
          Komentáře ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-text-muted mb-8">
            Zatím žádné komentáře. Buďte první!
          </p>
        ) : (
          <div className="space-y-6 mb-8">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-bg-card rounded-xl p-4 border border-border-subtle"
              >
                <div className="flex items-center gap-2 mb-2">
                  {comment.author?.avatar_url ? (
                    <Image
                      src={comment.author.avatar_url}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                      {(
                        comment.author?.display_name ||
                        comment.author?.username ||
                        "A"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-white font-medium">
                    {comment.author?.display_name ||
                      comment.author?.username ||
                      "Anonym"}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatCommentDate(comment.created_at)}
                  </span>
                </div>
                <p className="text-text-main text-sm whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Nový komentář */}
        {user ? (
          <form onSubmit={handleAddComment} className="flex flex-col gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Napište komentář…"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-white placeholder:text-text-muted/50 resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="self-end px-6 py-2 rounded-lg bg-primary text-bg-dark font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {submitting ? "Odesílání…" : "Odeslat komentář"}
            </button>
          </form>
        ) : (
          <div className="bg-bg-card rounded-xl p-6 border border-border-subtle text-center">
            <p className="text-text-muted mb-3">
              Pro přidání komentáře se musíte přihlásit.
            </p>
            <Link
              href="/prihlaseni"
              className="inline-block px-6 py-2 rounded-lg bg-primary text-bg-dark font-semibold hover:bg-primary-light transition-colors text-sm"
            >
              Přihlásit se
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
