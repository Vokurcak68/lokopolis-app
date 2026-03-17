"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo, formatCzechDate } from "@/lib/timeAgo";
import ListingCard from "@/components/Bazar/ListingCard";
import MessageThread from "@/components/Bazar/MessageThread";
import EscrowBadge from "@/components/Escrow/EscrowBadge";
import type { Listing, Profile } from "@/types/database";

const CONDITION_LABELS: Record<string, string> = {
  new: "Nový",
  opened: "Rozbalený",
  used: "Použitý",
  parts: "Na díly",
};
const CONDITION_COLORS: Record<string, string> = {
  new: "#22c55e",
  opened: "#3b82f6",
  used: "#f59e0b",
  parts: "#ef4444",
};
const CATEGORY_LABELS: Record<string, string> = {
  lokomotivy: "🚂 Lokomotivy",
  vagony: "🚃 Vagóny",
  koleje: "🛤️ Koleje",
  prislusenstvi: "🔧 Příslušenství",
  budovy: "🏠 Budovy",
  elektronika: "⚡ Elektronika",
  literatura: "📚 Literatura",
  kolejiste: "🗺️ Kolejiště",
  ostatni: "📦 Ostatní",
};
const SCALE_COLORS: Record<string, string> = {
  TT: "#3b82f6",
  H0: "#22c55e",
  N: "#a855f7",
  Z: "#ec4899",
  G: "#f59e0b",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Aktivní",
  reserved: "Rezervováno",
  sold: "Prodáno",
  removed: "Odstraněno",
};

function optimizeImageUrl(url: string, width: number = 800): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat(`?width=${width}&height=${Math.round(width * 0.75)}&resize=contain&quality=85`);
}

