import { getArticlesPageData } from "@/app/clanky/articles-data";
import ArticlesContent from "@/components/ArticlesContent";

export const revalidate = 60;

export default async function ArticlesPage() {
  const { articles, categories } = await getArticlesPageData();
  return <ArticlesContent articles={articles} categories={categories} />;
}
