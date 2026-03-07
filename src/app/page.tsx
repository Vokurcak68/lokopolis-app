"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BadgeLogo from "@/components/BadgeLogo";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ============================================================
   DATA
   ============================================================ */

const defaultCategories = [
  { title: "Stavba kolejiště", icon: "🏗️", href: "/kategorie/stavba-kolejiste", slug: "stavba-kolejiste" },
  { title: "Recenze modelů", icon: "🔍", href: "/kategorie/recenze", slug: "recenze" },
  { title: "Návody & tipy", icon: "🔧", href: "/kategorie/navody-a-tipy", slug: "navody-a-tipy" },
  { title: "Krajina & scenérie", icon: "🎨", href: "/kategorie/krajina-a-zelen", slug: "krajina-a-zelen" },
  { title: "Digitalizace", icon: "⚡", href: "/kategorie/digitalni-rizeni", slug: "digitalni-rizeni" },
  { title: "Přestavby", icon: "🚃", href: "/kategorie/prestavby", slug: "prestavby" },
  { title: "Kolejové plány", icon: "📐", href: "/kategorie/kolejove-plany", slug: "kolejove-plany" },
  { title: "Modelové domy", icon: "🏠", href: "/kategorie/modelove-domy", slug: "modelove-domy" },
  { title: "Nátěry & patina", icon: "🖌️", href: "/kategorie/natery-a-patina", slug: "natery-a-patina" },
  { title: "Osvětlení", icon: "💡", href: "/kategorie/osvetleni", slug: "osvetleni" },
  { title: "3D tisk", icon: "🖨️", href: "/kategorie/3d-tisk", slug: "3d-tisk" },
  { title: "Ze světa", icon: "🌍", href: "/kategorie/ze-sveta", slug: "ze-sveta" },
];

interface LatestArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  category: { name: string; icon: string } | null;
}

function getFileIconClass(fileName: string): { iconClass: string; iconEmoji: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return { iconClass: "pdf", iconEmoji: "📄" };
  if (ext === "stl") return { iconClass: "stl", iconEmoji: "🧊" };
  if (["zip", "rar", "7z"].includes(ext)) return { iconClass: "zip", iconEmoji: "📦" };
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return { iconClass: "img", iconEmoji: "🖼️" };
  if (["dxf"].includes(ext)) return { iconClass: "dxf", iconEmoji: "📐" };
  return { iconClass: "other", iconEmoji: "📁" };
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface DownloadItem {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  download_count: number;
}

interface PopularArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  view_count: number;
  category: { name: string; icon: string } | null;
}

interface EventItem {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
}

const CZECH_MONTHS_SHORT = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];

const defaultAuthors: { name: string; count: number }[] = [];

interface PopularTag {
  id: string;
  name: string;
  slug: string;
  article_count: number;
}

const defaultTags = ["Tillig", "DCC", "epocha IV", "3D tisk", "ČSD", "krajina", "patina", "ROCO", "výhybky", "LED osvětlení"];

