"use client";

import { useEffect, useState } from "react";
import BadgeLogo from "@/components/BadgeLogo";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ============================================================
   DATA
   ============================================================ */

const categories = [
  { title: "Stavba kolejiště", icon: "🏗️", count: 214, href: "/kategorie/stavba-kolejiste" },
  { title: "Recenze modelů", icon: "🔍", count: 186, href: "/kategorie/recenze" },
  { title: "Návody & tipy", icon: "🔧", count: 153, href: "/kategorie/navody-a-tipy" },
  { title: "Krajina & scenérie", icon: "🎨", count: 128, href: "/kategorie/krajina-a-zelen" },
  { title: "Digitalizace", icon: "⚡", count: 97, href: "/kategorie/digitalni-rizeni" },
  { title: "Přestavby", icon: "🚃", count: 142, href: "/kategorie/prestavby" },
  { title: "Kolejové plány", icon: "📐", count: 85, href: "/kategorie/kolejove-plany" },
  { title: "Modelové domy", icon: "🏠", count: 74, href: "/kategorie/modelove-domy" },
  { title: "Nátěry & patina", icon: "🖌️", count: 63, href: "/kategorie/natery-a-patina" },
  { title: "Osvětlení", icon: "💡", count: 52, href: "/kategorie/osvetleni" },
  { title: "3D tisk", icon: "🖨️", count: 41, href: "/kategorie/3d-tisk" },
  { title: "Ze světa", icon: "🌍", count: 38, href: "/kategorie/ze-sveta" },
];

const demoArticles = [
  {
    id: 1,
    emoji: "🏔️",
    badge: "Stavba",
    authorInitials: "PH",
    author: "Petr Havlík",
    date: "4. března 2026",
    title: "Stavba nádraží Měchenice — od plánu po první vlak",
    excerpt: "Jak jsem navrhl a postavil repliku nádraží z epochy IV. Kompletní postup včetně materiálů a technik.",
    views: 342,
    comments: 28,
    likes: 47,
  },
  {
    id: 2,
    emoji: "🚂",
    badge: "Recenze",
    authorInitials: "MK",
    author: "Milan Kratochvíl",
    date: "2. března 2026",
    title: "Tillig BR 01 — stojí nový model za tu cenu?",
    excerpt: "Podrobná recenze nové Tillig parní lokomotivy. Srovnání s předchozí verzí, detaily, jízdní vlastnosti.",
    views: 521,
    comments: 43,
    likes: 62,
  },
  {
    id: 3,
    emoji: "⚡",
    badge: "Návod",
    authorInitials: "JN",
    author: "Jan Novotný",
    date: "28. února 2026",
    title: "DCC dekodér do V180 — kompletní návod krok za krokem",
    excerpt: "Instalace dekodéru Lenz Silver+ do lokomotivy V180 od Tillingu. Včetně nastavení CV hodnot.",
    views: 289,
    comments: 15,
    likes: 31,
  },
];

const demoDownloads = [
  {
    id: 1,
    iconClass: "pdf",
    iconEmoji: "📄",
    title: "Kolejový plán — Podhorské nádraží",
    desc: "Plán 250×120cm, epocha IV, dvoukolejná trať",
    type: "PDF",
    size: "3.2 MB",
    downloads: 184,
    rating: 4.8,
  },
  {
    id: 2,
    iconClass: "stl",
    iconEmoji: "🧊",
    title: "3D tisk — Telefonní budka ČSD",
    desc: "STL soubor pro tisk v měřítku TT i H0",
    type: "STL",
    size: "1.8 MB",
    downloads: 97,
    rating: 4.5,
  },
  {
    id: 3,
    iconClass: "zip",
    iconEmoji: "📦",
    title: "Obtisky — ČD Cargo vozy řady Eas",
    desc: "Potiskový arch pro laserovou tiskárnu",
    type: "ZIP",
    size: "5.4 MB",
    downloads: 142,
    rating: 4.9,
  },
];

