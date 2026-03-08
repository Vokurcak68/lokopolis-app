import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleDetailData } from "@/app/clanky/[slug]/article-data";
import ArticleDetailContent from "@/components/ArticleDetailContent";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await getArticleDetailData(slug);

  if (!article) {
    return { title: "Článek nenalezen" };
  }

  return {
    title: article.title,
    description: article.excerpt || `${article.title} — článek na Lokopolis`,
    openGraph: {
      title: article.title,
      description: article.excerpt || `${article.title} — článek na Lokopolis`,
      type: "article",
      publishedTime: article.published_at || undefined,
      authors: [article.author?.display_name || article.author?.username || "Anonym"],
      ...(article.cover_image_url ? { images: [{ url: article.cover_image_url, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { article, comments, tags } = await getArticleDetailData(slug);

  if (!article) {
    notFound();
  }

  return <ArticleDetailContent article={article} initialComments={comments} tags={tags} />;
}

