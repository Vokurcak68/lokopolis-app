"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import BadgeLogo from "./BadgeLogo";
import UserMenu from "./Auth/UserMenu";
import { useAuth } from "./Auth/AuthProvider";
import { useTheme } from "./ThemeProvider";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Domů", href: "/", active: true },
  { label: "Články", href: "/clanky" },
  { label: "Galerie", href: "/galerie" },
  { label: "Ke stažení", href: "/ke-stazeni" },
  { label: "Akce", href: "/akce" },
  { label: "Fórum", href: "/forum" },
  { label: "🛤️ Návrhář", href: "/navrhar-trati" },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      style={{
        background: "none",
        border: "1px solid var(--border-nav)",
        borderRadius: "8px",
        padding: "6px 10px",
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: 1,
        color: "var(--text-muted)",
        transition: "border-color 0.2s",
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .eq("verified", false)
      .then(({ count }) => {
        if (count !== null) setPendingCount(count);
      });
  }, [isAdmin]);

  return (
    <header
      style={{
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          height: "64px",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <BadgeLogo size="sm" />
        </Link>

        <nav className="hidden md:flex" style={{ gap: 0 }}>
          {navItems.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`nav-link${item.active ? " active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex" style={{ alignItems: "center", gap: "12px" }}>
          <span style={{ color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "8px" }}>
            🔍
          </span>
          <ThemeToggle />
          {user ? (
            <>
              {isAdmin && pendingCount > 0 && (
                <Link
                  href="/admin/clanky"
                  style={{
                    position: "relative",
                    padding: "8px 12px",
                    border: "1px solid var(--border-nav)",
                    borderRadius: "8px",
                    color: "var(--accent)",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  🔔
                  <span
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {pendingCount}
                  </span>
                </Link>
              )}
              <Link
                href="/novy-clanek"
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "8px",
                  background: "var(--accent)",
                  color: "var(--accent-text-on)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                ✏️ Napsat článek
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link
                href="/prihlaseni"
                style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border-nav)",
                  borderRadius: "8px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  background: "transparent",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                Přihlásit
              </Link>
              <Link
                href="/registrace"
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "8px",
                  background: "var(--accent)",
                  color: "var(--accent-text-on)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                Registrace
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ThemeToggle />
          <button
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="md:hidden" style={{ padding: "0 20px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "12px" }}>
            {navItems.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                style={{
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "8px 0",
                  textDecoration: "none",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div style={{ paddingTop: "12px", borderTop: "1px solid var(--border)", marginTop: "8px" }}>
              {user ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {isAdmin && pendingCount > 0 && (
                    <Link
                      href="/admin/clanky"
                      style={{
                        color: "var(--accent)",
                        fontSize: "14px",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      🔔 Ke schválení
                      <span
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: 700,
                          borderRadius: "50%",
                          width: "20px",
                          height: "20px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {pendingCount}
                      </span>
                    </Link>
                  )}
                  <Link
                    href="/novy-clanek"
                    style={{ color: "var(--accent)", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ✏️ Napsat článek
                  </Link>
                  <UserMenu />
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Link href="/prihlaseni" style={{ color: "var(--text-muted)", fontSize: "13px", textDecoration: "none" }}>
                    Přihlásit
                  </Link>
                  <Link href="/registrace" style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                    Registrace
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
