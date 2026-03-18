"use client";

import Link from "next/link";
import Image from "next/image";
import { timeAgo } from "@/lib/timeAgo";
import { getImageVariant } from "@/lib/image-variants";
import EscrowBadge from "@/components/Escrow/EscrowBadge";
import type { Listing } from "@/types/database";

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

const SCALE_COLORS: Record<string, string> = {
  TT: "#3b82f6",
  H0: "#22c55e",
  N: "#a855f7",
  Z: "#ec4899",
  G: "#f59e0b",
};


interface ListingCardProps {
  listing: Listing;
  compact?: boolean;
}

export default function ListingCard({ listing, compact }: ListingCardProps) {
  const firstImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;

  return (
    <Link href={`/bazar/${listing.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          overflow: "hidden",
          transition: "all 0.2s",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(240, 160, 48, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Image */}
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56%", // 16:9 compact ratio
            background: "var(--bg-page)",
            overflow: "hidden",
          }}
        >
          {firstImage ? (
            <Image
              src={getImageVariant(firstImage, "card")}
              alt={listing.title}
              fill
              style={{ objectFit: "contain" }}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                color: "var(--text-dimmer)",
              }}
            >
              🚂
            </div>
          )}
          {/* Status badge for non-active */}
          {listing.status !== "active" && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                padding: "3px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600,
                background:
                  listing.status === "reserved"
                    ? "rgba(245,158,11,0.9)"
                    : listing.status === "sold"
                    ? "rgba(239,68,68,0.9)"
                    : "rgba(107,114,128,0.9)",
                color: "#fff",
              }}
            >
              {listing.status === "reserved"
                ? "Rezervováno"
                : listing.status === "sold"
                ? "Prodáno"
                : "Odstraněno"}
            </div>
          )}
          {/* Image count */}
          {listing.images && listing.images.length > 1 && (
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            >
              📷 {listing.images.length}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: compact ? "10px" : "12px", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Price */}
          <div
            style={{
              fontSize: compact ? "16px" : "18px",
              fontWeight: 700,
              color: "var(--accent)",
              marginBottom: "6px",
            }}
          >
            {listing.price.toLocaleString("cs-CZ")} Kč
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: compact ? "13px" : "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "8px",
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              flex: 1,
            }}
          >
            {listing.title}
          </h3>

          {/* Badges */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {listing.scale && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
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
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                background: `${CONDITION_COLORS[listing.condition]}20`,
                color: CONDITION_COLORS[listing.condition],
                border: `1px solid ${CONDITION_COLORS[listing.condition]}40`,
              }}
            >
              {CONDITION_LABELS[listing.condition]}
            </span>
            {listing.status === "active" && listing.payment_methods?.includes("escrow") && <EscrowBadge size="sm" />}
          </div>

          {/* Location + Date */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--text-dimmer)",
            }}
          >
            {listing.location && (
              <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                📍 {listing.location}
              </span>
            )}
            <span>{timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
