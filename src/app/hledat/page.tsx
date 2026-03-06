"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author: { display_name: string | null; username: string | null } | null;
  category: { name: string; icon: string; slug: string } | null;
}

function highlightMatch(text: string, query: string, maxLen = 200): string {
  if (!text) return "";
  const plain = text.replace(/<[^>]*>/g, "");
  const lower = plain.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());

  if (idx === -1) {
    return plain.slice(0, maxLen) + (plain.length > maxLen ? "…" : "");
  }

  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + query.length + 140);
  const snippet = (start > 0 ? "…" : "") + plain.slice(start, end) + (end < plain.length ? "…" : "");
  return snippet;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "64px 0", color: "#6a6e80" }}>Načítání…</div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [inputValue, setInputValue] = useState(query);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;

    setLoading(true);
    setSearched(false);

    try {
      // Search in title, excerpt, and content using ilike
      const searchTerm = `%${q.trim()}%`;

      const { data } = await supabase
        .from("articles")
        .select("id, slug, title, excerpt, content, cover_image_url, published_at, author:profiles(display_name, username), category:categories(name, icon, slug)")
        .eq("status", "published")
        .eq("verified", true)
        .or(`title.ilike.${searchTerm},excerpt.ilike.${searchTerm},content.ilike.${searchTerm}`)
        .order("published_at", { ascending: false })
        .limit(20);

      setResults((data as unknown as SearchResult[]) || []);
    } catch {
      setResults([]);
    }

    setLoading(false);
    setSearched(true);
  }, []);

  useEffect(() => {
    setInputValue(query);
    if (query) doSearch(query);
  }, [query, doSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = inputValue.trim();
    if (q) {
      router.push(`/hledat?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Search form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          background: "#1e2233",
          border: "1px solid #2a2f45",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "32px",
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Hledej články, modely, kolejové plány..."
          autoFocus
          style={{
            flex: 1,
            padding: "14px 20px",
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: "16px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "14px 28px",
            background: "#f0a030",
            border: "none",
            color: "#0f1117",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Hledat
        </button>
      </form>

      {/* Results header */}
      {searched && (
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
            {results.length > 0
              ? `Nalezeno ${results.length} ${results.length === 1 ? "výsledek" : results.length < 5 ? "výsledky" : "výsledků"}`
              : "Nic nenalezeno"
            }
          </h1>
          <p style={{ fontSize: "14px", color: "#6a6e80" }}>
            {results.length > 0
              ? `Výsledky pro „${query}"`
              : `Pro „${query}" jsme nenašli žádné články. Zkuste jiný výraz.`
            }
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div className="animate-pulse" style={{ color: "#6a6e80", fontSize: "15px" }}>Hledám…</div>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {results.map((r) => {
            const authorName = r.author?.display_name || r.author?.username || "Anonym";
            const date = r.published_at
              ? new Date(r.published_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
              : "";
            const snippet = r.excerpt || highlightMatch(r.content || "", query);

            return (
              <Link key={r.id} href={`/clanky/${r.slug}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    padding: "16px",
                    background: "#161822",
                    border: "1px solid #1e2233",
                    borderRadius: "12px",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f0a030")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e2233")}
                >
                  {/* Cover thumbnail */}
                  {r.cover_image_url && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={r.cover_image_url}
                        alt=""
                        style={{
                          width: "120px",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Category badge */}
                    {r.category && (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#f0a030",
                          background: "rgba(240,160,48,0.1)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          marginBottom: "6px",
                        }}
                      >
                        {r.category.icon} {r.category.name}
                      </span>
                    )}

                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "6px", lineHeight: 1.4 }}>
                      {r.title}
                    </h3>

                    <p style={{ fontSize: "13px", color: "#8a8ea0", lineHeight: 1.5, marginBottom: "8px" }}>
                      {snippet}
                    </p>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", color: "#555a70" }}>
                      <span>{authorName}</span>
                      {date && <span>· {date}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* No query yet */}
      {!searched && !loading && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
          <p style={{ fontSize: "16px", color: "#6a6e80" }}>Zadejte hledaný výraz</p>
        </div>
      )}
    </div>
  );
}
