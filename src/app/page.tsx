import { getHomePageData } from "@/app/home-data";
import HomeContent from "@/components/HomeContent";

export const revalidate = 60;

export default async function Home() {
  const data = await getHomePageData();
  return <HomeContent data={data} />;
}
