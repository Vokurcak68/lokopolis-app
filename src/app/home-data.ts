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
  category: { name: string; icon: string; slug: string } | null;
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
  category: { name: string; icon: string; slug: string } | null;
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

export interface RecentForumThread {
  id: string;
  title: string;
  section_slug: string;
  section_name: string;
  last_post_at: string | null;
  post_count: number;
  author_display_name: string;
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

export interface CompetitionHomeData {
  id: string;
  title: string;
  month: string;
  status: string;
  ends_at: string;
  topEntries: {
    id: string;
    title: string;
    images: string[];
    vote_count: number;
    author: { display_name: string | null; username: string | null } | null;
  }[];
  winner?: {
    id: string;
    title: string;
    images: string[];
    author: { display_name: string | null; username: string | null } | null;
  } | null;
}

export interface BazarListingHome {
  id: string;
  title: string;
  price: number;
  condition: string;
  scale: string | null;
  images: string[];
  location: string | null;
  created_at: string;
}

export interface ShopProductHome {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  original_price: number | null;
  category: string;
  scale: string | null;
  cover_image_url: string | null;
  file_type: string | null;
  download_count: number;
  featured: boolean;
}

export interface ActivityFeedItem {
  id: string;
  type: 'article' | 'listing' | 'forum' | 'shop' | 'member';
  title: string;
  link: string;
  author_name: string | null;
  created_at: string;
}

export interface HomeBanner {
  id: string;
  position: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string;
  badge_text: string | null;
  priority: number;
}

export interface HomepageSections {
  leaderboard_banner: boolean;
  latest_articles: boolean;
  forum_bar: boolean;
  categories: boolean;
  cta_strip: boolean;
  stats_bar: boolean;
  inline_banner: boolean;
  bazar: boolean;
  competition: boolean;
  shop_products: boolean;
  downloads: boolean;
  popular_articles: boolean;
  events: boolean;
  active_authors: boolean;
  forum_widget: boolean;
  tags: boolean;
  activity_feed: boolean;
  sidebar_banner: boolean;
  [key: string]: boolean;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSections = {
  leaderboard_banner: true,
  latest_articles: true,
  forum_bar: true,
  categories: true,
  cta_strip: true,
  stats_bar: true,
  inline_banner: true,
  bazar: true,
  competition: true,
  shop_products: true,
  downloads: true,
  popular_articles: true,
  events: true,
  active_authors: true,
  forum_widget: true,
  tags: true,
  activity_feed: true,
  sidebar_banner: true,
};

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
  recentForumThreads: RecentForumThread[];
  activeAuthors: ActiveAuthor[];
  competition: CompetitionHomeData | null;
  latestListings: BazarListingHome[];
  featuredShopProducts: ShopProductHome[];
  banners: HomeBanner[];
  sections: HomepageSections;
  activityFeed: ActivityFeedItem[];
}

/* ============================================================
   DEFAULT CATEGORIES
   ============================================================ */

const defaultCategories = [
  { title: "Stavba kolejiště", icon: "🏗️", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/stavba-kolejiste.png", href: "/kategorie/stavba-kolejiste", slug: "stavba-kolejiste" },
  { title: "Recenze modelů", icon: "🔍", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/recenze-modelu.png", href: "/kategorie/recenze", slug: "recenze" },
  { title: "Návody & tipy", icon: "🔧", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/navody-a-tipy.png", href: "/kategorie/navody-a-tipy", slug: "navody-a-tipy" },
  { title: "Krajina & scenérie", icon: "🎨", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/krajina-a-zelen.png", href: "/kategorie/krajina-a-zelen", slug: "krajina-a-zelen" },
  { title: "Digitalizace", icon: "⚡", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/digitalni-rizeni.png?v=6", href: "/kategorie/digitalni-rizeni", slug: "digitalni-rizeni" },
  { title: "Přestavby", icon: "🚃", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/prestavby.png", href: "/kategorie/prestavby", slug: "prestavby" },
  { title: "Kolejové plány", icon: "📐", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/kolejove-plany.png", href: "/kategorie/kolejove-plany", slug: "kolejove-plany" },
  { title: "Modelové domy", icon: "🏠", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/modelove-domy.png", href: "/kategorie/modelove-domy", slug: "modelove-domy" },
  { title: "Nátěry & patina", icon: "🖌️", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/natery-a-patina.png", href: "/kategorie/natery-a-patina", slug: "natery-a-patina" },
  { title: "Osvětlení", icon: "💡", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/osvetleni.png", href: "/kategorie/osvetleni", slug: "osvetleni" },
  { title: "3D tisk", icon: "🖨️", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/3d-tisk.png", href: "/kategorie/3d-tisk", slug: "3d-tisk" },
  { title: "Ze světa", icon: "🌍", iconUrl: "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons/ze-sveta.png", href: "/kategorie/ze-sveta", slug: "ze-sveta" },
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
      recentForumThreads: [],
      activeAuthors: [],
      competition: null,
      latestListings: [],
      featuredShopProducts: [],
      banners: [],
      sections: DEFAULT_HOMEPAGE_SECTIONS,
      activityFeed: [],
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
    recentThreadsRes,
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published").eq("verified", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("id, slug, title, excerpt, cover_image_url, published_at, author:profiles(display_name, username, avatar_url), category:categories(name, icon, slug)").eq("status", "published").eq("verified", true).order("published_at", { ascending: false }).limit(3),
    supabase.from("articles").select("category:categories(slug)").eq("status", "published").eq("verified", true),
    supabase.from("articles").select("author:profiles(display_name, username)").eq("status", "published").eq("verified", true),
    supabase.from("downloads").select("id, title, description, file_name, file_size, download_count").order("created_at", { ascending: false }).limit(3),
    supabase.from("events").select("id, title, event_date, location").gte("event_date", today).order("event_date", { ascending: true }).limit(3),
    supabase.from("downloads").select("*", { count: "exact", head: true }),
    supabase.from("gallery_items").select("*", { count: "exact", head: true }),
    Promise.resolve(supabase.rpc("get_popular_tags", { max_results: 15 })).catch(() => ({ data: null })),
    Promise.resolve(supabase.rpc("get_forum_stats")).catch(() => ({ data: null })),
    supabase.from("forum_threads").select("id, title, section:forum_sections(slug)").order("last_post_at", { ascending: false }).limit(1),
    supabase.from("forum_threads").select("id, title, post_count, last_post_at, section:forum_sections(slug, name), author:profiles!forum_threads_user_id_fkey(display_name, username)").eq("is_locked", false).order("last_post_at", { ascending: false }).limit(5),
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

  // --- Recent forum threads ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentForumThreads: RecentForumThread[] = (recentThreadsRes.data || []).map((t: any) => {
    const sec = Array.isArray(t.section) ? t.section[0] : t.section;
    const auth = Array.isArray(t.author) ? t.author[0] : t.author;
    return {
      id: t.id,
      title: t.title,
      section_slug: sec?.slug || "obecna-diskuze",
      section_name: sec?.name || "Fórum",
      last_post_at: t.last_post_at,
      post_count: t.post_count || 0,
      author_display_name: auth?.display_name || auth?.username || "Anonym",
    };
  });

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
        .select("id, slug, title, excerpt, cover_image_url, view_count, category:categories(name, icon, slug)")
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
        .select("id, slug, title, excerpt, cover_image_url, view_count, category:categories(name, icon, slug)")
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

  // --- Competition (Kolejiště měsíce) ---
  let competition: CompetitionHomeData | null = null;
  try {
    // Try active/voting first
    const { data: activeComp } = await supabase
      .from("competitions")
      .select("id, title, month, status, ends_at")
      .in("status", ["active", "voting"])
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeComp) {
      const { data: topEntries } = await supabase
        .from("competition_entries")
        .select("id, title, images, vote_count, author:profiles!competition_entries_user_id_fkey(display_name, username)")
        .eq("competition_id", activeComp.id)
        .order("vote_count", { ascending: false })
        .limit(3);

      competition = {
        ...activeComp,
        topEntries: (topEntries || []) as unknown as CompetitionHomeData["topEntries"],
      };
    } else {
      // Fall back to latest finished with a winner
      const { data: finishedComp } = await supabase
        .from("competitions")
        .select("id, title, month, status, ends_at, winner_id")
        .eq("status", "finished")
        .not("winner_id", "is", null)
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (finishedComp && finishedComp.winner_id) {
        const { data: winnerEntry } = await supabase
          .from("competition_entries")
          .select("id, title, images, author:profiles!competition_entries_user_id_fkey(display_name, username)")
          .eq("id", finishedComp.winner_id)
          .single();

        competition = {
          id: finishedComp.id,
          title: finishedComp.title,
          month: finishedComp.month,
          status: finishedComp.status,
          ends_at: finishedComp.ends_at,
          topEntries: [],
          winner: winnerEntry as unknown as CompetitionHomeData["winner"],
        };
      }
    }
  } catch {
    // keep null
  }

  // --- Latest bazar listings ---
  let latestListings: BazarListingHome[] = [];
  try {
    const { data: bazarData } = await supabase
      .from("listings")
      .select("id, title, price, condition, scale, images, location, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4);
    if (bazarData) latestListings = bazarData as BazarListingHome[];
  } catch {
    // table may not exist yet
  }

  // --- Featured shop products ---
  let featuredShopProducts: ShopProductHome[] = [];
  try {
    const { data: shopData } = await supabase
      .from("shop_products")
      .select("id, title, slug, description, price, original_price, category, scale, cover_image_url, file_type, download_count, featured")
      .eq("status", "active")
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(4);
    if (shopData) featuredShopProducts = shopData as ShopProductHome[];
  } catch {
    // table may not exist yet
  }

  // --- Homepage banners ---
  let banners: HomeBanner[] = [];
  try {
    const now = new Date().toISOString();
    const { data: bannerData, error: bannerError } = await supabase
      .from("homepage_banners")
      .select("id, position, title, subtitle, image_url, link_url, badge_text, priority, starts_at, ends_at")
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (bannerError) {
      console.error("Banner fetch error:", bannerError);
    }
    if (bannerData) {
      // Filter by date range in JS (Supabase .or() chaining is unreliable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      banners = (bannerData as any[]).filter((b: any) => {
        if (b.starts_at && b.starts_at > now) return false;
        if (b.ends_at && b.ends_at <= now) return false;
        return true;
      }) as HomeBanner[];
    }
  } catch {
    // table may not exist yet
  }

  // Track impressions server-side (fire and forget)
  if (banners.length > 0) {
    const ids = banners.map(b => b.id);
    Promise.resolve(supabase.rpc("increment_banner_impressions", { banner_ids: ids })).catch(() => {});
  }

  // --- Homepage sections visibility ---
  let sections: HomepageSections = { ...DEFAULT_HOMEPAGE_SECTIONS };
  try {
    const { data: settingsData } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "homepage_sections")
      .single();
    if (settingsData?.value && typeof settingsData.value === "object") {
      sections = { ...DEFAULT_HOMEPAGE_SECTIONS, ...(settingsData.value as Record<string, boolean>) };
    }
  } catch {
    // Use defaults
  }

  // --- Activity feed (latest events across the site) ---
  let activityFeed: ActivityFeedItem[] = [];
  try {
    const [feedArticles, feedListings, feedThreads, feedProducts, feedMembers] = await Promise.all([
      supabase
        .from("articles")
        .select("id, slug, title, created_at, author:profiles(display_name, username)")
        .eq("status", "published")
        .eq("verified", true)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("listings")
        .select("id, title, created_at, user_id")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("forum_threads")
        .select("id, title, created_at, section:forum_sections(slug), author:profiles!forum_threads_user_id_fkey(display_name, username)")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("shop_products")
        .select("id, slug, title, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("profiles")
        .select("id, display_name, username, created_at")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: ActivityFeedItem[] = [];

    if (feedArticles.data) {
      for (const a of feedArticles.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const auth = Array.isArray((a as any).author) ? (a as any).author[0] : (a as any).author;
        items.push({
          id: `article-${a.id}`,
          type: "article",
          title: a.title,
          link: `/clanky/${a.slug}`,
          author_name: auth?.display_name || auth?.username || null,
          created_at: a.created_at,
        });
      }
    }

    if (feedListings.data) {
      for (const l of feedListings.data) {
        items.push({
          id: `listing-${l.id}`,
          type: "listing",
          title: l.title,
          link: `/bazar/${l.id}`,
          author_name: null,
          created_at: l.created_at,
        });
      }
    }

    if (feedThreads.data) {
      for (const t of feedThreads.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sec = Array.isArray((t as any).section) ? (t as any).section[0] : (t as any).section;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const auth = Array.isArray((t as any).author) ? (t as any).author[0] : (t as any).author;
        items.push({
          id: `forum-${t.id}`,
          type: "forum",
          title: t.title,
          link: `/forum/${sec?.slug || "obecna-diskuze"}/${t.id}`,
          author_name: auth?.display_name || auth?.username || null,
          created_at: t.created_at,
        });
      }
    }

    if (feedProducts.data) {
      for (const p of feedProducts.data) {
        items.push({
          id: `shop-${p.id}`,
          type: "shop",
          title: p.title,
          link: `/shop/${p.slug}`,
          author_name: null,
          created_at: p.created_at,
        });
      }
    }

    if (feedMembers.data) {
      for (const m of feedMembers.data) {
        const name = m.display_name || m.username || "Anonym";
        items.push({
          id: `member-${m.id}`,
          type: "member",
          title: name,
          link: "#",
          author_name: name,
          created_at: m.created_at,
        });
      }
    }

    // Sort by created_at DESC and take top 8
    activityFeed = items
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  } catch {
    // keep empty
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
    recentForumThreads,
    activeAuthors,
    competition,
    latestListings,
    featuredShopProducts,
    banners,
    sections,
    activityFeed,
  };
}

// Cache the entire homepage data for 300 seconds
export const getHomePageData = unstable_cache(
  fetchHomeDataInternal,
  ["homepage-data"],
  { revalidate: 300 }
);

// Fetch sections visibility FRESH (no cache) — for instant admin toggle
export async function getHomepageSections(): Promise<HomepageSections> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return { ...DEFAULT_HOMEPAGE_SECTIONS };
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "homepage_sections")
      .single();
    if (data?.value && typeof data.value === "object") {
      return { ...DEFAULT_HOMEPAGE_SECTIONS, ...(data.value as Record<string, boolean>) };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_HOMEPAGE_SECTIONS };
}
