import { getHomePageData, getHomepageSections } from "@/app/home-data";
import HomeContent from "@/components/HomeContent";

export const revalidate = 60;

export default async function Home() {
  const [data, sections] = await Promise.all([
    getHomePageData(),
    getHomepageSections(),
  ]);
  return <HomeContent data={{ ...data, sections }} />;
}