const popularArticles = [
  {
    id: 10,
    emoji: "🌲",
    badge: "Krajina",
    title: "Realistické stromy za pár korun — domácí výroba",
    excerpt: "Návod na výrobu stromů z mořské houby, drátku a posypů. Výsledek překvapí.",
    views: "1 203",
    likes: 89,
  },
  {
    id: 11,
    emoji: "🛤️",
    badge: "Stavba",
    title: "Moje první kolejiště — chyby, kterým se vyhnout",
    excerpt: "Co bych udělal jinak, kdyby mohl začít znovu. Praktické rady pro začátečníky.",
    views: "2 150",
    likes: 134,
  },
];

const events = [
  { month: "Bře", day: "15", name: "Modelářská burza Praha", location: "Kulturní dům Barikádníků" },
  { month: "Bře", day: "22", name: "Výstava Kolín", location: "Výstaviště TPCA" },
  { month: "Dub", day: "5", name: "TT sraz Olomouc", location: "Klub přátel kolejí" },
];

const activeAuthors = [
  { name: "Petr Havlík", count: 42 },
  { name: "Milan Kratochvíl", count: 38 },
  { name: "Jan Novotný", count: 29 },
  { name: "Tomáš Müller", count: 24 },
  { name: "Radek Dvořák", count: 21 },
];

const tags = ["Tillig", "DCC", "epocha IV", "3D tisk", "ČSD", "krajina", "patina", "ROCO", "výhybky", "LED osvětlení"];

/* ============================================================
   COMPONENT
   ============================================================ */

