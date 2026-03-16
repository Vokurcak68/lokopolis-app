"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import type { Listing, ListingStatus } from "@/types/database";

const TABS: { value: ListingStatus; label: string; icon: string }[] = [
  { value: "active", label: "Aktivní", icon: "🟢" },
  { value: "reserved", label: "Rezervované", icon: "📌" },
  { value: "sold", label: "Prodané", icon: "✅" },
  { value: "removed", label: "Odstraněné", icon: "🗑️" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  reserved: "#f59e0b",
  sold: "#ef4444",
  removed: "#6b7280",
};

function optimizeThumb(url: string): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat("?width=200&height=150&resize=contain&quality=75");
}

export default function MyListingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ListingStatus>("active");
  const [stats, setStats] = useState({ total: 0, sold: 0, views: 0 });

  const fetchListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      const all = (data as Listing[]) || [];
      setListings(all);

      // Calculate stats
      setStats({
        total: all.length,
        sold: all.filter((l) => l.status === "sold").length,
        views: all.reduce((sum, l) => sum + (l.view_count || 0), 0),
      });
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/prihlaseni");
      return;
    }
    if (user) fetchListings();
  }, [user, authLoading, router, fetchListings]);

  async function updateStatus(listingId: string, newStatus: ListingStatus) {
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", listingId);
      if (error) throw error;
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    }
  }

  const filteredListings = listings.filter((l) => l.status === activeTab);

  if (authLoading || !user) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>⏳ Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <Link
            href="/bazar"
            style={{
              color: "var(--text-dimmer)",
              textDecoration: "none",
              fontSize: "13px",
            }}
          >
            ← Zpět na bazar
          </Link>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
            <span style={{ color: "var(--text-primary)" }}>Moje </span>
            <span style={{ color: "var(--accent)" }}>inzeráty</span>
          </h1>
        </div>
        <Link
          href="/bazar/novy"
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + Přidat inzerát
        </Link>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <StatCard label="Celkem inzerátů" value={stats.total} icon="📋" />
        <StatCard label="Prodáno" value={stats.sold} icon="✅" />
        <StatCard label="Celkem zobrazení" value={stats.views} icon="👁" />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
          const count = listings.filter((l) => l.status === tab.value).length;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: isActive
                  ? `2px solid var(--accent)`
                  : "2px solid transparent",
                color: isActive ? "var(--accent)" : "var(--text-dimmer)",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab.icon} {tab.label}
              {count > 0 && (
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: isActive
                      ? "rgba(240,160,48,0.15)"
                      : "var(--bg-card)",
                    color: isActive ? "var(--accent)" : "var(--text-dimmer)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Listings */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            ⏳ Načítám...
          </p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            Žádné {TABS.find((t) => t.value === activeTab)?.label.toLowerCase()}{" "}
            inzeráty
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredListings.map((listing) => (
            <div
              key={listing.id}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              {/* Thumbnail */}
              <Link
                href={`/bazar/${listing.id}`}
                style={{
                  width: "64px",
                  height: "48px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  flexShrink: 0,
                  position: "relative",
                  background: "var(--bg-page)",
                }}
              >
                {listing.images && listing.images.length > 0 ? (
                  <Image
                    src={optimizeThumb(listing.images[0])}
                    alt={listing.title}
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="64px"
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                    }}
                  >
                    🚂
                  </div>
                )}
              </Link>

              {/* Info */}
              <Link
                href={`/bazar/${listing.id}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {listing.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-dimmer)",
                    display: "flex",
                    gap: "12px",
                    marginTop: "2px",
                  }}
                >
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {listing.price.toLocaleString("cs-CZ")} Kč
                  </span>
                  <span>👁 {listing.view_count}</span>
                  <span>{timeAgo(listing.created_at)}</span>
                </div>
              </Link>

              {/* Status dot */}
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: STATUS_COLORS[listing.status] || "#6b7280",
                  flexShrink: 0,
                }}
              />

              {/* Actions */}
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <Link
                  href={`/bazar/${listing.id}/upravit`}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-border)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                  title="Upravit"
                >
                  ✏️
                </Link>
                <Link
                  href={`/bazar/novy?copy=${listing.id}`}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    background: "rgba(59,130,246,0.1)",
                    color: "#3b82f6",
                    border: "1px solid rgba(59,130,246,0.3)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                  title="Vytvořit kopii"
                >
                  📋
                </Link>
                {listing.status === "active" && (
                  <button
                    onClick={() => updateStatus(listing.id, "sold")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: "rgba(34,197,94,0.1)",
                      color: "#22c55e",
                      border: "1px solid rgba(34,197,94,0.3)",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ✅
                  </button>
                )}
                {listing.status !== "removed" && (
                  <button
                    onClick={() => updateStatus(listing.id, "removed")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: "rgba(239,68,68,0.1)",
                      color: "#ef4444",
                      border: "1px solid rgba(239,68,68,0.3)",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "16px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "20px", marginBottom: "4px" }}>{icon}</div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--accent)",
          marginBottom: "4px",
        }}
      >
        {value.toLocaleString("cs-CZ")}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>
        {label}
      </div>
    </div>
  );
}
