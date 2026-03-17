"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BadgeLogo from "@/components/BadgeLogo";
import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";
import { getImageVariant } from "@/lib/image-variants";
import type {
  HomePageData,
  HomeBanner,
  HomepageSections,
  LatestArticle,
  PopularArticle,
  PopularTag,
  CompetitionHomeData,
  BazarListingHome,
  ShopProductHome,
  RecentForumThread,
  ActivityFeedItem,
} from "@/app/home-data";
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/app/home-data";

function optimizeImageUrl(url: string, width: number = 400): string {
  if (!url) return "";
  const height = Math.round(width * 0.75);
  return url.replace("/object/public/", "/render/image/public/").concat(`?width=${width}&height=${height}&resize=contain&quality=75`);
}

/* ============================================================
   BANNER CLICK TRACKER
   ============================================================ */
function trackBannerClick(bannerId: string) {
  fetch("/api/banners/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: bannerId }),
  }).catch(() => {});
}

/* ============================================================
   LEADERBOARD BANNER (Pozice 1 — pod hero)
   ============================================================ */
function LeaderboardBanner({ banners }: { banners: HomeBanner[] }) {
  // Pick one banner: rotate daily by priority, then by day-of-year
  if (!banners || banners.length === 0) return null;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const banner = banners.length === 1 ? banners[0] : banners[dayOfYear % banners.length];

  return (
    <section style={{ maxWidth: "1200px", margin: "24px auto 0", padding: "0 20px" }}>
      <a
        href={banner.link_url}
        onClick={() => trackBannerClick(banner.id)}
        style={{ display: "block", textDecoration: "none", borderRadius: "12px", overflow: "hidden", position: "relative", background: "var(--bg-card)", border: "1px solid var(--border)", transition: "box-shadow 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(240,160,48,0.15)")}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
      >
        {banner.image_url ? (
          <div style={{ width: "100%", height: "0", paddingBottom: "12%", position: "relative", minHeight: "80px" }}>
            <Image src={banner.image_url} alt={banner.title} fill style={{ objectFit: "cover" }} sizes="1200px" priority />
            {/* Overlay text */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 60%)" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{banner.title}</div>
                {banner.subtitle && <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", marginTop: "2px" }}>{banner.subtitle}</div>}
              </div>
              {banner.badge_text && (
                <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "4px", background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(4px)", flexShrink: 0 }}>
                  {banner.badge_text}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, var(--bg-card), var(--bg-page))" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{banner.title}</div>
              {banner.subtitle && <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>{banner.subtitle}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {banner.badge_text && (
                <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "4px", background: "var(--accent)", color: "#000", fontWeight: 600 }}>
                  {banner.badge_text}
                </span>
              )}
              <span style={{ fontSize: "14px", color: "var(--accent)" }}>→</span>
            </div>
          </div>
        )}
      </a>
    </section>
  );
}

/* ============================================================
   NATIVE BANNER CARD (Pozice 2/5 — vmíchaná v seznamu)
   ============================================================ */
function NativeBannerCard({ banner }: { banner: HomeBanner }) {
  return (
    <a
      href={banner.link_url}
      onClick={() => trackBannerClick(banner.id)}
      style={{
        display: "block",
        textDecoration: "none",
        background: "var(--bg-card)",
        border: "1px solid var(--accent-border)",
        borderRadius: "12px",
        overflow: "hidden",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(240,160,48,0.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {banner.image_url && (
        <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "var(--bg-page)" }}>
          <Image src={banner.image_url} alt={banner.title} fill style={{ objectFit: "contain" }} sizes="300px" />
        </div>
      )}
      <div style={{ padding: "12px 16px" }}>
        {banner.badge_text && (
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "3px", background: "var(--accent)", color: "#000", fontWeight: 600, display: "inline-block", marginBottom: "6px" }}>
            {banner.badge_text}
          </span>
        )}
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{banner.title}</div>
        {banner.subtitle && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{banner.subtitle}</div>}
      </div>
    </a>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

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

const CZECH_MONTHS_SHORT = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];

const defaultTags = ["Tillig", "DCC", "epocha IV", "3D tisk", "ČSD", "krajina", "patina", "ROCO", "výhybky", "LED osvětlení"];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "právě teď";
  if (mins < 60) return `před ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `před ${hours} hod`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `před ${weeks} týd`;
  return new Date(dateStr).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

/* ============================================================
   CTA STRIP (Pozice 3) — rotující vlastní promo
   ============================================================ */

const CTA_STRIPS = [
  { emoji: "🛡️", text: "Prodáváš na bazaru? Vyzkoušej Bezpečnou platbu — 0 % pro kupující!", cta: "Zjistit víc", href: "/bazar/bezpecna-platba" },
  { emoji: "📝", text: "Máš zajímavé kolejiště? Napiš o něm článek a inspiruj ostatní!", cta: "Napsat článek", href: "/novy-clanek" },
  { emoji: "🛒", text: "Nepotřebuješ staré modely? Prodej je na bazaru — je to zdarma!", cta: "Přidat inzerát", href: "/bazar/novy" },
  { emoji: "📥", text: "Podívej se na kolejové plány a návody ke stažení v našem eshopu!", cta: "Do eshopu", href: "/shop" },
];

function CtaStrip() {
  // Rotate daily based on day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const strip = CTA_STRIPS[dayOfYear % CTA_STRIPS.length];

  return (
    <section style={{ maxWidth: "1200px", margin: "32px auto 0", padding: "0 20px" }}>
      <Link href={strip.href} style={{ textDecoration: "none" }}>
        <div style={{
          background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 85%, #000))",
          borderRadius: "12px", padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
          flexWrap: "wrap", transition: "opacity 0.2s", cursor: "pointer",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <span style={{ fontSize: "18px" }}>{strip.emoji}</span>
          <span style={{ color: "var(--accent-text-on, #0f0f1a)", fontSize: "14px", fontWeight: 600 }}>
            {strip.text}
          </span>
          <span style={{
            padding: "6px 16px", borderRadius: "8px",
            background: "var(--accent-text-on, #0f0f1a)", color: "var(--accent)",
            fontSize: "13px", fontWeight: 700, flexShrink: 0,
          }}>
            {strip.cta}
          </span>
        </div>
      </Link>
    </section>
  );
}

/* ============================================================
   INLINE BANNER (Pozice 4) — soutěže, akce
   ============================================================ */

function InlineBanner({ competition }: { competition: CompetitionHomeData | null }) {
  // Only show if there's an active competition
  if (!competition || (competition.status !== "active" && competition.status !== "voting")) {
    return null;
  }

  const isVoting = competition.status === "voting";

  return (
    <section style={{ maxWidth: "1200px", margin: "32px auto 0", padding: "0 20px" }}>
      <Link href="/soutez" style={{ textDecoration: "none" }}>
        <div style={{
          background: "linear-gradient(135deg, var(--bg-card), color-mix(in srgb, var(--bg-card) 90%, #8b5cf6))",
          border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px",
          padding: "16px 24px", display: "flex", alignItems: "center", gap: "14px",
          flexWrap: "wrap", transition: "border-color 0.2s",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)"; }}
        >
          <span style={{ fontSize: "32px" }}>🏆</span>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#c4b5fd" }}>
              {competition.title} — {isVoting ? "hlasujte!" : "přihlaste se!"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "2px" }}>
              {isVoting
                ? `${competition.topEntries.length} soutěžních kolejišť čeká na váš hlas`
                : "Přihlaste své kolejiště do soutěže a vyhrajte voucher do eshopu!"
              }
            </div>
          </div>
          <span style={{
            padding: "8px 18px", borderRadius: "8px",
            background: "rgba(139,92,246,0.15)", color: "#a78bfa",
            fontSize: "13px", fontWeight: 600, border: "1px solid rgba(139,92,246,0.3)",
            flexShrink: 0,
          }}>
            {isVoting ? "Hlasovat →" : "Přihlásit se →"}
          </span>
        </div>
      </Link>
    </section>
  );
}

/* ============================================================
   COMPETITION BANNER
   ============================================================ */

function CompetitionBanner({ competition }: { competition: CompetitionHomeData }) {
  const isActive = competition.status === "active" || competition.status === "voting";
  const isFinished = competition.status === "finished";

  if (isFinished && competition.winner) {
    const winner = competition.winner;
    const winnerImage = winner.images && winner.images.length > 0 ? winner.images[0] : null;
    const winnerName = winner.author?.display_name || winner.author?.username || "Anonym";
    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent-border)", borderRadius: "16px", padding: "24px", display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "var(--accent)" }} />
        {winnerImage && (
          <div style={{ width: "120px", height: "90px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--bg-page)" }}>
            <Image src={optimizeImageUrl(winnerImage, 200)} alt={winner.title} fill style={{ objectFit: "contain" }} sizes="120px" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600, marginBottom: "4px" }}>🏆 Vítěz minulé soutěže</div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{winner.title}</h3>
          <p style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>od {winnerName}</p>
        </div>
        <Link href="/soutez" style={{ padding: "10px 20px", background: "var(--accent)", color: "var(--accent-text-on)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
          Zobrazit soutěž →
        </Link>
      </div>
    );
  }

  if (isActive) {
    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent-border)", borderRadius: "16px", padding: "24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "var(--accent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: competition.status === "voting" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)", color: competition.status === "voting" ? "#3b82f6" : "#22c55e" }}>
                {competition.status === "voting" ? "🗳️ Hlasování" : "🟢 Přihlašování"}
              </span>
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>🏆 {competition.title}</h3>
          </div>
          <Link href="/soutez" style={{ padding: "10px 20px", background: "var(--accent)", color: "var(--accent-text-on)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
            Zobrazit soutěž →
          </Link>
        </div>
        {competition.topEntries.length > 0 && (
          <div style={{ display: "flex", gap: "12px", overflowX: "auto" }}>
            {competition.topEntries.map((entry) => {
              const entryImage = entry.images && entry.images.length > 0 ? entry.images[0] : null;
              return (
                <Link key={entry.id} href={`/soutez/${entry.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                  <div style={{ width: "180px", background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ width: "100%", height: "100px", position: "relative", background: "var(--bg-page)" }}>
                      {entryImage ? (
                        <Image src={optimizeImageUrl(entryImage, 200)} alt={entry.title} fill style={{ objectFit: "contain" }} sizes="180px" />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "var(--border-hover)" }}>🚂</div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-body)", lineHeight: 1.3, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--accent)" }}>❤️ {entry.vote_count}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function HomeContent({ data }: { data: HomePageData }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/hledat?q=${encodeURIComponent(q)}`);
  }

  const {
    stats,
    memberCount,
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
    sections: _sections,
    activityFeed,
  } = data;

  const sections: HomepageSections = { ...DEFAULT_HOMEPAGE_SECTIONS, ..._sections };

  const heroBanners = banners.filter((b: HomeBanner) => b.position === "hero_leaderboard");
  const articleBanners = banners.filter((b: HomeBanner) => b.position === "article_native");
  const bazarBanners = banners.filter((b: HomeBanner) => b.position === "bazar_native");

  return (
    <div>
      {/* ===================== HERO (compact) ===================== */}
      <section className="hero-section" style={{ paddingTop: "32px", paddingBottom: "32px", minHeight: "auto" }}>
        <div style={{ position: "relative", zIndex: 2, padding: "0 20px", textAlign: "center" }}>
          <BadgeLogo size="lg" />
          <p style={{ fontSize: "17px", color: "var(--text-dim)", maxWidth: "480px", margin: "12px auto 24px" }}>
            Návody, recenze, kolejové plány a komunita modelářů
          </p>
          <form
            onSubmit={handleSearch}
            style={{
              display: "flex",
              maxWidth: "460px",
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
                padding: "12px 18px",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "12px 22px",
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

      {/* ===================== 🏠 LEADERBOARD BANNER (Pozice 1) ===================== */}
      {sections.leaderboard_banner && <LeaderboardBanner banners={heroBanners} />}

      {/* ===================== 📰 NEJNOVĚJŠÍ Z KOMUNITY ===================== */}
      {sections.latest_articles && <section style={{ maxWidth: "1200px", margin: "40px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>📰 Nejnovější z komunity</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]" style={{ gap: "24px" }}>
          {/* Left: Latest Articles */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {latestArticles.map((a: LatestArticle, i: number) => {
              const authorName = a.author?.display_name || a.author?.username || "Anonym";
              const initials = authorName.charAt(0).toUpperCase();
              const date = a.published_at
                ? new Date(a.published_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
                : "";
              return (
                <Link key={a.id} href={`/clanky/${a.slug}`} style={{ textDecoration: "none" }}>
                  <div className="flex flex-col sm:flex-row" style={{
                    gap: "16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {/* Article image — same approach as ProductCard */}
                    <div className="w-full sm:w-[200px]" style={{ position: "relative", flexShrink: 0, overflow: "hidden" }}>
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "var(--bg-page)" }}>
                        {a.cover_image_url ? (
                          <Image
                            src={getImageVariant(a.cover_image_url, "card")}
                            alt={a.title}
                            fill
                            style={{ objectFit: "contain" }}
                            sizes="200px"
                            priority={i < 2}
                          />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "var(--text-dimmer)" }}>
                            {a.category?.icon || "📄"}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Article info */}
                    <div style={{ padding: "14px 16px 14px 0", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                        {a.category && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "3px",
                            padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                            background: "var(--accent-bg)", color: "var(--accent)",
                          }}>
                            <CategoryIcon slug={a.category.slug} emoji={a.category.icon} size={12} /> {a.category.name}
                          </span>
                        )}
                        <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>{date}</span>
                      </div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: "6px" }}>
                        {a.title}
                      </h3>
                      <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {a.excerpt || ""}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                        {a.author?.avatar_url ? (
                          <Image src={a.author.avatar_url} alt="" width={20} height={20} style={{ borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--border-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--text-muted)" }}>
                            {initials}
                          </div>
                        )}
                        <span style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{authorName}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            <Link href="/clanky" style={{ fontSize: "14px", color: "var(--accent)", textDecoration: "none", fontWeight: 600, textAlign: "center", display: "block", padding: "8px 0" }}>
              Všechny články →
            </Link>
          </div>

          {/* Right sidebar: Forum threads + Bazar listings */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Recent forum threads */}
            {recentForumThreads && recentForumThreads.length > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>💬 Z fóra</h3>
                  <Link href="/forum" style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none" }}>Fórum →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {recentForumThreads.map((t: RecentForumThread) => (
                    <Link key={t.id} href={`/forum/${t.section_slug}/${t.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "var(--bg-page)",
                        border: "1px solid transparent",
                        transition: "border-color 0.2s",
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                      >
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "11px", color: "var(--text-dimmer)" }}>
                          <span>{t.author_display_name}</span>
                          <span>·</span>
                          <span>{t.section_name}</span>
                          <span>·</span>
                          <span>{t.post_count} přísp.</span>
                          {t.last_post_at && (
                            <>
                              <span>·</span>
                              <span>{timeAgo(t.last_post_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Activity feed */}
            {sections.activity_feed && activityFeed && activityFeed.length > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>⚡ Aktivita na webu</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {activityFeed.slice(0, 8).map((item: ActivityFeedItem) => {
                    const icons: Record<string, string> = { article: '📝', listing: '🛒', forum: '💬', shop: '🛍️', member: '👋' };
                    const icon = icons[item.type] || '📌';
                    const labels: Record<string, string> = { article: 'Nový článek', listing: 'Nový inzerát', forum: 'Nové vlákno', shop: 'Nový produkt', member: 'Nový člen' };
                    const label = labels[item.type] || '';
                    return (
                      <Link key={item.id} href={item.link} style={{ textDecoration: "none" }}>
                        <div style={{
                          display: "flex", gap: "10px", alignItems: "flex-start",
                          padding: "8px", borderRadius: "8px",
                          transition: "background 0.15s",
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-page)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>
                              {label} · {timeAgo(item.created_at)}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.type === 'member' ? `${item.title} se zaregistroval/a` : item.title}
                            </div>
                            {item.author_name && item.type !== 'member' && (
                              <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "1px" }}>{item.author_name}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sidebar banner */}
            {sections.sidebar_banner && (() => {
              const sidebarBanners = banners.filter((b: HomeBanner) => b.position === "sidebar_native");
              if (sidebarBanners.length === 0) return null;
              const banner = sidebarBanners[Math.floor((Date.now() / 60000) % sidebarBanners.length)];
              return (
                <a href={banner.link_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
                  <div style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px",
                    overflow: "hidden", transition: "border-color 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    {banner.image_url && (
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%" }}>
                        <Image src={banner.image_url} alt={banner.title} fill style={{ objectFit: "cover" }} sizes="340px" />
                      </div>
                    )}
                    <div style={{ padding: "12px 14px" }}>
                      {banner.badge_text && (
                        <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--accent)", color: "#000", padding: "2px 6px", borderRadius: "4px", marginBottom: "4px", display: "inline-block" }}>
                          {banner.badge_text}
                        </span>
                      )}
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>{banner.title}</div>
                      {banner.subtitle && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{banner.subtitle}</div>}
                    </div>
                  </div>
                </a>
              );
            })()}
          </div>
        </div>
      </section>}

      {/* ===================== 💬 AKTIVNÍ DISKUZE ===================== */}
      {sections.forum_bar && <section style={{ maxWidth: "1200px", margin: "40px auto 0", padding: "0 20px" }}>
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px",
          padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>💬 Aktivní diskuze</h2>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                <strong style={{ color: "var(--accent)" }}>{forumStats.thread_count}</strong> vláken
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                <strong style={{ color: "var(--accent)" }}>{forumStats.post_count}</strong> příspěvků
              </span>
            </div>
            {forumStats.last_thread_title && forumStats.last_thread_id && (
              <Link
                href={`/forum/${forumStats.last_thread_section_slug || "obecna-diskuze"}/${forumStats.last_thread_id}`}
                style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px" }}
              >
                Poslední: {forumStats.last_thread_title}
              </Link>
            )}
          </div>
          <Link href="/forum" style={{
            padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text-on)",
            borderRadius: "8px", fontSize: "14px", fontWeight: 600, textDecoration: "none", flexShrink: 0,
          }}>
            Přejít na fórum →
          </Link>
        </div>
      </section>}

      {/* ===================== 📂 KATEGORIE (compact) ===================== */}
      {sections.categories && <section style={{ maxWidth: "1200px", margin: "40px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>📂 Kategorie</h2>
          <Link href="#" style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}>
            Zobrazit vše →
          </Link>
        </div>
        <div
          className="cat-grid"
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {categories.map((cat) => (
            <Link key={cat.href} href={cat.href} style={{ textDecoration: "none" }}>
              <div className="cat-card" style={{ padding: "16px 10px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px", display: "flex", justifyContent: "center", alignItems: "center", height: "44px" }}>
                  {cat.iconUrl ? (
                    <img src={cat.iconUrl} alt={cat.title} style={{ width: "44px", height: "44px", objectFit: "contain" }} />
                  ) : (
                    cat.icon
                  )}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-body)" }}>{cat.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "3px" }}>{cat.count} článků</div>
              </div>
            </Link>
          ))}
        </div>
      </section>}

      {/* ===================== 🎯 CTA STRIP (Pozice 3) ===================== */}
      {sections.cta_strip && <CtaStrip />}

      {/* ===================== 📊 STATS BAR ===================== */}
      {sections.stats_bar && <div className="stats-bar" style={{ background: "var(--bg-header)", padding: "16px 0", marginTop: "40px" }}>
        <div
          className="stats-bar-inner"
          style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px", display: "flex", justifyContent: "center", gap: "48px" }}
        >
          {[
            { num: stats.articles, label: "Článků", sub: "publikovaných" },
            { num: stats.members, label: "Členů", sub: "registrovaných" },
            { num: stats.downloads, label: "Ke stažení", sub: "souborů" },
            { num: stats.photos, label: "V galerii", sub: "fotek" },
            { num: forumStats.thread_count.toLocaleString("cs-CZ"), label: "Diskuzí", sub: "na fóru" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div className="stats-num" style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)" }}>{s.num}</div>
              <div className="stats-label" style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* ===================== 🏆 INLINE BANNER (Pozice 4) ===================== */}
      {sections.inline_banner && <InlineBanner competition={competition} />}

      {/* ===================== BAZAR (full) ===================== */}
      {sections.bazar && latestListings && latestListings.length > 0 && (
        <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>🛒 Nejnovější v bazaru</h2>
            <Link href="/bazar" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
              Zobrazit vše →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: "16px" }}>
            {/* Bazar listings — if native banner exists, replace a random slot */}
            {(() => {
              const condLabel: Record<string, string> = { new: "Nový", opened: "Rozbalený", used: "Použitý", parts: "Na díly" };
              const condColor: Record<string, string> = { new: "#22c55e", opened: "#3b82f6", used: "#f59e0b", parts: "#ef4444" };
              const scaleColor: Record<string, string> = { TT: "#3b82f6", H0: "#22c55e", N: "#a855f7", Z: "#ec4899", G: "#f59e0b" };

              const hasBazarBanner = bazarBanners.length > 0 && latestListings.length >= 4;
              const displayListings = hasBazarBanner ? latestListings.slice(0, 3) : latestListings;
              const bannerPos = hasBazarBanner
                ? Math.floor(Date.now() / 60000) % 4
                : -1;

              const items: React.ReactNode[] = displayListings.map((listing: BazarListingHome) => {
                const firstImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;
                return (
                  <Link key={listing.id} href={`/bazar/${listing.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", height: "100%" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "var(--bg-page)" }}>
                        {firstImage ? (
                          <Image src={optimizeImageUrl(firstImage)} alt={listing.title} fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "var(--text-dimmer)" }}>🚂</div>
                        )}
                      </div>
                      <div style={{ padding: "12px" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>{listing.price.toLocaleString("cs-CZ")} Kč</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{listing.title}</div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {listing.scale && <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, background: `${scaleColor[listing.scale] || "#6b7280"}20`, color: scaleColor[listing.scale] || "#6b7280" }}>{listing.scale}</span>}
                          <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, background: `${condColor[listing.condition]}20`, color: condColor[listing.condition] }}>{condLabel[listing.condition] || listing.condition}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              });

              if (hasBazarBanner) {
                const b = bazarBanners[0];
                const bannerCard = (
                  <a key="bazar-native" href={b.link_url} onClick={() => trackBannerClick(b.id)} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent-border)", borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", height: "100%", position: "relative" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "var(--bg-page)" }}>
                        {b.image_url ? (
                          <Image src={b.image_url} alt={b.title} fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "var(--accent)" }}>🛡️</div>
                        )}
                      </div>
                      <div style={{ padding: "12px" }}>
                        {b.badge_text && <div style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "var(--accent)", color: "#000", display: "inline-block", marginBottom: "6px" }}>{b.badge_text}</div>}
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{b.title}</div>
                        {b.subtitle && <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{b.subtitle}</div>}
                      </div>
                    </div>
                  </a>
                );
                items.splice(bannerPos, 0, bannerCard);
              }

              return items;
            })()}
          </div>
        </section>
      )}

      {/* ===================== COMPETITION ===================== */}
      {sections.competition && competition && (
        <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
          <CompetitionBanner competition={competition} />
        </section>
      )}

      {/* ===================== FEATURED SHOP PRODUCTS ===================== */}
      {sections.shop_products && featuredShopProducts && featuredShopProducts.length > 0 && (
        <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>🛍️ Doporučené produkty</h2>
            <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
              Zobrazit Shop →
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {(() => {
              const catColors: Record<string, string> = {
                "kolejovy-plan": "#3b82f6",
                "stl-model": "#a855f7",
                navod: "#22c55e",
                ebook: "#f59e0b",
                balicek: "#ec4899",
              };
              const catLabels: Record<string, string> = {
                "kolejovy-plan": "📐 Kolejové plány",
                "stl-model": "🧊 3D modely",
                navod: "📖 Návody",
                ebook: "📖 E-booky",
                balicek: "📦 Balíčky",
              };

              const hasShopBanner = articleBanners.length > 0 && featuredShopProducts.length >= 4;
              const displayProducts = hasShopBanner ? featuredShopProducts.slice(0, 3) : featuredShopProducts;
              const shopBannerPos = hasShopBanner
                ? Math.floor(Date.now() / 60000) % 4
                : -1;

              const shopItems: React.ReactNode[] = displayProducts.map((p: ShopProductHome) => {
                const isFree = p.price === 0;
                const hasDiscount = p.original_price && p.original_price > p.price;
                const catColor = catColors[p.category] || "#6b7280";
                return (
                  <Link key={p.id} href={`/shop/${p.slug}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        overflow: "hidden",
                        transition: "all 0.2s",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "var(--bg-page)" }}>
                        {p.cover_image_url ? (
                          <Image src={getImageVariant(p.cover_image_url, "card")} alt={p.title} fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", color: "var(--text-dimmer)" }}>
                            {p.category === "kolejovy-plan" ? "📐" : p.category === "stl-model" ? "🧊" : "📖"}
                          </div>
                        )}
                        <div style={{ position: "absolute", top: "8px", left: "8px", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: `${catColor}dd`, color: "#fff" }}>
                          {catLabels[p.category] || p.category}
                        </div>
                        {isFree && (
                          <div style={{ position: "absolute", top: "8px", right: "8px", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "rgba(34,197,94,0.9)", color: "#fff" }}>
                            ZDARMA
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "20px", fontWeight: 700, color: isFree ? "#22c55e" : "var(--accent)" }}>
                            {isFree ? "Zdarma" : `${p.price.toLocaleString("cs-CZ")} Kč`}
                          </span>
                          {hasDiscount && (
                            <span style={{ fontSize: "14px", color: "var(--text-dimmer)", textDecoration: "line-through" }}>
                              {p.original_price!.toLocaleString("cs-CZ")} Kč
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", flex: 1 }}>
                          {p.title}
                        </h3>
                        <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "8px" }}>
                          ⬇️ {p.download_count}× staženo
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              });

              if (hasShopBanner) {
                const b = articleBanners[0];
                const shopBannerCard = (
                  <a key="article-native" href={b.link_url} onClick={() => trackBannerClick(b.id)} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent-border)", borderRadius: "12px", overflow: "hidden", transition: "all 0.2s", height: "100%", display: "flex", flexDirection: "column" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "var(--bg-page)" }}>
                        {b.image_url ? (
                          <Image src={b.image_url} alt={b.title} fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", color: "var(--accent)" }}>⭐</div>
                        )}
                        <div style={{ position: "absolute", top: "8px", left: "8px", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: "var(--accent)", color: "#000" }}>
                          {b.badge_text || "Sponzorováno"}
                        </div>
                      </div>
                      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", flex: 1 }}>{b.title}</h3>
                        {b.subtitle && <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "8px" }}>{b.subtitle}</div>}
                      </div>
                    </div>
                  </a>
                );
                shopItems.splice(shopBannerPos, 0, shopBannerCard);
              }

              return shopItems;
            })()}
          </div>
        </section>
      )}

      {/* ===================== DOWNLOADS ===================== */}
      {sections.downloads && <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
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
      </section>}

      {/* ===================== MAIN + SIDEBAR ===================== */}
      {(sections.popular_articles || sections.events || sections.active_authors || sections.forum_widget || sections.tags) && <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_320px]"
        style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px", gap: "32px" }}
      >
        {/* Main content */}
        <div>
          {sections.popular_articles && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>Populární tento měsíc</h2>
          </div>
          {popularArticles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "20px" }}>
              {popularArticles.map((a: PopularArticle) => (
                <Link key={a.id} href={`/clanky/${a.slug}`} style={{ textDecoration: "none" }}>
                  <div className="article-card">
                    <div className="article-img">
                      {a.cover_image_url ? (
                        <Image src={a.cover_image_url} alt={a.title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                      ) : (
                        <div className="placeholder">{a.category?.icon || "📄"}</div>
                      )}
                      {a.category && <span className="article-badge" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><CategoryIcon slug={a.category.slug} emoji={a.category.icon} size={14} /> {a.category.name}</span>}
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
          </>}
        </div>

        {/* Sidebar */}
        <aside>
          {/* Events */}
          {sections.events && <div className="widget">
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
          </div>}

          {/* Active authors */}
          {sections.active_authors && <div className="widget">
            <h3>🏆 Aktivní autoři</h3>
            <ul className="widget-list">
              {activeAuthors.map((a) => (
                <li key={a.name}>
                  <a href="#">{a.name}</a>
                  <span>{a.count} {a.count === 1 ? "článek" : a.count < 5 ? "články" : "článků"}</span>
                </li>
              ))}
            </ul>
          </div>}

          {/* Forum widget */}
          {sections.forum_widget && <div className="widget">
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
          </div>}

          {/* Tags */}
          {sections.tags && <div className="widget">
            <h3>🏷️ Štítky</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {popularTags.length > 0
                ? popularTags.map((t: PopularTag) => (
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
          </div>}
        </aside>
      </div>}
    </div>
  );
}
