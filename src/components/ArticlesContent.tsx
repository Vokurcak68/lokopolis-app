"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ArticleWithRelations, Category } from "@/types/database";

interface ArticlesContentProps {
  articles: ArticleWithRelations[];
  categories: Category[];
}

export default function ArticlesContent({ articles, categories }: ArticlesContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredArticles = selectedCategory
    ? articles.filter((a) => a.category_id === selectedCategory)
    : articles;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-4">
        <span className="text-[var(--text-primary)]">Všechny </span>
        <span className="text-primary">články</span>
      </h1>
      <p className="text-text-muted mb-8">
        Prozkoumejte články od naší komunity modelářů.
      </p>

      {/* Filtr kategorií */}
      <div className="flex flex-wrap gap-2 mb-10">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedCategory === null
              ? "bg-primary text-bg-dark"
              : "bg-bg-card text-text-muted border border-border-subtle hover:border-primary/50 hover:text-[var(--text-primary)]"
          }`}
        >
          Vše
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? "bg-primary text-bg-dark"
                : "bg-bg-card text-text-muted border border-border-subtle hover:border-primary/50 hover:text-[var(--text-primary)]"
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Seznam článků */}
      {filteredArticles.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Zatím žádné články
          </h3>
          <p className="text-text-muted">
            {selectedCategory
              ? "V této kategorii zatím nejsou žádné články."
              : "Buďte první, kdo napíše článek pro komunitu!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => (
            <Link
              key={article.id}
              href={`/clanky/${article.slug}`}
              className="group rounded-xl bg-bg-card border border-border-subtle hover:border-primary/50 overflow-hidden transition-all"
            >
              {/* Cover image */}
              <div className="h-48 bg-bg-card-hover overflow-hidden relative">
                {article.cover_image_url ? (
                  <Image
                    src={article.cover_image_url}
                    alt={article.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-text-muted/30">
                    {article.category?.icon || "📄"}
                  </div>
                )}
              </div>

              <div className="p-5">
                {/* Kategorie */}
                {article.category && (
                  <span className="text-xs text-primary font-medium uppercase tracking-wider">
                    {article.category.icon} {article.category.name}
                  </span>
                )}

                {/* Název */}
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-2 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h2>

                {/* Excerpt */}
                {article.excerpt && (
                  <p className="text-sm text-text-muted line-clamp-3 mb-4">
                    {article.excerpt}
                  </p>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>
                    {article.author?.display_name || article.author?.username || "Anonym"}
                  </span>
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
