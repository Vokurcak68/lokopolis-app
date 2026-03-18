"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/Shop/ProductCard";
import ProductFilters, { type ShopFilterState } from "@/components/Shop/ProductFilters";
import type { ShopProduct } from "@/types/database";
import {
  getShopCategories,
  getCategoryWithChildren,
  type ShopCategory,
} from "@/lib/shop-categories";

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

  // Determine the effective category filter slugs (includes children)
  const effectiveCategorySlugs = useMemo(() => {
    if (filters.category) {
      return getCategoryWithChildren(categories, filters.category);
    }
    return [];
  }, [filters.category, categories]);

  const fetchProducts = useCallback(async () => {
    try {
      let query = supabase
        .from("shop_products")
        .select("*")
        .eq("status", "active");

      // Category filter — use .in() for multiple slugs
      if (effectiveCategorySlugs.length === 1) {
        query = query.eq("category", effectiveCategorySlugs[0]);
      } else if (effectiveCategorySlugs.length > 1) {
        query = query.in("category", effectiveCategorySlugs);
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
  }, [effectiveCategorySlugs, filters.scales, filters.freeOnly, filters.priceFrom, filters.priceTo, filters.sort]);

  useEffect(() => {
    getShopCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
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
          padding: "28px 20px 20px",
          marginBottom: "12px",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "6px" }}>
          <span style={{ color: "var(--text-primary)" }}>🛒 Lokopolis </span>
          <span style={{ color: "var(--accent)" }}>Shop</span>
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-dim)", maxWidth: "500px", margin: "0 auto" }}>
          Kolejové plány, 3D modely a návody pro modeláře
        </p>
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "16px",
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "14px",
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
