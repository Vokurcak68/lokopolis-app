import { notFound } from "next/navigation";
import { getArticleDetailData } from "@/app/clanky/[slug]/article-data";
import ArticleDetailContent from "@/components/ArticleDetailContent";

export const revalidate = 60;

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { article, comments, tags } = await getArticleDetailData(slug);

  if (!article) {
    notFound();
  }

  return <ArticleDetailContent article={article} initialComments={comments} tags={tags} />;
}
