"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { useWishlist } from "@/components/Shop/WishlistProvider";
import ProductCard from "@/components/Shop/ProductCard";
import type { ShopProduct } from "@/types/database";
import { getShopCategories, type ShopCategory } from "@/lib/shop-categories";

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { wishlistIds, loading: wishLoading } = useWishlist();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShopCategories().then(setCategories);
  }, []);

  useEffect(() => {
    async function loadProducts() {
      if (wishLoading) return;
      if (wishlistIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data } = await supabase
          .from("shop_products")
          .select("*")
          .in("id", wishlistIds)
          .eq("status", "active");
        setProducts((data as ShopProduct[]) || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [wishlistIds, wishLoading]);

  if (authLoading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>♥</div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Oblíbené produkty
        </h1>
        <p style={{ color: "var(--text-dimmer)", marginBottom: "24px" }}>
          Pro zobrazení oblíbených se nejdříve přihlaste.
        </p>
        <Link
          href="/prihlaseni"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Přihlásit se
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "24px", fontSize: "14px" }}>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none" }}>Shop</Link>
        <span style={{ color: "var(--text-dimmer)" }}>›</span>
        <span style={{ color: "var(--text-dim)" }}>Oblíbené</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "24px" }}>
        ♥ Oblíbené produkty
      </h1>

      {loading || wishLoading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)" }}>Načítám oblíbené...</p>
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>♡</div>
          <p style={{ fontSize: "16px", color: "var(--text-dimmer)", marginBottom: "16px" }}>
            Zatím nemáte žádné oblíbené produkty
          </p>
          <Link
            href="/shop"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            Prohlédnout shop
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} categories={categories} />
          ))}
        </div>
      )}

      <div style={{ height: "48px" }} />
    </div>
  );
}
