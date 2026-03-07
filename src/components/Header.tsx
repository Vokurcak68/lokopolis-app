"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import BadgeLogo from "./BadgeLogo";
import UserMenu from "./Auth/UserMenu";
import { useAuth } from "./Auth/AuthProvider";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Domů", href: "/", active: true },
  { label: "Články", href: "/clanky" },
  { label: "Galerie", href: "/galerie" },
  { label: "Ke stažení", href: "/ke-stazeni" },
  { label: "Akce", href: "/akce" },
  { label: "Fórum", href: "/forum" },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const isAdmin = profile?.role === "admin";

  // Fetch pending articles count for admin
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
        background: "#161822",
        borderBottom: "1px solid #252838",
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
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <BadgeLogo size="sm" />
        </Link>

        {/* Desktop nav */}
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

        {/* Desktop actions */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#a0a4b8", cursor: "pointer", fontSize: "18px", padding: "8px" }}>
            🔍
          </span>
          {user ? (
            <>
              {isAdmin && pendingCount > 0 && (
                <Link
                  href="/admin/clanky"
                  style={{
                    position: "relative",
                    padding: "8px 12px",
                    border: "1px solid #3a3f55",
                    borderRadius: "8px",
                    color: "#f0a030",
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
                  background: "#f0a030",
                  color: "#0f1117",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
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
                  border: "1px solid #3a3f55",
                  borderRadius: "8px",
                  color: "#a0a4b8",
                  fontSize: "13px",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.2s",
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
                  background: "#f0a030",
                  color: "#0f1117",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  textDecoration: "none",
                }}
              >
                Registrace
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          style={{ color: "#a0a4b8", background: "none", border: "none", cursor: "pointer" }}
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden" style={{ padding: "0 20px 16px", borderTop: "1px solid #252838" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "12px" }}>
            {navItems.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                style={{
                  color: "#a0a4b8",
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
            <div style={{ paddingTop: "12px", borderTop: "1px solid #252838", marginTop: "8px" }}>
              {user ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {isAdmin && pendingCount > 0 && (
                    <Link
                      href="/admin/clanky"
                      style={{
                        color: "#f0a030",
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
                    style={{ color: "#f0a030", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ✏️ Napsat článek
                  </Link>
                  <UserMenu />
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Link href="/prihlaseni" style={{ color: "#a0a4b8", fontSize: "13px", textDecoration: "none" }}>
                    Přihlásit
                  </Link>
                  <Link href="/registrace" style={{ color: "#f0a030", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
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