function thumbUrl(url: string): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat("?width=150&height=112&resize=contain&quality=75");
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const listingId = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [sellerRating, setSellerRating] = useState<{ avg: number; count: number } | null>(null);
  const [similar, setSimilar] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [incomingUsers, setIncomingUsers] = useState<{ id: string; name: string; unread: number }[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string } | null>(null);
  const [escrowEnabled, setEscrowEnabled] = useState(true);
  const [escrowLoading, setEscrowLoading] = useState(false);

  const isOwner = user && listing && user.id === listing.seller_id;
  const isAdmin = profile?.role === "admin";

  const fetchListing = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (error || !data) {
        router.push("/bazar");
        return;
      }

      const l = data as Listing;
      setListing(l);

      // Fetch seller profile
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", l.seller_id)
        .single();
      setSeller(sellerData as Profile | null);

      // Escrow settings
      const { data: escrowSetting } = await supabase
        .from("escrow_settings")
        .select("value")
        .eq("key", "escrow_enabled")
        .maybeSingle();
      if (escrowSetting?.value) {
        setEscrowEnabled(escrowSetting.value === "true");
      }

      // Increment view count (fire and forget)
      supabase
        .from("listings")
        .update({ view_count: (l.view_count || 0) + 1 })
        .eq("id", listingId)
        .then();

      // Fetch seller rating
      const { data: ratingData } = await supabase.rpc("get_seller_rating", {
        p_seller_id: l.seller_id,
      });
      if (ratingData && ratingData.length > 0) {
        setSellerRating({
          avg: parseFloat(ratingData[0].avg_rating) || 0,
          count: parseInt(ratingData[0].review_count) || 0,
        });
      }

      // Fetch similar listings
      const { data: similarData } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .eq("category", l.category)
        .neq("id", listingId)
        .order("created_at", { ascending: false })
        .limit(4);
      setSimilar((similarData as Listing[]) || []);
    } catch {
      router.push("/bazar");
    } finally {
      setLoading(false);
    }
  }, [listingId, router]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  // Fetch incoming message senders for owner
  useEffect(() => {
    if (!user || !listing || user.id !== listing.seller_id) return;

    async function fetchIncoming() {
      const { data: msgs } = await supabase
        .from("bazar_messages")
        .select("sender_id, read")
        .eq("listing_id", listing!.id)
        .eq("recipient_id", user!.id);

      if (!msgs || msgs.length === 0) { setIncomingUsers([]); return; }

      // Group by sender
      const senderMap = new Map<string, number>();
      for (const m of msgs) {
        senderMap.set(m.sender_id, (senderMap.get(m.sender_id) || 0) + (!m.read ? 1 : 0));
      }

      const senderIds = [...senderMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", senderIds);

      const users = senderIds.map((sid) => {
        const p = (profiles || []).find((pr: { id: string }) => pr.id === sid);
        return {
          id: sid,
          name: (p as { display_name?: string; username?: string })?.display_name || (p as { username?: string })?.username || "Anonym",
          unread: senderMap.get(sid) || 0,
        };
      });

      setIncomingUsers(users);
    }

    fetchIncoming();
  }, [user, listing]);

  async function updateStatus(newStatus: string) {
    if (!listing) return;
    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", listing.id);
      if (error) throw error;
      setListing({ ...listing, status: newStatus as Listing["status"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleDelete() {
    if (!listing) return;
    if (!confirm("Opravdu chcete smazat tento inzerát?")) return;
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: "removed", updated_at: new Date().toISOString() })
        .eq("id", listing.id);
      if (error) throw error;
      router.push("/bazar/moje");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    }
  }

  async function handleCreateEscrow() {
    if (!listing) return;
    setEscrowLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listing_id: listing.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nepodařilo se vytvořit transakci");
      router.push(`/bazar/transakce/${data.transaction.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setEscrowLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám inzerát...</p>
      </div>
    );
  }

  if (!listing) return null;

  const images = listing.images || [];
  const canUseEscrow = Boolean(
    user && !isOwner && listing.status === "active" && escrowEnabled
    && listing.payment_methods?.includes("escrow")
  );

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontSize: "13px" }}>
        <Link href="/bazar" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>
          Bazar
        </Link>
        <span style={{ color: "var(--text-dimmer)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--text-muted)" }}>{listing.title}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "32px",
        }}
        className="listing-detail-grid"
      >
        {/* Left: Images */}
        <div>
          {/* Main image */}
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: "66%",
              borderRadius: "12px",
              overflow: "hidden",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              cursor: images.length > 0 ? "zoom-in" : "default",
              marginBottom: "12px",
            }}
            onClick={() => images.length > 0 && setLightbox(true)}
          >
            {images.length > 0 ? (
              <Image
                src={optimizeImageUrl(images[selectedImage])}
                alt={listing.title}
                fill
                style={{ objectFit: "contain" }}
                sizes="(max-width: 768px) 100vw, 600px"
                priority
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "64px",
                  color: "var(--text-dimmer)",
                }}
              >
                🚂
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
              {images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  style={{
                    width: "72px",
                    height: "54px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: `2px solid ${
                      i === selectedImage ? "var(--accent)" : "var(--border)"
                    }`,
                    cursor: "pointer",
                    position: "relative",
                    flexShrink: 0,
                    background: "var(--bg-page)",
                    padding: 0,
                  }}
                >
                  <Image
                    src={thumbUrl(url)}
                    alt={`Fotka ${i + 1}`}
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="72px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div>
          {/* Status badge */}
          {listing.status !== "active" && (
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "12px",
                background:
                  listing.status === "reserved"
                    ? "rgba(245,158,11,0.15)"
                    : listing.status === "sold"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(107,114,128,0.15)",
                color:
                  listing.status === "reserved"
                    ? "#f59e0b"
                    : listing.status === "sold"
                    ? "#ef4444"
                    : "#6b7280",
              }}
            >
              {STATUS_LABELS[listing.status]}
            </div>
          )}

          {/* Price */}
          <div
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "var(--accent)",
              marginBottom: "12px",
            }}
          >
            {listing.price.toLocaleString("cs-CZ")} Kč
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "16px",
              lineHeight: 1.3,
            }}
          >
            {listing.title}
          </h1>

          {/* Badges */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            {listing.scale && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: `${SCALE_COLORS[listing.scale] || "#6b7280"}20`,
                  color: SCALE_COLORS[listing.scale] || "#6b7280",
                  border: `1px solid ${SCALE_COLORS[listing.scale] || "#6b7280"}40`,
                }}
              >
                {listing.scale}
              </span>
            )}
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                background: `${CONDITION_COLORS[listing.condition]}20`,
                color: CONDITION_COLORS[listing.condition],
                border: `1px solid ${CONDITION_COLORS[listing.condition]}40`,
              }}
            >
              {CONDITION_LABELS[listing.condition]}
            </span>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                background: "var(--bg-card)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {CATEGORY_LABELS[listing.category] || listing.category}
            </span>
            {listing.brand && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "var(--bg-card)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                🏭 {listing.brand}
              </span>
            )}
            {listing.payment_methods?.includes("escrow") && escrowEnabled && <EscrowBadge size="md" />}
          </div>

          {/* Description */}
          {listing.description && (
            <div
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "10px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                Popis
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-body)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {listing.description}
              </p>
            </div>
          )}

          {/* Info grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <InfoItem label="Zaslání" value={listing.shipping ? "✅ Ano" : "❌ Ne"} />
            <InfoItem label="Osobní předání" value={listing.personal_pickup ? "✅ Ano" : "❌ Ne"} />
            {listing.payment_methods && listing.payment_methods.length > 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  gridColumn: "1 / -1",
                }}
              >
                <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginBottom: "4px" }}>
                  Způsoby platby
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-body)", fontWeight: 500 }}>
                  {[
                    listing.payment_methods.includes("cash") && "💵 Hotovost",
                    listing.payment_methods.includes("transfer") && "🏦 Převod",
                    listing.payment_methods.includes("cod") && "📦 Dobírka",
                    listing.payment_methods.includes("escrow") && "🛡️ Bezpečná platba",
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}
            {listing.location && (
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-dimmer)", display: "block", marginBottom: "2px" }}>Lokace</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px" }}
                >
                  📍 {listing.location} ↗
                </a>
              </div>
            )}
            <InfoItem label="Přidáno" value={formatCzechDate(listing.created_at)} />
            <InfoItem label="Zobrazení" value={`👁 ${listing.view_count}`} />
          </div>

          {/* Seller card */}
          {seller && (
            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--accent-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {seller.avatar_url ? (
                  <Image
                    src={seller.avatar_url}
                    alt={seller.display_name || seller.username}
                    width={48}
                    height={48}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  "👤"
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {seller.display_name || seller.username}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>
                  Členem od {formatCzechDate(seller.created_at)}
                  {sellerRating && sellerRating.count > 0 && (
                    <span style={{ marginLeft: "8px" }}>
                      ⭐ {sellerRating.avg.toFixed(1)} ({sellerRating.count}{" "}
                      {sellerRating.count === 1
                        ? "hodnocení"
                        : sellerRating.count < 5
                        ? "hodnocení"
                        : "hodnocení"}
                      )
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {isOwner || isAdmin ? (
              <>
                <Link
                  href={`/bazar/${listing.id}/upravit`}
                  style={{
                    padding: "12px 24px",
                    background: "var(--accent)",
                    color: "var(--accent-text-on)",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  ✏️ Upravit
                </Link>
                {listing.status === "active" && (
                  <button
                    onClick={() => updateStatus("reserved")}
                    disabled={statusUpdating}
                    style={{
                      padding: "12px 24px",
                      background: "rgba(245,158,11,0.15)",
                      color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,0.3)",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    📌 Rezervovat
                  </button>
                )}
                {(listing.status === "active" || listing.status === "reserved") && (
                  <button
                    onClick={() => updateStatus("sold")}
                    disabled={statusUpdating}
                    style={{
                      padding: "12px 24px",
                      background: "rgba(34,197,94,0.15)",
                      color: "#22c55e",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✅ Označit prodáno
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "12px 24px",
                    background: "rgba(239,68,68,0.1)",
                    color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🗑️ Smazat
                </button>
                <Link
                  href="/bazar/zpravy"
                  style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: "rgba(59,130,246,0.15)",
                    color: "#3b82f6",
                    border: "1px solid rgba(59,130,246,0.3)",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  💬 Zprávy
                </Link>
              </>
            ) : user ? (
              <>
                <button
                  onClick={() => setShowMessages(!showMessages)}
                  style={{
                    padding: "12px 24px",
                    background: "var(--accent)",
                    color: "var(--accent-text-on)",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📩 {showMessages ? "Skrýt zprávy" : "Napsat prodejci"}
                </button>
                {canUseEscrow && (
                  <>
                    <button
                      onClick={handleCreateEscrow}
                      disabled={escrowLoading}
                      style={{
                        padding: "12px 24px",
                        background: "rgba(34,197,94,0.15)",
                        color: "#22c55e",
                        border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: escrowLoading ? "not-allowed" : "pointer",
                        opacity: escrowLoading ? 0.7 : 1,
                      }}
                    >
                      🛡️ {escrowLoading ? "Vytvářím..." : "Koupit s Bezpečnou platbou"}
                    </button>
                    <Link
                      href="/bazar/bezpecna-platba"
                      style={{
                        fontSize: "12px",
                        color: "var(--text-dimmer)",
                        textDecoration: "none",
                        display: "block",
                        textAlign: "center",
                        marginTop: "6px",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dimmer)"; }}
                    >
                      Jak funguje bezpečná platba? →
                    </Link>
                  </>
                )}
              </>
            ) : (
              <Link
                href="/prihlaseni"
                style={{
                  padding: "12px 24px",
                  background: "var(--accent)",
                  color: "var(--accent-text-on)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                📩 Přihlaste se pro kontaktování prodejce
              </Link>
            )}
          </div>

          {/* Message thread — buyer → seller */}
          {showMessages && user && seller && !isOwner && (
            <div style={{ marginTop: "20px" }}>
              <MessageThread
                listingId={listing.id}
                recipientId={listing.seller_id}
                recipientName={seller.display_name || seller.username}
              />
            </div>
          )}

          {/* Incoming messages — seller sees buyers */}
          {isOwner && incomingUsers.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
                📩 Příchozí zprávy ({incomingUsers.length})
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                {incomingUsers.map((bu) => (
                  <button
                    key={bu.id}
                    onClick={() => setSelectedBuyer(selectedBuyer?.id === bu.id ? null : bu)}
                    style={{
                      padding: "8px 16px",
                      background: selectedBuyer?.id === bu.id ? "var(--accent)" : "var(--bg-card)",
                      color: selectedBuyer?.id === bu.id ? "var(--accent-text-on)" : "var(--text-primary)",
                      border: `1px solid ${selectedBuyer?.id === bu.id ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    👤 {bu.name}
                    {bu.unread > 0 && (
                      <span style={{
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: 700,
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {bu.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {selectedBuyer && (
                <MessageThread
                  listingId={listing.id}
                  recipientId={selectedBuyer.id}
                  recipientName={selectedBuyer.name}
                />
              )}
            </div>
          )}

          {isOwner && incomingUsers.length === 0 && (
            <div style={{ marginTop: "24px", textAlign: "center", padding: "24px", color: "var(--text-dimmer)", fontSize: "13px" }}>
              📩 Zatím žádné zprávy od zájemců
            </div>
          )}
        </div>
      </div>

      {/* Similar listings */}
      {similar.length > 0 && (
        <div style={{ marginTop: "48px" }}>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "20px",
            }}
          >
            Podobné inzeráty
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#fff",
              fontSize: "24px",
              cursor: "pointer",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage((prev) =>
                    prev === 0 ? images.length - 1 : prev - 1
                  );
                }}
                style={lightboxNavStyle}
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage((prev) =>
                    prev === images.length - 1 ? 0 : prev + 1
                  );
                }}
                style={{ ...lightboxNavStyle, left: "auto", right: "20px" }}
              >
                ›
              </button>
            </>
          )}
          <div
            style={{
              position: "relative",
              width: "90vw",
              height: "85vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={optimizeImageUrl(images[selectedImage], 1200)}
              alt={listing.title}
              fill
              style={{ objectFit: "contain" }}
              sizes="90vw"
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              color: "#fff",
              fontSize: "14px",
            }}
          >
            {selectedImage + 1} / {images.length}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .listing-detail-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "8px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-body)", fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

const lightboxNavStyle: React.CSSProperties = {
  position: "absolute",
  left: "20px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "#fff",
  fontSize: "36px",
  cursor: "pointer",
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1001,
};
