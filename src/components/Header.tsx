"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import BadgeLogo from "./BadgeLogo";
import UserMenu from "./Auth/UserMenu";
import { useAuth } from "./Auth/AuthProvider";
import { useTheme } from "./ThemeProvider";
import { useCart } from "./Shop/CartProvider";
import { supabase } from "@/lib/supabase";
import AdminNotifications from "./AdminNotifications";

interface NavLink {
  label: string;
  href: string;
  key: string;
}

interface NavGroup {
  label: string;
  children: NavLink[];
}

type NavItem = NavLink | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

// Master definition — filtered at runtime by menu settings
const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Domů", href: "/", key: "home" },
  { label: "Články", href: "/clanky", key: "articles" },
  {
    label: "Komunita",
    children: [
      { label: "Fórum", href: "/forum", key: "forum" },
      { label: "Galerie", href: "/galerie", key: "gallery" },
      { label: "Akce", href: "/akce", key: "events" },
      { label: "Soutěž", href: "/soutez", key: "competition" },
    ],
  },
  {
    label: "Obchod",
    children: [
      { label: "Shop", href: "/shop", key: "shop" },
      { label: "Bazar", href: "/bazar", key: "bazar" },
      { label: "Ke stažení", href: "/ke-stazeni", key: "downloads" },
    ],
  },
];

const ALL_LINKS: NavLink[] = [
  { label: "Domů", href: "/", key: "home" },
  { label: "Články", href: "/clanky", key: "articles" },
  { label: "Fórum", href: "/forum", key: "forum" },
  { label: "Galerie", href: "/galerie", key: "gallery" },
  { label: "Akce", href: "/akce", key: "events" },
  { label: "Soutěž", href: "/soutez", key: "competition" },
  { label: "Shop", href: "/shop", key: "shop" },
  { label: "Bazar", href: "/bazar", key: "bazar" },
  { label: "Ke stažení", href: "/ke-stazeni", key: "downloads" },
];

type MenuSettings = Record<string, boolean>;

function filterNavItems(items: NavItem[], settings: MenuSettings): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    if (isGroup(item)) {
      const visibleChildren = item.children.filter(c => settings[c.key] !== false);
      if (visibleChildren.length > 0) {
        // If only 1 child left, flatten to direct link
        if (visibleChildren.length === 1) {
          result.push(visibleChildren[0]);
        } else {
          result.push({ label: item.label, children: visibleChildren });
        }
      }
    } else {
      if (settings[item.key] !== false) {
        result.push(item);
      }
    }
  }
  return result;
}

function filterLinks(links: NavLink[], settings: MenuSettings): NavLink[] {
  return links.filter(l => settings[l.key] !== false);
}

function NavDropdown({ item }: { item: NavGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ position: "relative" }}
    >
      <button
        className="nav-link"
        onClick={() => setOpen((p) => !p)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "3px",
          font: "inherit",
        }}
      >
        {item.label}
        <span style={{ fontSize: "10px", opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "4px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "6px 0",
            minWidth: "160px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 200,
          }}
        >
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "9px 20px",
                color: "var(--text-body)",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-page)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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

function CartBadge() {
  const { cartCount } = useCart();
  return (
    <Link
      href="/kosik"
      title="Košík"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        border: "1px solid var(--border-nav)",
        borderRadius: "8px",
        color: "var(--text-muted)",
        fontSize: "16px",
        lineHeight: 1,
        textDecoration: "none",
        transition: "border-color 0.2s",
      }}
    >
      🛒
      {cartCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: "#ef4444",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 700,
            borderRadius: "50%",
            minWidth: "18px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [menuSettings, setMenuSettings] = useState<MenuSettings>({});
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    // Load menu visibility settings
    fetch("/api/admin/menu-sections")
      .then(r => r.ok ? r.json() : {})
      .then(data => setMenuSettings(data))
      .catch(() => {});
  }, []);

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

  const navItems = filterNavItems(ALL_NAV_ITEMS, menuSettings);
  const allLinks = filterLinks(ALL_LINKS, menuSettings);

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

        <nav className="desktop-nav" style={{ gap: 0, alignItems: "center" }}>
          {navItems.map((item) =>
            isGroup(item) ? (
              <NavDropdown key={item.label} item={item} />
            ) : (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="nav-link"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="desktop-actions" style={{ alignItems: "center", gap: "12px" }}>
          <CartBadge />
          <ThemeToggle />
          {user ? (
            <>
              {isAdmin && <AdminNotifications />}
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

        <div className="mobile-controls" style={{ alignItems: "center", gap: "8px" }}>
          <CartBadge />
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
        <nav className="mobile-menu" style={{ padding: "0 20px 16px", borderTop: "1px solid var(--border)", maxHeight: "calc(100vh - 64px)", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "12px" }}>
            {allLinks.map((item) => (
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
                  {isAdmin && <AdminNotifications />}
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
