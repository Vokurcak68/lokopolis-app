"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./AuthProvider";

export default function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Zavřít menu kliknutím mimo
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-bg-card animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/prihlaseni"
        className="px-4 py-1.5 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-bg-dark transition-all"
      >
        Přihlásit se
      </Link>
    );
  }

  const displayName = profile?.display_name || profile?.username || "Uživatel";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 group"
      >
        {profile?.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={displayName}
            width={32}
            height={32}
            className="rounded-full object-cover border border-border-subtle"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
            {initials}
          </div>
        )}
        <span className="hidden sm:block text-sm text-text-muted group-hover:text-[var(--text-primary)] transition-colors">
          {displayName}
        </span>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-bg-card border border-border-subtle shadow-xl py-2 z-50">
          <div className="px-4 py-2 border-b border-border-subtle">
            <p className="text-sm text-[var(--text-primary)] font-medium truncate">{displayName}</p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
          </div>

          <Link
            href="/moje-clanky"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-2 text-sm text-text-muted hover:text-[var(--text-primary)] hover:bg-bg-card-hover transition-colors"
          >
            📝 Moje články
          </Link>

          {profile?.role === "admin" && (
            <Link
              href="/admin/clanky"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-primary hover:bg-bg-card-hover transition-colors"
            >
              🛡️ Správa článků
            </Link>
          )}

          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full text-left px-4 py-2 text-sm text-text-muted hover:text-red-400 hover:bg-bg-card-hover transition-colors"
          >
            Odhlásit se
          </button>
        </div>
      )}
    </div>
  );
}
