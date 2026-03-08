import { createServerSupabaseClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";

/* ============================================================
   TYPES
   ============================================================ */

export interface LatestArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  category: { name: string; icon: string } | null;
}

export interface DownloadItem {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  download_count: number;
}

export interface PopularArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  view_count: number;
  category: { name: string; icon: string } | null;
}

export interface EventItem {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
}

export interface PopularTag {
  id: string;
  name: string;
  slug: string;
  article_count: number;
}

export interface ForumStats {
  thread_count: number;
  post_count: number;
  last_thread_title: string | null;
  last_thread_id: string | null;
  last_thread_section_slug: string | null;
}

export interface ActiveAuthor {
  name: string;
  count: number;
}

export interface HomeStats {
  articles: string;
  members: string;
  downloads: string;
  photos: string;
}

export interface CategoryWithCount {
  title: string;
  icon: string;
  iconUrl?: string;
  href: string;
  slug: string;
  count: number;
}

export interface HomePageData {
  stats: HomeStats;
  memberCount: number | null;
  categories: CategoryWithCount[];
  latestArticles: LatestArticle[];
  recentDownloads: DownloadItem[];
  upcomingEvents: EventItem[];
  popularArticles: PopularArticle[];
  popularTags: PopularTag[];
  forumStats: ForumStats;
  activeAuthors: ActiveAuthor[];
}

/* ============================================================
   DEFAULT CATEGORIES
   ============================================================ */

