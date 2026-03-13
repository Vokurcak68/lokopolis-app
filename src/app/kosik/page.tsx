"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/Shop/CartProvider";

export default function CartPage() {
  const { items, cartTotal, removeFromCart, updateQuantity, clearCart, loading } = useCart();
  const [couponCode, setCouponCode] = useState("");

  if (loading) {
    return (
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám košík...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>🛒</div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Váš košík je prázdný
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
          Přidejte si něco z našeho shopu!
        </p>
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "15px",
            textDecoration: "none",
          }}
        >
          Prohlédnout shop
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "32px" }}>
        🛒 Košík
      </h1>

      {/* Cart items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
        {items.map(({ product, quantity }) => {
          const isDigital = !!product.file_url;
          return (
            <div
              key={product.id}
              style={{
                display: "flex",
                gap: "16px",
                padding: "16px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                alignItems: "center",
              }}
            >
              {/* Image */}
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "var(--bg-header)",
                }}
              >
                {product.cover_image_url ? (
                  <img
                    src={product.cover_image_url}
                    alt={product.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                    }}
                  >
                    📦
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/shop/${product.slug}`}
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  {product.title}
                </Link>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {isDigital ? "📥 Digitální produkt" : "📦 Fyzický produkt"}
                </div>
              </div>

              {/* Quantity */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                {isDigital ? (
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>1×</span>
                ) : (
                  <>
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-header)",
                        color: "var(--text-primary)",
                        fontSize: "14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        minWidth: "24px",
                        textAlign: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-header)",
                        color: "var(--text-primary)",
                        fontSize: "14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                  </>
                )}
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: "80px" }}>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {product.price === 0 ? "Zdarma" : `${product.price * quantity} Kč`}
                </div>
                {quantity > 1 && product.price > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {product.price} Kč / ks
                  </div>
                )}
              </div>

              {/* Remove */}
              <button
                onClick={() => removeFromCart(product.id)}
                title="Odebrat"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "var(--text-muted)",
                  padding: "4px",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left: coupon + clear */}
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Slevový kód"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: "14px",
              }}
            />
            <button
              disabled={!couponCode.trim()}
              style={{
                padding: "10px 18px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--bg-header)",
                color: "var(--text-primary)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: couponCode.trim() ? "pointer" : "not-allowed",
                opacity: couponCode.trim() ? 1 : 0.5,
              }}
            >
              Uplatnit
            </button>
          </div>
          <button
            onClick={clearCart}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              fontSize: "13px",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            🗑️ Vyprázdnit košík
          </button>
        </div>

        {/* Right: summary */}
        <div
          style={{
            padding: "20px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "14px",
              color: "var(--text-muted)",
            }}
          >
            <span>Mezisoučet</span>
            <span>{cartTotal} Kč</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "16px",
              fontSize: "14px",
              color: "var(--text-muted)",
            }}
          >
            <span>Doprava</span>
            <span>Zvolíte v pokladně</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: "1px solid var(--border)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            <span>Celkem</span>
            <span>{cartTotal} Kč</span>
          </div>
          <Link
            href="/pokladna"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: "16px",
              padding: "14px 24px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "16px",
              textDecoration: "none",
            }}
          >
            Pokračovat k pokladně →
          </Link>
        </div>
      </div>

      {/* Responsive override for mobile */}
      <style>{`
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
