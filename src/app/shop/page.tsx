"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/Shop/ProductCard";
import ProductFilters, { type ShopFilterState } from "@/components/Shop/ProductFilters";
import type { ShopProduct } from "@/types/database";
import { getShopCategories, type ShopCategory } from "@/lib/shop-categories";

export default function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ShopFilterState>({
    search: "",
    category: "",
    scales: [],
    priceFrom: "",
    priceTo: "",
    freeOnly: false,
    sort: "newest",
  });

  const fetchProducts = useCallback(async () => {
    try {
      let query = supabase
        .from("shop_products")
        .select("*")
        .eq("status", "active");

      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.scales.length > 0) {
        query = query.in("scale", filters.scales);
      }
      if (filters.freeOnly) {
        query = query.eq("price", 0);
      }
      if (filters.priceFrom) {
        query = query.gte("price", parseInt(filters.priceFrom));
      }
      if (filters.priceTo) {
        query = query.lte("price", parseInt(filters.priceTo));
      }

      // Sort
      if (filters.sort === "cheapest") {
        query = query.order("price", { ascending: true });
      } else if (filters.sort === "expensive") {
        query = query.order("price", { ascending: false });
      } else if (filters.sort === "popular") {
        query = query.order("download_count", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      query = query.limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setProducts((data as ShopProduct[]) || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.scales, filters.freeOnly, filters.priceFrom, filters.priceTo, filters.sort]);

  useEffect(() => {
    getShopCategories().then(setCategories);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Client-side text search
  const filtered = useMemo(() => {
    if (!filters.search.trim()) return products;
    const q = filters.search.toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [products, filters.search]);

  const featured = filtered.filter((p) => p.featured);
  const regular = filtered.filter((p) => !p.featured);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
      {/* Hero banner */}
      <div
        style={{
          textAlign: "center",
          padding: "48px 20px 40px",
          marginBottom: "16px",
        }}
      >
        <h1 style={{ fontSize: "36px", fontWeight: 800, marginBottom: "10px" }}>
          <span style={{ color: "var(--text-primary)" }}>🛒 Lokopolis </span>
          <span style={{ color: "var(--accent)" }}>Shop</span>
        </h1>
        <p style={{ fontSize: "17px", color: "var(--text-dim)", maxWidth: "500px", margin: "0 auto" }}>
          Kolejové plány, 3D modely a návody pro modeláře
        </p>
      </div>

      {/* Category cards */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "32px",
          overflowX: "auto",
          paddingBottom: "4px",
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setFilters(f => ({ ...f, category: f.category === cat.slug ? "" : cat.slug }))}
            style={{
              flex: "0 0 auto",
              padding: "14px 24px",
              background: filters.category === cat.slug ? `${cat.color}20` : "var(--bg-card)",
              border: `1px solid ${filters.category === cat.slug ? cat.color : "var(--border)"}`,
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
              minWidth: "fit-content",
            }}
          >
            <span style={{ fontSize: "24px" }}>{cat.emoji}</span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: filters.category === cat.slug ? cat.color : "var(--text-body)",
              }}
            >
              {cat.name}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <ProductFilters
        filters={filters}
        onChange={setFilters}
        totalCount={filtered.length}
        categories={categories}
      />

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            Načítám produkty...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "8px",
            }}
          >
            Žádné produkty
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-dimmer)" }}>
            {filters.search || filters.category || filters.scales.length > 0 || filters.freeOnly
              ? "Zkuste změnit filtry nebo hledaný výraz"
              : "V obchodě zatím nejsou žádné produkty. Brzy přidáme!"}
          </p>
        </div>
      ) : (
        <>
          {/* Featured products */}
          {featured.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                ⭐ Doporučené
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: "20px",
                }}
              >
                {featured.map((product) => (
                  <ProductCard key={product.id} product={product} featured categories={categories} />
                ))}
              </div>
            </div>
          )}

          {/* All products */}
          {regular.length > 0 && (
            <div>
              {featured.length > 0 && (
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                  Všechny produkty
                </h2>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "16px",
                }}
              >
                {regular.map((product) => (
                  <ProductCard key={product.id} product={product} categories={categories} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ height: "48px" }} />
    </div>
  );
}
