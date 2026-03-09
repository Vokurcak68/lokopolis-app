"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface LatestArticle {
  title: string;
  slug: string;
  cover_image_url: string | null;
}

const STATIC_LINKS = [
  {
    emoji: "🏠",
    label: "Lokopolis — Hlavní stránka",
    href: "https://www.lokopolis.cz",
    color: "#f0a030",
  },
  {
    emoji: "📰",
    label: "Všechny články",
    href: "https://www.lokopolis.cz/clanky",
    color: "#3b82f6",
  },
  {
    emoji: "🖼️",
    label: "Galerie",
    href: "https://www.lokopolis.cz/galerie",
    color: "#8b5cf6",
  },
  {
    emoji: "💬",
    label: "Fórum — diskuze komunity",
    href: "https://www.lokopolis.cz/forum",
    color: "#10b981",
  },
  {
    emoji: "📅",
    label: "Akce a srazy",
    href: "https://www.lokopolis.cz/akce",
    color: "#ef4444",
  },
  {
    emoji: "📥",
    label: "Ke stažení",
    href: "https://www.lokopolis.cz/ke-stazeni",
    color: "#06b6d4",
  },
];

export default function LinksContent() {
  const [articles, setArticles] = useState<LatestArticle[]>([]);

  useEffect(() => {
    supabase
      .from("articles")
      .select("title, slug, cover_image_url")
      .eq("status", "published")
      .eq("verified", true)
      .order("published_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setArticles(data);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 20px 60px",
        background: "var(--bg-dark)",
      }}
    >
      {/* Profile */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f0a030, #e67e22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: "36px",
          }}
        >
          🚂
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 4px",
          }}
        >
          Lokopolis
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-body)",
            margin: 0,
          }}
        >
          Svět modelové železnice 🚂
        </p>
      </div>

      {/* Links */}
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {STATIC_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 20px",
              marginBottom: "10px",
              borderRadius: "12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              textDecoration: "none",
              fontSize: "15px",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: "20px" }}>{link.emoji}</span>
            <span style={{ flex: 1 }}>{link.label}</span>
            <span style={{ color: "var(--text-body)", fontSize: "14px" }}>→</span>
          </a>
        ))}

        {/* Latest articles */}
        {articles.length > 0 && (
          <>
            <div
              style={{
                textAlign: "center",
                margin: "28px 0 14px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-body)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              📰 Nejnovější články
            </div>
            {articles.map((article) => (
              <a
                key={article.slug}
                href={`https://www.lokopolis.cz/clanky/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  marginBottom: "8px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
              >
                {article.cover_image_url ? (
                  <div
                    style={{
                      position: "relative",
                      width: "44px",
                      height: "44px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src={article.cover_image_url}
                      alt={article.title}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="44px"
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: "20px" }}>📄</span>
                )}
                <span style={{ flex: 1, lineHeight: 1.3 }}>{article.title}</span>
                <span style={{ color: "var(--text-body)", fontSize: "14px" }}>→</span>
              </a>
            ))}
          </>
        )}

        {/* Instagram */}
        <a
          href="https://www.instagram.com/lokopolis/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "14px 20px",
            marginTop: "24px",
            borderRadius: "12px",
            background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
            color: "#fff",
            textDecoration: "none",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
          Sleduj @lokopolis
        </a>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "32px",
            fontSize: "12px",
            color: "var(--text-body)",
            opacity: 0.6,
          }}
        >
          © 2026 Lokopolis — Svět modelové železnice
        </p>
      </div>
    </div>
  );
}
