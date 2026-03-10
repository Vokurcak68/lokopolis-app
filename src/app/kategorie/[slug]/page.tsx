import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ArticleWithRelations, Category } from "@/types/database";
import CategoryIcon from "@/components/CategoryIcon";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerSupabaseClient();
  if (!supabase) return { title: "Kategorie" };

  const { data: category } = await supabase
    .from("categories")
    .select("name, description, icon")
    .eq("slug", slug)
    .single();

  if (!category) return { title: "Kategorie nenalezena" };

  return {
    title: `${category.icon} ${category.name}`,
    description: category.description || `Články v kategorii ${category.name} na Lokopolis`,
    openGraph: {
      title: `${category.icon} ${category.name} — Lokopolis`,
      description: category.description || `Články v kategorii ${category.name}`,
    },
  };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    notFound();
  }

  // Fetch category
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) {
    notFound();
  }

  const cat = category as Category;

  // Fetch articles in this category
  const { data: articlesData } = await supabase
    .from("articles")
    .select("*, author:profiles(*), category:categories(*)")
    .eq("status", "published")
    .eq("category_id", cat.id)
    .order("published_at", { ascending: false });

  const articles = (articlesData || []) as unknown as ArticleWithRelations[];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <Link href="/clanky" style={{ color: "var(--text-dim)", fontSize: "14px", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
          ← Všechny články
        </Link>
        <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          <CategoryIcon slug={cat.slug} emoji={cat.icon || undefined} size={36} />
          <span style={{ color: "var(--text-primary)" }}>{cat.name}</span>
        </h1>
        {cat.description && (
          <p style={{ fontSize: "16px", color: "var(--text-dim)" }}>{cat.description}</p>
        )}
      </div>

      {/* Articles */}
      {articles.length === 0 ? (
        <div className="text-center py-20">
          <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
            <CategoryIcon slug={cat.slug} emoji={cat.icon || undefined} size={52} />
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Zatím žádné články
          </h3>
          <p className="text-text-muted">
            V kategorii „{cat.name}" zatím nejsou žádné články. Buďte první!
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
                  <div className="w-full h-full flex items-center justify-center text-text-muted/30">
                    <CategoryIcon slug={cat.slug} emoji={cat.icon || undefined} size={48} style={{ opacity: 0.3 }} />
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="text-xs text-primary font-medium uppercase tracking-wider" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CategoryIcon slug={cat.slug} emoji={cat.icon || undefined} size={14} />
                  {cat.name}
                </span>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-2 mb-2 group-hover:text-primary transition-colors line-clamp-2">
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
