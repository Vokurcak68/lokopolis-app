"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ArticleWithRelations, Category } from "@/types/database";

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [category, setCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch category
      const { data: catData } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .single();

      if (catData) {
        setCategory(catData);

        // Fetch articles in this category
        const { data: artData } = await supabase
          .from("articles")
          .select("*, author:profiles(*), category:categories(*)")
          .eq("status", "published")
          .eq("category_id", catData.id)
          .order("published_at", { ascending: false });

        if (artData) {
          setArticles(artData as unknown as ArticleWithRelations[]);
        }
      }

      setLoading(false);
    }
    fetchData();
  }, [slug]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-card rounded w-1/3" />
          <div className="h-4 bg-bg-card rounded w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-bg-card border border-border-subtle">
                <div className="h-48 bg-bg-card-hover rounded-t-xl" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-bg-card-hover rounded w-1/3" />
                  <div className="h-6 bg-bg-card-hover rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-white mb-2">Kategorie nenalezena</h1>
        <p className="text-text-muted mb-6">Tato kategorie neexistuje.</p>
        <Link href="/clanky" className="text-primary hover:underline">
          ← Zpět na články
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="mb-10">
        <Link href="/clanky" className="text-text-muted hover:text-primary text-sm mb-4 inline-block">
          ← Všechny články
        </Link>
        <h1 className="text-3xl font-bold mb-2">
          <span className="mr-3">{category.icon}</span>
          <span className="text-white">{category.name}</span>
        </h1>
        {category.description && (
          <p className="text-text-muted text-lg">{category.description}</p>
        )}
      </div>

      {/* Articles */}
      {articles.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">{category.icon}</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Zatím žádné články
          </h3>
          <p className="text-text-muted">
            V kategorii „{category.name}" zatím nejsou žádné články. Buďte první!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/clanky/${article.slug}`}
              className="group rounded-xl bg-bg-card border border-border-subtle hover:border-primary/50 overflow-hidden transition-all"
            >
              <div className="h-48 bg-bg-card-hover overflow-hidden">
                {article.cover_image_url ? (
                  <img
                    src={article.cover_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-text-muted/30">
                    {category.icon}
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="text-xs text-primary font-medium uppercase tracking-wider">
                  {category.icon} {category.name}
                </span>
                <h2 className="text-lg font-semibold text-white mt-2 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="text-sm text-text-muted line-clamp-3 mb-4">
                    {article.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{article.author?.display_name || article.author?.username || "Anonym"}</span>
                  <span>{formatDate(article.published_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
