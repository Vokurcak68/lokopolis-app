import { createServerSupabaseClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import type { ArticleWithRelations, CommentWithAuthor, Tag } from "@/types/database";

export interface ArticleDetailData {
  article: ArticleWithRelations | null;
  comments: CommentWithAuthor[];
  tags: Tag[];
}

async function fetchArticleDetailInternal(slug: string): Promise<ArticleDetailData> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return { article: null, comments: [], tags: [] };
  }

  // Fetch article first to get the ID
  const { data: articleData, error } = await supabase
    .from("articles")
    .select("*, author:profiles(*), category:categories(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !articleData) {
    return { article: null, comments: [], tags: [] };
  }

  const article = articleData as unknown as ArticleWithRelations;

  // Fetch comments and tags in parallel
  const [commentsRes, tagsRes] = await Promise.all([
    supabase
      .from("comments")
      .select("*, author:profiles(*)")
      .eq("article_id", article.id)
      .eq("status", "published")
      .order("created_at", { ascending: true }),
    supabase
      .from("article_tags")
      .select("tag_id, tags(*)")
      .eq("article_id", article.id),
  ]);

  const comments = (commentsRes.data || []) as unknown as CommentWithAuthor[];

  const tags: Tag[] = [];
  if (tagsRes.data) {
    for (const link of tagsRes.data) {
      const t = (link as unknown as { tag_id: string; tags: Tag | Tag[] | null }).tags;
      if (Array.isArray(t) && t[0]) {
        tags.push(t[0]);
      } else if (t && !Array.isArray(t)) {
        tags.push(t);
      }
    }
  }

  return { article, comments, tags };
}

export function getArticleDetailData(slug: string) {
  return unstable_cache(
    () => fetchArticleDetailInternal(slug),
    [`article-detail-${slug}`],
    { revalidate: 60 }
  )();
}
