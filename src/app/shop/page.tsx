"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/Shop/ProductCard";
import ProductFilters, { type ShopFilterState } from "@/components/Shop/ProductFilters";
import type { ShopProduct } from "@/types/database";
import {
  getShopCategories,
  buildCategoryTree,
  getCategoryWithChildren,
  type ShopCategory,
  type ShopCategoryTreeNode,
} from "@/lib/shop-categories";

export default function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParent, setSelectedParent] = useState<string>("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [subcatsOpen, setSubcatsOpen] = useState(false);
  const [filters, setFilters] = useState<ShopFilterState>({
    search: "",
    category: "",
    scales: [],
    priceFrom: "",
    priceTo: "",
    freeOnly: false,
    sort: "newest",
  });

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Get children of selected parent
  const selectedParentNode = useMemo(
    () => tree.find((n) => n.slug === selectedParent),
    [tree, selectedParent]
  );
  const hasChildren = selectedParentNode && selectedParentNode.children.length > 0;

  // Determine the effective category filter slugs
  const effectiveCategorySlugs = useMemo(() => {
    if (selectedChild) {
      return [selectedChild];
    }
    if (selectedParent) {
      return getCategoryWithChildren(categories, selectedParent);
    }
    return [];
  }, [selectedParent, selectedChild, categories]);

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

  // Sync selectedParent/child to filters.category for ProductFilters compatibility
  useEffect(() => {
    const cat = selectedChild || selectedParent;
    if (cat !== filters.category) {
      setFilters((f) => ({ ...f, category: cat }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParent, selectedChild]);

  function handleParentClick(slug: string) {
    if (selectedParent === slug) {
      // Deselect
      setSelectedParent("");
      setSelectedChild("");
      setSubcatsOpen(false);
    } else {
      setSelectedParent(slug);
      setSelectedChild("");
      const node = tree.find((n) => n.slug === slug);
      setSubcatsOpen(!!node && node.children.length > 0);
    }
  }

  function handleChildClick(slug: string) {
    setSelectedChild(selectedChild === slug ? "" : slug);
  }

  // Handle filter changes from ProductFilters (category select)
  function handleFiltersChange(newFilters: ShopFilterState) {
    if (newFilters.category !== filters.category) {
      // Find if it's a parent or child
      const cat = categories.find((c) => c.slug === newFilters.category);
      if (!cat) {
        setSelectedParent("");
        setSelectedChild("");
        setSubcatsOpen(false);
      } else if (!cat.parent_id) {
        setSelectedParent(cat.slug);
        setSelectedChild("");
        const node = tree.find((n) => n.slug === cat.slug);
        setSubcatsOpen(!!node && node.children.length > 0);
      } else {
        const parent = categories.find((c) => c.id === cat.parent_id);
        if (parent) {
          setSelectedParent(parent.slug);
          setSubcatsOpen(true);
        }
        setSelectedChild(cat.slug);
      }
    }
    setFilters(newFilters);
  }

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

      {/* Parent category cards — horizontal scrollable strip */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: subcatsOpen && hasChildren ? "0" : "32px",
          overflowX: "auto",
          paddingBottom: "4px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tree.map((cat) => {
          const isActive = selectedParent === cat.slug;
          return (
            <button
              key={cat.slug}
              onClick={() => handleParentClick(cat.slug)}
              style={{
                flex: "0 0 auto",
                padding: "14px 24px",
                background: isActive ? `${cat.color}20` : "var(--bg-card)",
                border: `1px solid ${isActive ? cat.color : "var(--border)"}`,
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
                  color: isActive ? cat.color : "var(--text-body)",
                }}
              >
                {cat.name}
              </span>
              {cat.children.length > 0 && (
                <span
                  style={{
                    fontSize: "10px",
                    color: isActive ? cat.color : "var(--text-dimmer)",
                    transition: "transform 0.2s",
                    transform: isActive && subcatsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  ▼
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Subcategory chips — animated expand */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: subcatsOpen && hasChildren ? "100px" : "0",
          opacity: subcatsOpen && hasChildren ? 1 : 0,
          transition: "max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease",
          marginBottom: subcatsOpen && hasChildren ? "32px" : "0",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "12px 0 4px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* "Vše" chip */}
          <button
            onClick={() => setSelectedChild("")}
            style={{
              flex: "0 0 auto",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${!selectedChild ? (selectedParentNode?.color || "var(--accent)") : "var(--border)"}`,
              background: !selectedChild
                ? `${selectedParentNode?.color || "var(--accent)"}20`
                : "var(--bg-card)",
              color: !selectedChild
                ? (selectedParentNode?.color || "var(--accent)")
                : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            Vše
          </button>
          {selectedParentNode?.children.map((child) => {
            const isActive = selectedChild === child.slug;
            return (
              <button
                key={child.slug}
                onClick={() => handleChildClick(child.slug)}
                style={{
                  flex: "0 0 auto",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${isActive ? child.color : "var(--border)"}`,
                  background: isActive ? `${child.color}20` : "var(--bg-card)",
                  color: isActive ? child.color : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {child.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <ProductFilters
        filters={filters}
        onChange={handleFiltersChange}
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
            {filters.search || selectedParent || filters.scales.length > 0 || filters.freeOnly
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
