"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import ListingCard from "@/components/Bazar/ListingCard";
import ListingFilters, { type FilterState } from "@/components/Bazar/ListingFilters";
import type { Listing } from "@/types/database";

export default function BazarPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    category: "",
    scales: [],
    condition: "",
    priceFrom: "",
    priceTo: "",
    sort: "newest",
  });

  const fetchListings = useCallback(async () => {
    try {
      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "active");

      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.scales.length > 0) {
        query = query.in("scale", filters.scales);
      }
      if (filters.condition) {
        query = query.eq("condition", filters.condition);
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
      } else {
        query = query.order("created_at", { ascending: false });
      }

      query = query.limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setListings((data as Listing[]) || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.scales, filters.condition, filters.priceFrom, filters.priceTo, filters.sort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Client-side text search
  const filtered = useMemo(() => {
    if (!filters.search.trim()) return listings;
    const q = filters.search.toLowerCase();
    return listings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.brand?.toLowerCase().includes(q) ||
        l.location?.toLowerCase().includes(q)
    );
  }, [listings, filters.search]);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
            <span style={{ color: "var(--text-primary)" }}>Modelářský </span>
            <span style={{ color: "var(--accent)" }}>bazar</span>
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
            Kupujte a prodávejte modely železnic, příslušenství a díly
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {user && (
            <>
              <Link
                href="/bazar/moje"
                style={{
                  padding: "10px 20px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "border-color 0.2s",
                }}
              >
                📋 Moje inzeráty
              </Link>
              <Link
                href="/bazar/zpravy"
                style={{
                  padding: "10px 20px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                💬 Zprávy
              </Link>
              <Link
                href="/bazar/transakce"
                style={{
                  padding: "10px 20px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                🛡️ Moje transakce
              </Link>
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
                  border: "none",
                }}
              >
                + Přidat inzerát
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Bezpečná platba banner */}
      <Link
        href="/bazar/bezpecna-platba"
        style={{ textDecoration: "none", display: "block", marginBottom: "24px" }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(240,160,48,0.12) 0%, rgba(34,197,94,0.10) 100%)",
            border: "1px solid rgba(240,160,48,0.25)",
            borderRadius: "14px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            cursor: "pointer",
            transition: "border-color 0.2s, transform 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(240,160,48,0.25)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ fontSize: "36px", flexShrink: 0 }}>🛡️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              Bezpečná platba — nakupujte bez rizika
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Peníze držíme v úschově, dokud nepotvrdíte, že je vše OK. Ochrana pro kupující i prodávající.
            </div>
          </div>
          <div style={{ color: "var(--accent)", fontWeight: 600, fontSize: "14px", flexShrink: 0, whiteSpace: "nowrap" }}>
            Jak to funguje →
          </div>
        </div>
      </Link>

      {/* Filters */}
      <ListingFilters
        filters={filters}
        onChange={setFilters}
        totalCount={filtered.length}
      />

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            Načítám inzeráty...
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
            Žádné inzeráty
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-dimmer)" }}>
            {filters.search || filters.category || filters.scales.length > 0
              ? "Zkuste změnit filtry nebo hledaný výraz"
              : "Zatím tu nejsou žádné inzeráty. Buďte první!"}
          </p>
          {user && (
            <Link
              href="/bazar/novy"
              style={{
                display: "inline-block",
                marginTop: "16px",
                padding: "12px 24px",
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
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      <div
        style={{
          marginTop: "48px",
          padding: "28px",
          borderRadius: "14px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "10px" }}>🛡️</div>
        <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Bojíte se podvodníků?
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", maxWidth: "500px", margin: "0 auto 16px", lineHeight: 1.6 }}>
          S Bezpečnou platbou kupujete bez rizika. Peníze uvolníme prodejci až když potvrdíte, že je vše v pořádku.
          Žádní podvodníci, žádné starosti.
        </p>
        <Link
          href="/bazar/bezpecna-platba"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Zjistit více o Bezpečné platbě →
        </Link>
      </div>
    </div>
  );
}
