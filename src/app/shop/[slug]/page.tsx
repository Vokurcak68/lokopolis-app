"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import ProductCard from "@/components/Shop/ProductCard";
import OrderModal from "@/components/Shop/OrderModal";
import { useCart } from "@/components/Shop/CartProvider";
import type { ShopProduct, ProductAttachment } from "@/types/database";
import { getShopCategories, type ShopCategory } from "@/lib/shop-categories";
import { getImageVariant } from "@/lib/image-variants";
import ProductReviews from "@/components/Shop/ProductReviews";
import WishlistButton from "@/components/Shop/WishlistButton";
import { getStockLabel } from "@/lib/inventory";

const SCALE_COLORS: Record<string, string> = {
  TT: "#3b82f6",
  H0: "#22c55e",
  N: "#a855f7",
  universal: "#6b7280",
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function ShopProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = params.slug as string;

  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPurchase, setHasPurchase] = useState(false);
  const [similar, setSimilar] = useState<ShopProduct[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [attachments, setAttachments] = useState<ProductAttachment[]>([]);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const { addToCart, items: cartItems } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);

  const fetchProduct = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

      if (error || !data) {
        router.push("/shop");
        return;
      }

      const p = data as ShopProduct;
      setProduct(p);

      // Check purchase status
      if (user) {
        const { data: purchaseData } = await supabase
          .from("user_purchases")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", p.id)
          .maybeSingle();

        setHasPurchase(!!purchaseData);
      }

      // Fetch similar products
      const { data: sim } = await supabase
        .from("shop_products")
        .select("*")
        .eq("status", "active")
        .eq("category", p.category)
        .neq("id", p.id)
        .limit(3);

      setSimilar((sim as ShopProduct[]) || []);

      // Fetch attachments
      const { data: attData } = await supabase
        .from("product_attachments")
        .select("*")
        .eq("product_id", p.id)
        .order("sort_order", { ascending: true });
      setAttachments((attData as ProductAttachment[]) || []);
    } catch {
      router.push("/shop");
    } finally {
      setLoading(false);
    }
  }, [slug, user, router]);

  useEffect(() => {
    getShopCategories().then(setCategories);
    fetchProduct();
  }, [fetchProduct]);

  const allImages = product
    ? [
        ...(product.cover_image_url ? [product.cover_image_url] : []),
        ...(product.preview_images || []),
      ]
    : [];

  async function handleDownload() {
    if (!product || !user) return;
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/shop/download?productId=${product.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Chyba při stahování");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      alert("Chyba při stahování");
    } finally {
      setDownloading(false);
    }
  }

  async function handleFreeDownload() {
    if (!product) return;
    setDownloading(true);
    try {
      // For free products, just download directly — no order or login needed
      const { data: { session: dlSession } } = await supabase.auth.getSession();
      const dlRes = await fetch(`/api/shop/download?productId=${product.id}`, {
        headers: dlSession?.access_token ? { Authorization: `Bearer ${dlSession.access_token}` } : {},
      });
      if (!dlRes.ok) {
        const data = await dlRes.json();
        alert(data.error || "Chyba při stahování");
        return;
      }
      const data = await dlRes.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
      setHasPurchase(true);
    } catch {
      alert("Chyba při stahování");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám produkt...</p>
      </div>
    );
  }

  if (!product) return null;

  const isFree = product.price === 0;
  const hasDiscount = product.original_price && product.original_price > product.price;
  const cat = categories.find((c) => c.slug === product.category);
  const catColor = cat?.color || "#6b7280";
  const catLabel = cat ? `${cat.emoji} ${cat.name}` : product.category;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "24px", fontSize: "14px" }}>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none" }}>Shop</Link>
        <span style={{ color: "var(--text-dimmer)" }}>›</span>
        <span style={{ color: "var(--text-dim)" }}>{product.title}</span>
      </div>

      {/* Main layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
        }}
        className="shop-detail-grid"
      >
        {/* Left: Images */}
        <div>
          {/* Main image */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "400px",
              borderRadius: "12px",
              overflow: "hidden",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              marginBottom: "12px",
            }}
          >
            {allImages.length > 0 ? (
              <Image
                src={getImageVariant(allImages[selectedImage], "full")}
                alt={product.title}
                fill
                style={{ objectFit: "contain" }}
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px", color: "var(--text-dimmer)" }}>
                {product.category === "kolejovy-plan" ? "📐" :
                 product.category === "stl-model" ? "🧊" :
                 product.category === "navod" ? "📖" :
                 product.category === "ebook" ? "📖" : "📦"}
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  style={{
                    width: "64px",
                    height: "48px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: i === selectedImage ? "2px solid var(--accent)" : "1px solid var(--border)",
                    cursor: "pointer",
                    position: "relative",
                    padding: 0,
                    background: "var(--bg-card)",
                  }}
                >
                  <Image src={getImageVariant(img, "thumb")} alt="" fill style={{ objectFit: "cover" }} sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div>
          {/* Category */}
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              background: `${catColor}20`,
              color: catColor,
              marginBottom: "12px",
            }}
          >
            {catLabel}
          </span>

          {/* Title */}
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px", lineHeight: 1.3 }}>
            {product.title}
          </h1>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "20px" }}>
            <span
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: isFree ? "#22c55e" : "var(--accent)",
              }}
            >
              {isFree ? "Zdarma" : `${product.price.toLocaleString("cs-CZ")} Kč`}
            </span>
            {hasDiscount && (
              <span
                style={{
                  fontSize: "18px",
                  color: "var(--text-dimmer)",
                  textDecoration: "line-through",
                }}
              >
                {product.original_price!.toLocaleString("cs-CZ")} Kč
              </span>
            )}
            {hasDiscount && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "rgba(239,68,68,0.15)",
                  color: "#ef4444",
                }}
              >
                −{Math.round((1 - product.price / product.original_price!) * 100)}%
              </span>
            )}
          </div>

          {/* Stock badge */}
          {(() => {
            const stock = getStockLabel(product.stock_mode, product.stock_quantity, product.stock_reserved, product.stock_alert_threshold);
            return (
              <div style={{ marginBottom: "16px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: `${stock.color}18`,
                    color: stock.color,
                    border: `1px solid ${stock.color}40`,
                  }}
                >
                  <span style={{ fontSize: "10px" }}>●</span>
                  {stock.label}
                </span>
              </div>
            );
          })()}

          {/* Badges */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            {product.scale && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: `${SCALE_COLORS[product.scale] || "#6b7280"}20`,
                  color: SCALE_COLORS[product.scale] || "#6b7280",
                  border: `1px solid ${SCALE_COLORS[product.scale] || "#6b7280"}40`,
                }}
              >
                Měřítko: {product.scale}
              </span>
            )}
            {product.file_type && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "var(--bg-page)",
                  color: "var(--text-dimmer)",
                  border: "1px solid var(--border)",
                }}
              >
                {product.file_type.toUpperCase()}
              </span>
            )}
            {product.file_size && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "var(--bg-page)",
                  color: "var(--text-dimmer)",
                  border: "1px solid var(--border)",
                }}
              >
                {formatSize(product.file_size)}
              </span>
            )}
          </div>

          {/* Short description */}
          {product.description && (
            <p style={{ fontSize: "15px", color: "var(--text-dim)", lineHeight: 1.6, marginBottom: "24px" }}>
              {product.description}
            </p>
          )}

          {/* Action button */}
          <div style={{ marginBottom: "24px" }}>
            {isFree ? (
              <button
                onClick={handleFreeDownload}
                disabled={downloading}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: downloading ? "var(--border)" : "#22c55e",
                  border: "none",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: downloading ? "not-allowed" : "pointer",
                }}
              >
                {downloading ? "Stahuji..." : "📥 Stáhnout zdarma"}
              </button>
            ) : hasPurchase ? (
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: downloading ? "var(--border)" : "var(--accent)",
                  border: "none",
                  borderRadius: "10px",
                  color: "var(--accent-text-on)",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: downloading ? "not-allowed" : "pointer",
                }}
              >
                {downloading ? "Stahuji..." : "📥 Stáhnout"}
              </button>
            ) : orderSuccess ? (
              <div
                style={{
                  padding: "14px 24px",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#22c55e" }}>
                  ✅ Objednávka {orderSuccess} vytvořena
                </span>
                <p style={{ fontSize: "13px", color: "var(--text-dim)", marginTop: "4px" }}>
                  Po potvrzení platby vám odemkneme stažení
                </p>
              </div>
            ) : (() => {
              const isInCart = cartItems.some((ci) => ci.product.id === product.id);
              const isDigital = !!product.file_url;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    onClick={() => {
                      if (isInCart && isDigital) return;
                      addToCart(product);
                      setAddedToCart(true);
                      setTimeout(() => setAddedToCart(false), 2000);
                    }}
                    disabled={isInCart && isDigital}
                    style={{
                      width: "100%",
                      padding: "14px 24px",
                      background: addedToCart ? "#22c55e" : isInCart && isDigital ? "var(--border)" : "var(--accent)",
                      border: "none",
                      borderRadius: "10px",
                      color: addedToCart ? "#fff" : "var(--accent-text-on)",
                      fontSize: "16px",
                      fontWeight: 700,
                      cursor: isInCart && isDigital ? "default" : "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {addedToCart ? "✓ Přidáno do košíku" : isInCart ? "✓ V košíku" : `🛒 Do košíku · ${product.price.toLocaleString("cs-CZ")} Kč`}
                  </button>
                  {isInCart && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Link
                        href="/shop"
                        style={{
                          flex: 1,
                          display: "block",
                          textAlign: "center",
                          padding: "10px",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        ← Pokračovat v nákupu
                      </Link>
                      <Link
                        href="/kosik"
                        style={{
                          flex: 1,
                          display: "block",
                          textAlign: "center",
                          padding: "10px",
                          border: "1px solid var(--accent)",
                          borderRadius: "10px",
                          color: "var(--accent)",
                          textDecoration: "none",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        Přejít do košíku →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Wishlist button */}
          <div style={{ marginBottom: "16px" }}>
            <WishlistButton productId={product.id} size="large" />
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>Stažení</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                {product.download_count}×
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>Přidáno</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                {new Date(product.created_at).toLocaleDateString("cs-CZ", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div style={{ marginTop: "20px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border-strong)",
                    color: "var(--accent)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Long description */}
      {product.long_description && (
        <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            Podrobný popis
          </h2>
          <div
            style={{
              fontSize: "15px",
              color: "var(--text-body)",
              lineHeight: 1.8,
              maxWidth: "800px",
            }}
            dangerouslySetInnerHTML={{ __html: product.long_description }}
          />
        </div>
      )}

      {/* Attachments - Ke stažení */}
      {attachments.length > 0 && (
        <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            📎 Ke stažení
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {attachments.map((att) => (
              <a
                key={att.id}
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.file_name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  textDecoration: "none",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <span style={{ fontSize: "24px" }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{att.title}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "2px" }}>
                    {att.file_name}
                    {att.file_size ? ` · ${att.file_size > 1048576 ? (att.file_size / 1048576).toFixed(1) + " MB" : (att.file_size / 1024).toFixed(0) + " KB"}` : ""}
                    {att.file_type ? ` · ${att.file_type.toUpperCase()}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>⬇ Stáhnout</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Reviews section */}
      <ProductReviews
        productId={product.id}
        avgRating={product.avg_rating || 0}
        reviewCount={product.review_count || 0}
      />

      {/* Similar products */}
      {similar.length > 0 && (
        <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            Související produkty
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} categories={categories} />
            ))}
          </div>
        </div>
      )}

      {/* Responsive grid style */}
      <style>{`
        @media (max-width: 768px) {
          .shop-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Order modal */}
      {showOrderModal && product && (
        <OrderModal
          product={product}
          onClose={() => setShowOrderModal(false)}
          onSuccess={(orderNum) => {
            setShowOrderModal(false);
            setOrderSuccess(orderNum);
          }}
        />
      )}

      <div style={{ height: "48px" }} />
    </div>
  );
}
