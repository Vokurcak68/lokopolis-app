"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ShopProduct } from "@/types/database";
import { type ShopCategory, getFullCategoryLabel, getCategoryColor } from "@/lib/shop-categories";
import { useCart } from "./CartProvider";

const SCALE_COLORS: Record<string, string> = {
  TT: "#3b82f6",
  H0: "#22c55e",
  N: "#a855f7",
  universal: "#6b7280",
};

function optimizeImageUrl(url: string, width: number = 400): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat(`?width=${width}&quality=75`);
}

interface ProductCardProps {
  product: ShopProduct;
  featured?: boolean;
  categories?: ShopCategory[];
}

export default function ProductCard({ product, featured, categories = [] }: ProductCardProps) {
  const cat = categories.find((c) => c.slug === product.category);
  const catColor = getCategoryColor(categories, product.category);
  const catLabel = getFullCategoryLabel(categories, product.category);
  const isFree = product.price === 0;
  const hasDiscount = product.original_price && product.original_price > product.price;
  const { addToCart, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.some((i) => i.product.id === product.id);

  return (
    <Link href={`/shop/${product.slug}`} style={{ textDecoration: "none" }}>
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
            paddingBottom: "75%",
            background: "var(--bg-page)",
            overflow: "hidden",
          }}
        >
          {product.cover_image_url ? (
            <Image
              src={optimizeImageUrl(product.cover_image_url)}
              alt={product.title}
              fill
              style={{ objectFit: "cover" }}
              sizes={featured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "48px",
                color: "var(--text-dimmer)",
              }}
            >
              {cat?.emoji || "📦"}
            </div>
          )}

          {/* Category badge */}
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              padding: "3px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              background: `${catColor}dd`,
              color: "#fff",
              maxWidth: "calc(100% - 16px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {catLabel}
          </div>

          {/* Free badge */}
          {isFree && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                padding: "3px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                background: "rgba(34, 197, 94, 0.9)",
                color: "#fff",
              }}
            >
              ZDARMA
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: featured ? "20px" : "16px", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Price */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: featured ? "24px" : "20px",
                fontWeight: 700,
                color: isFree ? "#22c55e" : "var(--accent)",
              }}
            >
              {isFree ? "Zdarma" : `${product.price.toLocaleString("cs-CZ")} Kč`}
            </span>
            {hasDiscount && (
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--text-dimmer)",
                  textDecoration: "line-through",
                }}
              >
                {product.original_price!.toLocaleString("cs-CZ")} Kč
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: featured ? "16px" : "15px",
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
            {product.title}
          </h3>

          {/* Description (featured only) */}
          {featured && product.description && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-dim)",
                lineHeight: 1.5,
                marginBottom: "12px",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {product.description}
            </p>
          )}

          {/* Badges */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {product.scale && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: `${SCALE_COLORS[product.scale] || "#6b7280"}20`,
                  color: SCALE_COLORS[product.scale] || "#6b7280",
                  border: `1px solid ${SCALE_COLORS[product.scale] || "#6b7280"}40`,
                }}
              >
                {product.scale}
              </span>
            )}
            {product.file_type && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "var(--bg-page)",
                  color: "var(--text-dimmer)",
                  border: "1px solid var(--border)",
                }}
              >
                {product.file_type.toUpperCase()}
              </span>
            )}
          </div>

          {/* Downloads + Date */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--text-dimmer)",
              marginBottom: "10px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              ⬇️ {product.download_count}× staženo
            </span>
          </div>

          {/* Add to cart button */}
          {!isFree && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!inCart && !added) {
                  addToCart(product);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1500);
                }
              }}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: inCart ? "default" : "pointer",
                background: added
                  ? "rgba(34, 197, 94, 0.15)"
                  : inCart
                  ? "var(--bg-page)"
                  : "var(--accent)",
                color: added
                  ? "#22c55e"
                  : inCart
                  ? "var(--text-muted)"
                  : "var(--accent-text-on)",
                transition: "all 0.2s",
              }}
            >
              {added ? "✓ Přidáno" : inCart ? "V košíku" : "🛒 Do košíku"}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
