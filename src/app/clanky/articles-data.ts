import { createServerSupabaseClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import type { ArticleWithRelations, Category } from "@/types/database";

export interface ArticlesPageData {
  articles: ArticleWithRelations[];
  categories: Category[];
}

async function fetchArticlesDataInternal(): Promise<ArticlesPageData> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return { articles: [], categories: [] };
  }

  const [articlesRes, categoriesRes] = await Promise.all([
    supabase
      .from("articles")
      .select("*, author:profiles(*), category:categories(*)")
      .eq("status", "published")
      .eq("verified", true)
      .order("published_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .order("sort_order"),
  ]);

  return {
    articles: (articlesRes.data || []) as unknown as ArticleWithRelations[],
    categories: (categoriesRes.data || []) as Category[],
  };
}

export const getArticlesPageData = unstable_cache(
  fetchArticlesDataInternal,
  ["articles-page-data"],
  { revalidate: 60 }
);
