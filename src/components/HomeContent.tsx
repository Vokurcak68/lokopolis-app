"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BadgeLogo from "@/components/BadgeLogo";
import Link from "next/link";
import type {
  HomePageData,
  LatestArticle,
  PopularArticle,
  PopularTag,
} from "@/app/home-data";

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
    activeAuthors,
  } = data;

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
          {latestArticles.map((a: LatestArticle, i: number) => {
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
                      <Image src={a.cover_image_url} alt={a.title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" priority={i < 3} />
                    ) : (
                      <div className="placeholder">{a.category?.icon || "📄"}</div>
                    )}
                    {a.category && <span className="article-badge">{a.category.icon} {a.category.name}</span>}
                  </div>
                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      {a.author?.avatar_url ? (
                        <Image src={a.author.avatar_url} alt="" width={24} height={24} style={{ borderRadius: "50%", objectFit: "cover" }} />
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
              {popularArticles.map((a: PopularArticle) => (
                <Link key={a.id} href={`/clanky/${a.slug}`} style={{ textDecoration: "none" }}>
                  <div className="article-card">
                    <div className="article-img">
                      {a.cover_image_url ? (
                        <Image src={a.cover_image_url} alt={a.title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
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
          </div>
        </aside>
      </div>
    </div>
  );
}
