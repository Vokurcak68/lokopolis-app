"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type {
  ArticleWithRelations,
  CommentWithAuthor,
} from "@/types/database";

export default function ArticleDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();

  const [article, setArticle] = useState<ArticleWithRelations | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchArticle() {
      setLoading(true);
      const { data, error } = await supabase
        .from("articles")
        .select("*, author:profiles(*), category:categories(*)")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setArticle(data as unknown as ArticleWithRelations);
      setLoading(false);
    }
    fetchArticle();
  }, [slug]);

  useEffect(() => {
    async function fetchComments() {
      if (!article) return;
      const { data } = await supabase
        .from("comments")
        .select("*, author:profiles(*)")
        .eq("article_id", article.id)
        .eq("status", "published")
        .order("created_at", { ascending: true });

      if (data) {
        setComments(data as unknown as CommentWithAuthor[]);
      }
    }
    fetchComments();
  }, [article]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !article || !newComment.trim()) return;

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

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-bg-card rounded w-3/4" />
          <div className="h-4 bg-bg-card rounded w-1/4" />
          <div className="h-64 bg-bg-card rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 bg-bg-card rounded" />
            <div className="h-4 bg-bg-card rounded w-5/6" />
            <div className="h-4 bg-bg-card rounded w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Článek nenalezen
        </h1>
        <p className="text-text-muted mb-6">
          Tento článek neexistuje nebo byl odstraněn.
        </p>
        <Link
          href="/clanky"
          className="text-primary hover:underline"
        >
          ← Zpět na články
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
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
            <img
              src={article.author.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
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

      {/* Cover image */}
      {article.cover_image_url && (
        <div className="rounded-xl overflow-hidden mb-12">
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="w-full max-h-[500px] object-cover"
          />
        </div>
      )}

      {/* Obsah */}
      <article
        className="article-content mb-16"
        dangerouslySetInnerHTML={{ __html: article.content || "<p>Tento článek zatím nemá obsah.</p>" }}
      />

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
                    <img
                      src={comment.author.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
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
