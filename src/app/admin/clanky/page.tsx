"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  verified: boolean;
  published_at: string | null;
  created_at: string;
  author: { username: string; display_name: string | null } | null;
  category: { name: string; icon: string | null } | null;
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<"pending" | "verified" | "all">("pending");

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/prihlaseni");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/");
        return;
      }
      setIsAdmin(true);
    }
    checkAdmin();
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchArticles();
  }, [isAdmin, filter]);

  async function fetchArticles() {
    setLoading(true);
    let query = supabase
      .from("articles")
      .select("id, title, slug, excerpt, status, verified, published_at, created_at, author:profiles(username, display_name), category:categories(name, icon)")
      .order("created_at", { ascending: false });

    if (filter === "pending") {
      query = query.eq("verified", false);
    } else if (filter === "verified") {
      query = query.eq("verified", true);
    }

    const { data } = await query;
    if (data) setArticles(data as unknown as Article[]);
    setLoading(false);
  }

  async function toggleVerified(id: string, current: boolean) {
    const { error } = await supabase
      .from("articles")
      .update({ verified: !current })
      .eq("id", id);

    if (!error) {
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, verified: !current } : a))
      );
    }
  }

  async function deleteArticle(id: string, title: string) {
    if (!confirm(`Smazat článek "${title}"?`)) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (!error) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-text-muted">Ověřuji přístup…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">🛡️ Správa článků</h1>
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Zpět na web
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "pending", label: "Čekající", icon: "⏳" },
          { key: "verified", label: "Schválené", icon: "✅" },
          { key: "all", label: "Vše", icon: "📋" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key
                ? "bg-primary/20 text-primary"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">
            {filter === "pending" ? "🎉" : "📭"}
          </div>
          <p className="text-gray-400">
            {filter === "pending"
              ? "Žádné články nečekají na schválení"
              : "Žádné články k zobrazení"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div
              key={article.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#12141f] border border-white/5 hover:border-white/10 transition-all"
            >
              {/* Status indicator */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  article.verified ? "bg-green-400" : "bg-yellow-400"
                }`}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {article.category && (
                    <span className="text-xs text-primary">
                      {article.category.icon} {article.category.name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    article.status === "published"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}>
                    {article.status === "published" ? "Publikováno" : "Koncept"}
                  </span>
                </div>
                <h3 className="text-white font-medium truncate">{article.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>✍️ {article.author?.display_name || article.author?.username || "?"}</span>
                  <span>{formatDate(article.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleVerified(article.id, article.verified)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    article.verified
                      ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                      : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  }`}
                >
                  {article.verified ? "Zrušit ✕" : "Schválit ✓"}
                </button>
                <Link
                  href={`/clanky/${article.slug}`}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                >
                  Zobrazit
                </Link>
                <button
                  onClick={() => deleteArticle(article.id, article.title)}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 transition-all"
                >
                  Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
