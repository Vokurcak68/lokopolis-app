"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import CategoryIcon from "@/components/CategoryIcon";

interface MyArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  verified: boolean;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category: { name: string; icon: string | null; slug: string } | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MyArticlesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<MyArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/prihlaseni");
      return;
    }

    async function fetchMyArticles() {
      const { data } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, status, verified, cover_image_url, published_at, created_at, updated_at, category:categories(name, icon, slug)")
        .eq("author_id", user!.id)
        .order("updated_at", { ascending: false });

      setArticles((data as unknown as MyArticle[]) || []);
      setLoading(false);
    }

    fetchMyArticles();
  }, [user, authLoading, router]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Opravdu smazat „${title}"?`)) return;
    await supabase.from("articles").delete().eq("id", id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  const filtered = articles.filter((a) => {
    if (filter === "draft") return a.status === "draft";
    if (filter === "published") return a.status === "published";
    return true;
  });

  const draftCount = articles.filter((a) => a.status === "draft").length;
  const publishedCount = articles.filter((a) => a.status === "published").length;

  if (authLoading || loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-body)" }}>Načítání...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            📝 Moje články
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-body)" }}>
            {articles.length} {articles.length === 1 ? "článek" : articles.length < 5 ? "články" : "článků"}
            {draftCount > 0 && <span style={{ color: "#f0a030" }}> · {draftCount} {draftCount === 1 ? "koncept" : draftCount < 5 ? "koncepty" : "konceptů"}</span>}
          </p>
        </div>
        <Link
          href="/novy-clanek"
          style={{
            padding: "10px 20px",
            background: "#f0a030",
            color: "#000",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + Nový článek
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[
          { key: "all" as const, label: "Všechny", count: articles.length },
          { key: "draft" as const, label: "Koncepty", count: draftCount },
          { key: "published" as const, label: "Publikované", count: publishedCount },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 500,
              border: "1px solid",
              borderColor: filter === f.key ? "#f0a030" : "var(--border-color)",
              background: filter === f.key ? "rgba(240, 160, 48, 0.1)" : "transparent",
              color: filter === f.key ? "#f0a030" : "var(--text-body)",
              cursor: "pointer",
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Articles list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📄</div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            {filter === "draft" ? "Žádné koncepty" : filter === "published" ? "Žádné publikované články" : "Zatím nemáte žádné články"}
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-body)", marginBottom: "20px" }}>
            {filter === "all" ? "Napište svůj první článek!" : ""}
          </p>
          {filter === "all" && (
            <Link
              href="/novy-clanek"
              style={{
                padding: "10px 24px",
                background: "#f0a030",
                color: "#000",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Napsat článek
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((article) => (
            <div
              key={article.id}
              style={{
                display: "flex",
                gap: "16px",
                padding: "16px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                alignItems: "center",
              }}
            >
              {/* Thumbnail */}
              <div style={{ width: "80px", height: "60px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--bg-surface)" }}>
                {article.cover_image_url ? (
                  <Image src={article.cover_image_url} alt="" fill style={{ objectFit: "cover" }} sizes="80px" />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {article.category && <CategoryIcon slug={article.category.slug} emoji={article.category.icon || undefined} size={24} style={{ opacity: 0.3 }} />}
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  {/* Status badge */}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: article.status === "published"
                        ? (article.verified ? "rgba(34, 197, 94, 0.1)" : "rgba(234, 179, 8, 0.1)")
                        : "rgba(148, 163, 184, 0.1)",
                      color: article.status === "published"
                        ? (article.verified ? "#22c55e" : "#eab308")
                        : "#94a3b8",
                    }}
                  >
                    {article.status === "draft" ? "Koncept" : article.verified ? "Publikováno ✓" : "Čeká na schválení"}
                  </span>
                  {article.category && (
                    <span style={{ fontSize: "12px", color: "var(--text-body)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CategoryIcon slug={article.category.slug} emoji={article.category.icon || undefined} size={14} />
                      {article.category.name}
                    </span>
                  )}
                </div>

                <Link
                  href={article.status === "published" ? `/clanky/${article.slug}` : `/clanky/${article.slug}/upravit`}
                  style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", lineHeight: 1.3 }}
                >
                  {article.title}
                </Link>

                <p style={{ fontSize: "12px", color: "var(--text-body)", marginTop: "4px", opacity: 0.7 }}>
                  {article.status === "published" ? `Publikováno ${formatDate(article.published_at)}` : `Upraveno ${formatDate(article.updated_at)}`}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <Link
                  href={`/clanky/${article.slug}/upravit`}
                  style={{
                    padding: "6px 14px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-body)",
                    textDecoration: "none",
                    background: "transparent",
                  }}
                >
                  ✏️
                </Link>
                <button
                  onClick={() => handleDelete(article.id, article.title)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
