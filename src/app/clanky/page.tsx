import type { Metadata } from "next";
import { getArticlesPageData } from "@/app/clanky/articles-data";
import ArticlesContent from "@/components/ArticlesContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Články",
  description: "Všechny články o modelové železnici — návody, recenze, tipy a inspirace.",
};

export default async function ArticlesPage() {
  const { articles, categories } = await getArticlesPageData();
  return <ArticlesContent articles={articles} categories={categories} />;
}