const defaultCategories = [
  { title: "Stavba kolejiště", icon: "🏗️", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/stavba-kolejiste.png", href: "/kategorie/stavba-kolejiste", slug: "stavba-kolejiste" },
  { title: "Recenze modelů", icon: "🔍", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/recenze-modelu.png", href: "/kategorie/recenze", slug: "recenze" },
  { title: "Návody & tipy", icon: "🔧", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/navody-a-tipy.png", href: "/kategorie/navody-a-tipy", slug: "navody-a-tipy" },
  { title: "Krajina & scenérie", icon: "🎨", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/krajina-a-zelen.png", href: "/kategorie/krajina-a-zelen", slug: "krajina-a-zelen" },
  { title: "Digitalizace", icon: "⚡", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/digitalni-rizeni.png?v=5", href: "/kategorie/digitalni-rizeni", slug: "digitalni-rizeni" },
  { title: "Přestavby", icon: "🚃", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/prestavby.png", href: "/kategorie/prestavby", slug: "prestavby" },
  { title: "Kolejové plány", icon: "📐", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/kolejove-plany.png", href: "/kategorie/kolejove-plany", slug: "kolejove-plany" },
  { title: "Modelové domy", icon: "🏠", href: "/kategorie/modelove-domy", slug: "modelove-domy" },
  { title: "Nátěry & patina", icon: "🖌️", href: "/kategorie/natery-a-patina", slug: "natery-a-patina" },
  { title: "Osvětlení", icon: "💡", href: "/kategorie/osvetleni", slug: "osvetleni" },
  { title: "3D tisk", icon: "🖨️", href: "/kategorie/3d-tisk", slug: "3d-tisk" },
  { title: "Ze světa", icon: "🌍", href: "/kategorie/ze-sveta", slug: "ze-sveta" },
];

/* ============================================================
   DATA FETCHER (cached 60s)
   ============================================================ */

async function fetchHomeDataInternal(): Promise<HomePageData> {
  const supabase = createServerSupabaseClient();

  // Fallback if no Supabase client
  if (!supabase) {
    return {
      stats: { articles: "0", members: "0", downloads: "0", photos: "0" },
      memberCount: null,
      categories: defaultCategories.map(c => ({ ...c, count: 0 })),
      latestArticles: [],
      recentDownloads: [],
      upcomingEvents: [],
      popularArticles: [],
      popularTags: [],
      forumStats: { thread_count: 0, post_count: 0, last_thread_title: null, last_thread_id: null, last_thread_section_slug: null },
      activeAuthors: [],
    };
  }

  const today = new Date().toISOString().split("T")[0];

  // All base queries in parallel
  const [
    statsRes,
    membersRes,
    latestRes,
    catCountsRes,
    authorsRes,
    downloadsRes,
    eventsRes,
    dlCountRes,
    galleryCountRes,
    tagsRes,
    forumStatsRes,
    lastThreadRes,
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published").eq("verified", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("id, slug, title, excerpt, cover_image_url, published_at, author:profiles(display_name, username, avatar_url), category:categories(name, icon)").eq("status", "published").eq("verified", true).order("published_at", { ascending: false }).limit(3),
    supabase.from("articles").select("category:categories(slug)").eq("status", "published").eq("verified", true),
    supabase.from("articles").select("author:profiles(display_name, username)").eq("status", "published").eq("verified", true),
    supabase.from("downloads").select("id, title, description, file_name, file_size, download_count").order("created_at", { ascending: false }).limit(3),
    supabase.from("events").select("id, title, event_date, location").gte("event_date", today).order("event_date", { ascending: true }).limit(3),
    supabase.from("downloads").select("*", { count: "exact", head: true }),
    supabase.from("gallery_items").select("*", { count: "exact", head: true }),
    Promise.resolve(supabase.rpc("get_popular_tags", { max_results: 15 })).catch(() => ({ data: null })),
    Promise.resolve(supabase.rpc("get_forum_stats")).catch(() => ({ data: null })),
    supabase.from("forum_threads").select("id, title, section:forum_sections(slug)").order("last_post_at", { ascending: false }).limit(1),
  ]);

  // --- Stats ---
  const artCount = statsRes.count;
  const memCount = membersRes.count;
  const dlCount = dlCountRes.count;
  const galCount = galleryCountRes.count;

  const stats: HomeStats = {
    articles: artCount !== null ? artCount.toLocaleString("cs-CZ") : "0",
    members: memCount !== null ? memCount.toLocaleString("cs-CZ") : "0",
    downloads: dlCount !== null ? dlCount.toLocaleString("cs-CZ") : "0",
    photos: galCount !== null ? galCount.toLocaleString("cs-CZ") : "0",
  };

  // --- Categories with counts ---
  let categories = defaultCategories.map(c => ({ ...c, count: 0 }));
  if (catCountsRes.data && catCountsRes.data.length > 0) {
    const counts: Record<string, number> = {};
    for (const a of catCountsRes.data) {
      const slug = (a.category as unknown as { slug: string })?.slug;
      if (slug) counts[slug] = (counts[slug] || 0) + 1;
    }
    categories = categories.map(c => ({ ...c, count: counts[c.slug] || 0 }));
  }

  // --- Latest articles ---
  const latestArticles = (latestRes.data || []) as unknown as LatestArticle[];

  // --- Downloads ---
  const recentDownloads = (downloadsRes.data || []) as DownloadItem[];

  // --- Events ---
  const upcomingEvents = (eventsRes.data || []) as EventItem[];

  // --- Popular tags ---
  const popularTags = (tagsRes.data || []) as PopularTag[];

  // --- Forum stats ---
  let forumStats: ForumStats = { thread_count: 0, post_count: 0, last_thread_title: null, last_thread_id: null, last_thread_section_slug: null };
  if (forumStatsRes.data && Array.isArray(forumStatsRes.data) && forumStatsRes.data.length > 0) {
    const fs = forumStatsRes.data[0] as { thread_count: number; post_count: number };
    const lt = lastThreadRes.data && lastThreadRes.data.length > 0 ? lastThreadRes.data[0] : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secData = lt?.section as any;
    const secSlug = Array.isArray(secData) ? secData[0]?.slug : secData?.slug;
    forumStats = {
      thread_count: fs.thread_count || 0,
      post_count: fs.post_count || 0,
      last_thread_title: lt?.title || null,
      last_thread_id: lt?.id || null,
      last_thread_section_slug: secSlug || null,
    };
  }

  // --- Popular articles ---
  let popularArticles: PopularArticle[] = [];
  try {
    const { data: popIds } = await supabase.rpc("get_popular_articles", { days_back: 30, max_results: 4 });
    if (popIds && popIds.length > 0) {
      const ids = popIds.map((p: { article_id: string }) => p.article_id);
      const viewMap: Record<string, number> = {};
      popIds.forEach((p: { article_id: string; view_count_period: number }) => {
        viewMap[p.article_id] = Number(p.view_count_period);
      });
      const { data: popArticles } = await supabase
        .from("articles")
        .select("id, slug, title, excerpt, cover_image_url, view_count, category:categories(name, icon)")
        .in("id", ids);
      if (popArticles && popArticles.length > 0) {
        popularArticles = (popArticles as unknown as PopularArticle[]).sort(
          (a, b) => (viewMap[b.id] || 0) - (viewMap[a.id] || 0)
        );
      }
    } else {
      // Fallback — latest articles if no views
      const { data: fallback } = await supabase
        .from("articles")
        .select("id, slug, title, excerpt, cover_image_url, view_count, category:categories(name, icon)")
        .eq("status", "published")
        .eq("verified", true)
        .order("published_at", { ascending: false })
        .limit(4);
      if (fallback) popularArticles = fallback as unknown as PopularArticle[];
    }
  } catch {
    // keep empty
  }

  // --- Active authors ---
  let activeAuthors: ActiveAuthor[] = [];
  if (authorsRes.data && authorsRes.data.length > 0) {
    const authorCounts: Record<string, number> = {};
    for (const a of authorsRes.data) {
      const author = a.author as unknown as { display_name: string | null; username: string | null } | null;
      const name = author?.display_name || author?.username || "Anonym";
      authorCounts[name] = (authorCounts[name] || 0) + 1;
    }
    activeAuthors = Object.entries(authorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  return {
    stats,
    memberCount: memCount,
    categories,
    latestArticles,
    recentDownloads,
    upcomingEvents,
    popularArticles,
    popularTags,
    forumStats,
    activeAuthors,
  };
}

// Cache the entire homepage data for 60 seconds
export const getHomePageData = unstable_cache(
  fetchHomeDataInternal,
  ["homepage-data"],
  { revalidate: 60 }
);