/* ============================================================
   COMPONENT
   ============================================================ */

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/hledat?q=${encodeURIComponent(q)}`);
  }

  const [stats, setStats] = useState({
    articles: "1 247",
    members: "385",
    downloads: "92",
    photos: "4 820",
  });

  const [categories, setCategories] = useState(
    defaultCategories.map(c => ({ ...c, count: 0 }))
  );

  const [latestArticles, setLatestArticles] = useState<LatestArticle[]>([]);
  const [activeAuthors, setActiveAuthors] = useState(defaultAuthors);
  const [recentDownloads, setRecentDownloads] = useState<DownloadItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [popularArticles, setPopularArticles] = useState<PopularArticle[]>([]);
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);
  const [forumStats, setForumStats] = useState<{ thread_count: number; post_count: number; last_thread_title: string | null; last_thread_id: string | null; last_thread_section_slug: string | null }>({ thread_count: 0, post_count: 0, last_thread_title: null, last_thread_id: null, last_thread_section_slug: null });

  useEffect(() => {
    async function fetchAll() {
      try {
        const today = new Date().toISOString().split("T")[0];

        // All queries in parallel
        const [statsRes, membersRes, latestRes, catCountsRes, authorsRes, downloadsRes, eventsRes, dlCountRes, galleryCountRes] = await Promise.all([
          supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published").eq("verified", true),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("articles").select("id, slug, title, excerpt, cover_image_url, published_at, author:profiles(display_name, username, avatar_url), category:categories(name, icon)").eq("status", "published").eq("verified", true).order("published_at", { ascending: false }).limit(3),
          supabase.from("articles").select("category:categories(slug)").eq("status", "published").eq("verified", true),
          supabase.from("articles").select("author:profiles(display_name, username)").eq("status", "published").eq("verified", true),
          supabase.from("downloads").select("id, title, description, file_name, file_size, download_count").order("created_at", { ascending: false }).limit(3),
          supabase.from("events").select("id, title, event_date, location").gte("event_date", today).order("event_date", { ascending: true }).limit(3),
          supabase.from("downloads").select("*", { count: "exact", head: true }),
          supabase.from("gallery_items").select("*", { count: "exact", head: true }),
        ]);

        // Stats
        const artCount = statsRes.count;
        const memCount = membersRes.count;
        const dlCount = dlCountRes.count;
        const galCount = galleryCountRes.count;
        if (memCount !== null) setMemberCount(memCount);
        setStats({
          articles: artCount !== null ? artCount.toLocaleString("cs-CZ") : "0",
          members: memCount !== null ? memCount.toLocaleString("cs-CZ") : "0",
          downloads: dlCount !== null ? dlCount.toLocaleString("cs-CZ") : "0",
          photos: galCount !== null ? galCount.toLocaleString("cs-CZ") : "0",
        });

        // Downloads
        if (downloadsRes.data && downloadsRes.data.length > 0) {
          setRecentDownloads(downloadsRes.data as DownloadItem[]);
        }

        // Events
        if (eventsRes.data && eventsRes.data.length > 0) {
          setUpcomingEvents(eventsRes.data as EventItem[]);
        }

        // Popular tags
        try {
          const { data: tagsData } = await supabase.rpc("get_popular_tags", { max_results: 15 });
          if (tagsData && tagsData.length > 0) {
            setPopularTags(tagsData as PopularTag[]);
          }
        } catch {
          // keep empty
        }

        // Forum stats
        try {
          const { data: fStats } = await supabase.rpc("get_forum_stats");
          if (fStats && fStats.length > 0) {
            const fs = fStats[0] as { thread_count: number; post_count: number };
            const { data: lastT } = await supabase.from("forum_threads").select("id, title, section:forum_sections(slug)").order("last_post_at", { ascending: false }).limit(1);
            const lt = lastT && lastT.length > 0 ? lastT[0] : null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const secData = lt?.section as any;
            const secSlug = Array.isArray(secData) ? secData[0]?.slug : secData?.slug;
            setForumStats({
              thread_count: fs.thread_count || 0,
              post_count: fs.post_count || 0,
              last_thread_title: lt?.title || null,
              last_thread_id: lt?.id || null,
              last_thread_section_slug: secSlug || null,
            });
          }
        } catch {
          // keep empty
        }

        // Popular articles (by views this month)
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
              const sorted = (popArticles as unknown as PopularArticle[]).sort(
                (a, b) => (viewMap[b.id] || 0) - (viewMap[a.id] || 0)
              );
              setPopularArticles(sorted);
            }
          } else {
            // Fallback — nejnovější články pokud nejsou žádné views
            const { data: fallback } = await supabase
              .from("articles")
              .select("id, slug, title, excerpt, cover_image_url, view_count, category:categories(name, icon)")
              .eq("status", "published")
              .eq("verified", true)
              .order("published_at", { ascending: false })
              .limit(4);
            if (fallback) setPopularArticles(fallback as unknown as PopularArticle[]);
          }
        } catch {
          // fallback — keep empty
        }

        // Latest articles
        if (latestRes.data && latestRes.data.length > 0) {
          setLatestArticles(latestRes.data as unknown as LatestArticle[]);
        }

        // Category counts
        if (catCountsRes.data && catCountsRes.data.length > 0) {
          const counts: Record<string, number> = {};
          for (const a of catCountsRes.data) {
            const slug = (a.category as unknown as { slug: string })?.slug;
            if (slug) counts[slug] = (counts[slug] || 0) + 1;
          }
          setCategories(prev =>
            prev.map(c => ({
              ...c,
              count: counts[c.slug] || 0,
            }))
          );
        }

        // Active authors
        if (authorsRes.data && authorsRes.data.length > 0) {
          const authorCounts: Record<string, number> = {};
          for (const a of authorsRes.data) {
            const author = a.author as unknown as { display_name: string | null; username: string | null } | null;
            const name = author?.display_name || author?.username || "Anonym";
            authorCounts[name] = (authorCounts[name] || 0) + 1;
          }
          const sorted = Object.entries(authorCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          if (sorted.length > 0) {
            setActiveAuthors(sorted);
          }
        }
      } catch {
        // fallback — keep defaults
      }
    }
    fetchAll();
  }, []);

  return (
    <div>
      {/* ===================== HERO ===================== */}
      <section className="hero-section">
        <div style={{ position: "relative", zIndex: 2, padding: "0 20px", textAlign: "center" }}>
          <BadgeLogo size="lg" />
          <p style={{ fontSize: "20px", color: "var(--text-dim)", maxWidth: "560px", margin: "16px auto 32px" }}>
            Návody, recenze, kolejové plány a komunita modelářů
          </p>
          <form
            onSubmit={handleSearch}
            style={{
              display: "flex",
              maxWidth: "480px",
              margin: "0 auto",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledej články, modely, kolejové plány..."
              style={{
                flex: 1,
                padding: "14px 20px",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "15px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "14px 24px",
                background: "var(--accent)",
                border: "none",
                color: "var(--accent-text-on)",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Hledat
            </button>
          </form>
        </div>
      </section>

      {/* ===================== STATS BAR ===================== */}
      <div className="stats-bar" style={{ background: "var(--bg-header)", padding: "14px 0" }}>
        <div
          className="stats-bar-inner"
          style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px", display: "flex", justifyContent: "center", gap: "48px" }}
        >
          {[
            { num: stats.articles, label: "Článků" },
            { num: stats.members, label: "Členů" },
            { num: stats.downloads, label: "Ke stažení" },
            { num: stats.photos, label: "V galerii" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div className="stats-num" style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)" }}>{s.num}</div>
              <div className="stats-label" style={{ fontSize: "12px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================== CATEGORIES ===================== */}
      <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Kategorie</h2>
          <Link href="#" style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}>
            Zobrazit vše →
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: "12px",
          }}
        >
          {categories.map((cat) => (
            <Link key={cat.href} href={cat.href} style={{ textDecoration: "none" }}>
              <div className="cat-card">
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>{cat.icon}</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-body)" }}>{cat.title}</div>
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "4px" }}>{cat.count} článků</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===================== LATEST ARTICLES ===================== */}
      <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Nejnovější články</h2>
          <Link href="/clanky" style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}>
            Všechny články →
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {latestArticles.map((a) => {
            const authorName = a.author?.display_name || a.author?.username || "Anonym";
            const initials = authorName.charAt(0).toUpperCase();
            const date = a.published_at
              ? new Date(a.published_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
              : "";
            return (
              <Link key={a.id} href={`/clanky/${a.slug}`} style={{ textDecoration: "none" }}>
                <div className="article-card">
                  <div className="article-img">
                    {a.cover_image_url ? (
                      <img src={a.cover_image_url} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div className="placeholder">{a.category?.icon || "📄"}</div>
                    )}
                    {a.category && <span className="article-badge">{a.category.icon} {a.category.name}</span>}
                  </div>
                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      {a.author?.avatar_url ? (
                        <img src={a.author.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "var(--border-hover)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {initials}
                        </div>
                      )}
                      <span style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{authorName}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>· {date}</span>
                    </div>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px", lineHeight: 1.4 }}>
                      {a.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>
                      {a.excerpt || ""}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===================== DOWNLOADS ===================== */}
      <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Ke stažení</h2>
          <Link href="/ke-stazeni" style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}>
            Vše ke stažení →
          </Link>
        </div>
        {recentDownloads.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {recentDownloads.map((d) => {
              const icon = getFileIconClass(d.file_name);
              const ext = d.file_name.split(".").pop()?.toUpperCase() || "";
              return (
                <Link key={d.id} href="/ke-stazeni" style={{ textDecoration: "none" }}>
                  <div className="dl-card">
                    <div className={`dl-icon ${icon.iconClass}`}>{icon.iconEmoji}</div>
                    <div>
                      <h4 style={{ fontSize: "14px", color: "var(--text-body)", marginBottom: "4px" }}>{d.title}</h4>
                      {d.description && <p style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{d.description}</p>}
                      <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>
                          {ext} · {formatSize(d.file_size)}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>⬇️ {d.download_count}×</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <p style={{ fontSize: "14px", color: "var(--text-dimmer)" }}>Zatím žádné soubory ke stažení</p>
          </div>
        )}
      </section>

      {/* ===================== MAIN + SIDEBAR ===================== */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_320px]"
        style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px", gap: "32px" }}
      >
        {/* Main content */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Populární tento měsíc</h2>
          </div>
          {popularArticles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "20px" }}>
              {popularArticles.map((a) => (
                <Link key={a.id} href={`/clanky/${a.slug}`} style={{ textDecoration: "none" }}>
                  <div className="article-card">
                    <div className="article-img">
                      {a.cover_image_url ? (
                        <img src={a.cover_image_url} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div className="placeholder">{a.category?.icon || "📄"}</div>
                      )}
                      {a.category && <span className="article-badge">{a.category.icon} {a.category.name}</span>}
                    </div>
                    <div style={{ padding: "16px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px", lineHeight: 1.4 }}>
                        {a.title}
                      </h3>
                      <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>{a.excerpt || ""}</p>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "var(--text-dimmer)", display: "flex", alignItems: "center", gap: "4px" }}>
                          👁️ {a.view_count.toLocaleString("cs-CZ")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "14px", color: "var(--text-dimmer)", textAlign: "center", padding: "32px 0" }}>
              Zatím žádné zobrazení — články se tu objeví po prvních návštěvách
            </p>
          )}
        </div>

        {/* Sidebar */}
        <aside>
          {/* Events */}
          <div className="widget">
            <h3>📅 Nadcházející akce</h3>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((e) => {
                const d = new Date(e.event_date);
                const month = CZECH_MONTHS_SHORT[d.getMonth()];
                const day = d.getDate().toString();
                return (
                  <Link key={e.id} href="/akce" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="event-item">
                      <div className="event-date">
                        <span className="month">{month}</span>
                        <span className="day">{day}</span>
                      </div>
                      <div className="event-info">
                        <strong>{e.title}</strong>
                        {e.location && <><br />{e.location}</>}
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>Žádné nadcházející akce</p>
            )}
            <Link href="/akce" style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", display: "block", marginTop: "10px" }}>
              Všechny akce →
            </Link>
          </div>

          {/* Active authors */}
          <div className="widget">
            <h3>🏆 Aktivní autoři</h3>
            <ul className="widget-list">
              {activeAuthors.map((a) => (
                <li key={a.name}>
                  <a href="#">{a.name}</a>
                  <span>{a.count} {a.count === 1 ? "článek" : a.count < 5 ? "články" : "článků"}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Forum widget */}
          <div className="widget">
            <h3>💬 Fórum</h3>
            <p style={{ fontSize: "13px", color: "var(--text-dim)", marginBottom: "8px" }}>
              💬 {forumStats.thread_count} vláken · {forumStats.post_count} příspěvků
            </p>
            {forumStats.last_thread_title && forumStats.last_thread_id && (
              <Link
                href={`/forum/${forumStats.last_thread_section_slug || "obecna-diskuze"}/${forumStats.last_thread_id}`}
                style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", display: "block", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}
              >
                📄 {forumStats.last_thread_title}
              </Link>
            )}
            <Link href="/forum" style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
              Přejít na fórum →
            </Link>
            <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-faint)" }}>
              Celkem registrováno: {memberCount !== null ? memberCount.toLocaleString("cs-CZ") : stats.members} členů
            </div>
          </div>

          {/* Tags */}
          <div className="widget">
            <h3>🏷️ Štítky</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {popularTags.length > 0
                ? popularTags.map((t) => (
                    <Link
                      key={t.id}
                      href={`/hledat?tag=${t.slug}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "var(--accent-bg)",
                        border: "1px solid var(--accent-border-strong)",
                        borderRadius: "20px",
                        padding: "4px 12px",
                        color: "var(--accent)",
                        fontSize: "12px",
                        cursor: "pointer",
                        textDecoration: "none",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-border)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-bg)")}
                    >
                      {t.name}
                      <span style={{ fontSize: "10px", color: "rgba(240,160,48,0.6)", marginLeft: "2px" }}>
                        {t.article_count}
                      </span>
                    </Link>
                  ))
                : defaultTags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))
              }
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