export default function Home() {
  const [stats, setStats] = useState({
    articles: "1 247",
    members: "385",
    downloads: "92",
    photos: "4 820",
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: artCount } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true })
          .eq("status", "published");

        const { count: memberCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        if (artCount !== null || memberCount !== null) {
          setStats({
            articles: artCount !== null ? artCount.toLocaleString("cs-CZ") : "1 247",
            members: memberCount !== null ? memberCount.toLocaleString("cs-CZ") : "385",
            downloads: "92",
            photos: "4 820",
          });
        }
      } catch {
        // fallback — keep defaults
      }
    }
    fetchStats();
  }, []);

  return (
    <div>
      {/* ===================== HERO ===================== */}
      <section className="hero-section">
        <div style={{ position: "relative", zIndex: 2, padding: "0 20px", textAlign: "center" }}>
          <BadgeLogo size="lg" />
          <p style={{ fontSize: "20px", color: "#8a8ea0", maxWidth: "560px", margin: "16px auto 32px" }}>
            Návody, recenze, kolejové plány a komunita modelářů
          </p>
          <div
            style={{
              display: "flex",
              maxWidth: "480px",
              margin: "0 auto",
              background: "#1e2233",
              border: "1px solid #2a2f45",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <input
              type="text"
              placeholder="Hledej články, modely, kolejové plány..."
              style={{
                flex: 1,
                padding: "14px 20px",
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
              }}
            />
            <button
              style={{
                padding: "14px 24px",
                background: "#f0a030",
                border: "none",
                color: "#0f1117",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Hledat
            </button>
          </div>
        </div>
      </section>

      {/* ===================== STATS BAR ===================== */}
      <div style={{ background: "#161822", borderBottom: "1px solid #252838", padding: "16px 0" }}>
        <div
          className="flex flex-wrap justify-center"
          style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px", gap: "48px" }}
        >
          {[
            { num: stats.articles, label: "Článků" },
            { num: stats.members, label: "Členů" },
            { num: stats.downloads, label: "Ke stažení" },
            { num: stats.photos, label: "Fotografií" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#f0a030" }}>{s.num}</div>
              <div style={{ fontSize: "12px", color: "#6a6e80", textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================== CATEGORIES ===================== */}
      <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>Kategorie</h2>
          <Link href="#" style={{ fontSize: "13px", color: "#f0a030", textDecoration: "none" }}>
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
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>{cat.title}</div>
                <div style={{ fontSize: "12px", color: "#6a6e80", marginTop: "4px" }}>{cat.count} článků</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===================== LATEST ARTICLES ===================== */}
      <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>Nejnovější články</h2>
          <Link href="/clanky" style={{ fontSize: "13px", color: "#f0a030", textDecoration: "none" }}>
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
          {demoArticles.map((a) => (
            <div key={a.id} className="article-card">
              <div className="article-img">
                <div className="placeholder">{a.emoji}</div>
                <span className="article-badge">{a.badge}</span>
              </div>
              <div style={{ padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "#353a50",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      color: "#a0a4b8",
                    }}
                  >
                    {a.authorInitials}
                  </div>
                  <span style={{ fontSize: "12px", color: "#6a6e80" }}>{a.author}</span>
                  <span style={{ fontSize: "12px", color: "#555a70" }}>· {a.date}</span>
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "8px", lineHeight: 1.4 }}>
                  {a.title}
                </h3>
                <p style={{ fontSize: "13px", color: "#8a8ea0", lineHeight: 1.5 }}>{a.excerpt}</p>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid #252838",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#6a6e80", display: "flex", alignItems: "center", gap: "4px" }}>
                    👁️ {a.views}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6a6e80", display: "flex", alignItems: "center", gap: "4px" }}>
                    💬 {a.comments}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6a6e80", display: "flex", alignItems: "center", gap: "4px" }}>
                    ❤️ {a.likes}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== DOWNLOADS ===================== */}
      <section style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>Ke stažení</h2>
          <Link href="/ke-stazeni" style={{ fontSize: "13px", color: "#f0a030", textDecoration: "none" }}>
            Vše ke stažení →
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {demoDownloads.map((d) => (
            <div key={d.id} className="dl-card">
              <div className={`dl-icon ${d.iconClass}`}>{d.iconEmoji}</div>
              <div>
                <h4 style={{ fontSize: "14px", color: "#e0e0e0", marginBottom: "4px" }}>{d.title}</h4>
                <p style={{ fontSize: "12px", color: "#6a6e80" }}>{d.desc}</p>
                <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#555a70" }}>
                    {d.type} · {d.size}
                  </span>
                  <span style={{ fontSize: "11px", color: "#555a70" }}>⬇️ {d.downloads}×</span>
                  <span style={{ fontSize: "11px", color: "#555a70" }}>⭐ {d.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== MAIN + SIDEBAR ===================== */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_320px]"
        style={{ maxWidth: "1200px", margin: "48px auto 0", padding: "0 20px", gap: "32px" }}
      >
        {/* Main content */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>Populární tento měsíc</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "20px" }}>
            {popularArticles.map((a) => (
              <div key={a.id} className="article-card">
                <div className="article-img">
                  <div className="placeholder">{a.emoji}</div>
                  <span className="article-badge">{a.badge}</span>
                </div>
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "8px", lineHeight: 1.4 }}>
                    {a.title}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8a8ea0", lineHeight: 1.5 }}>{a.excerpt}</p>
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #252838",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#6a6e80", display: "flex", alignItems: "center", gap: "4px" }}>
                      👁️ {a.views}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6a6e80", display: "flex", alignItems: "center", gap: "4px" }}>
                      ❤️ {a.likes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside>
          {/* Events */}
          <div className="widget">
            <h3>📅 Nadcházející akce</h3>
            {events.map((e, i) => (
              <div key={i} className="event-item">
                <div className="event-date">
                  <span className="month">{e.month}</span>
                  <span className="day">{e.day}</span>
                </div>
                <div className="event-info">
                  <strong>{e.name}</strong>
                  <br />
                  {e.location}
                </div>
              </div>
            ))}
          </div>

          {/* Active authors */}
          <div className="widget">
            <h3>🏆 Aktivní autoři</h3>
            <ul className="widget-list">
              {activeAuthors.map((a) => (
                <li key={a.name}>
                  <a href="#">{a.name}</a>
                  <span>{a.count} článků</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Online */}
          <div className="widget">
            <h3>🟢 Online</h3>
            <p style={{ fontSize: "13px", color: "#8a8ea0" }}>
              <span className="online-dot" />
              12 uživatelů online
            </p>
            <p style={{ fontSize: "12px", color: "#555a70", marginTop: "8px" }}>
              Celkem registrováno: 385 členů
            </p>
          </div>

          {/* Tags */}
          <div className="widget">
            <h3>🏷️ Štítky</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
