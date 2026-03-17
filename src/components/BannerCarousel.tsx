"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { HomeBanner } from "@/app/home-data";

function trackBannerClick(bannerId: string) {
  fetch("/api/banners/click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banner_id: bannerId }) }).catch(() => {});
}

interface BannerCarouselProps {
  banners: HomeBanner[];
  variant: "leaderboard" | "native_card" | "sidebar";
  /** Auto-rotate interval in ms. Default 6000 (6s). 0 = no auto-rotate */
  interval?: number;
}

export default function BannerCarousel({ banners, variant, interval = 6000 }: BannerCarouselProps) {
  // Random start index per user (per mount)
  const [index, setIndex] = useState(() => banners.length > 1 ? Math.floor(Math.random() * banners.length) : 0);
  const [paused, setPaused] = useState(false);
  const [fade, setFade] = useState(true);

  const next = useCallback(() => {
    if (banners.length <= 1) return;
    setFade(false);
    setTimeout(() => {
      setIndex(i => (i + 1) % banners.length);
      setFade(true);
    }, 300);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || interval === 0 || paused) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [banners.length, interval, paused, next]);

  if (!banners || banners.length === 0) return null;
  const banner = banners[index % banners.length];

  const fadeStyle = {
    opacity: fade ? 1 : 0,
    transition: "opacity 0.3s ease-in-out",
  };

  // Dots indicator (only if multiple)
  const dots = banners.length > 1 ? (
    <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginTop: "8px" }}>
      {banners.map((_, i) => (
        <button
          key={i}
          onClick={() => { setFade(false); setTimeout(() => { setIndex(i); setFade(true); }, 300); }}
          style={{
            width: "6px", height: "6px", borderRadius: "50%", border: "none", cursor: "pointer",
            background: i === index % banners.length ? "var(--accent)" : "var(--border-hover)",
            transition: "background 0.2s",
          }}
          aria-label={`Banner ${i + 1}`}
        />
      ))}
    </div>
  ) : null;

  if (variant === "leaderboard") {
    return (
      <section style={{ maxWidth: "1200px", margin: "24px auto 0", padding: "0 20px" }}>
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          style={fadeStyle}
        >
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
        </div>
        {dots}
      </section>
    );
  }

  if (variant === "sidebar") {
    return (
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div style={fadeStyle}>
          <a href={banner.link_url} onClick={() => trackBannerClick(banner.id)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
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
        </div>
        {dots}
      </div>
    );
  }

  // variant === "native_card" — inline card in a grid
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={fadeStyle}
    >
      <a
        href={banner.link_url}
        onClick={() => trackBannerClick(banner.id)}
        style={{ display: "block", textDecoration: "none", height: "100%" }}
      >
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--accent-border)",
          borderRadius: "12px", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(240,160,48,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {banner.image_url && (
            <div style={{ position: "relative", width: "100%", paddingBottom: "75%", overflow: "hidden" }}>
              <Image src={banner.image_url} alt={banner.title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 50vw, 280px" />
            </div>
          )}
          <div style={{ padding: "14px", flex: 1, display: "flex", flexDirection: "column" }}>
            {banner.badge_text && (
              <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 700, background: "var(--accent)", color: "#000", padding: "2px 8px", borderRadius: "4px", marginBottom: "6px", width: "fit-content" }}>
                {banner.badge_text}
              </span>
            )}
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{banner.title}</div>
            {banner.subtitle && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{banner.subtitle}</div>}
          </div>
        </div>
      </a>
      {dots}
    </div>
  );
}
