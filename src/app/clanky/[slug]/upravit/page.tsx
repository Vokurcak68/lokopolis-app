"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArticleEditor } from "@/components/Editor";
import type { Category } from "@/types/database";
import "@/components/Editor/editor.css";

export default function EditArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/prihlaseni");
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        setUser({ id: data.user.id, role: profile?.role || "user" });
      }
    });
  }, [router]);

  // Load categories
  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  // Load article
  useEffect(() => {
    if (!user) return;

    async function fetchArticle() {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Only author can edit
      if (data.author_id !== user!.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setArticleId(data.id);
      setTitle(data.title);
      setExcerpt(data.excerpt || "");
      setContent(data.content || "");
      setCategoryId(data.category_id || "");
      setCoverUrl(data.cover_image_url || "");
      setCoverPreview(data.cover_image_url || "");
      setLoading(false);
    }

    fetchArticle();
  }, [slug, user]);

  function slugify(text: string) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Povolené formáty: JPEG, PNG, GIF, WebP");
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Maximální velikost obrázku je ${MAX_FILE_SIZE / 1024 / 1024} MB`);
      }
      if (!user) throw new Error("Nejste přihlášen");

      const ext = file.name.split(".").pop() || "jpg";
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${user.id}/${name}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("images").getPublicUrl(path);
      return data.publicUrl;
    },
    [user]
  );

  const handleCoverUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setCoverUploading(true);
      try {
        const url = await handleImageUpload(file);
        setCoverUrl(url);
        setCoverPreview(URL.createObjectURL(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nahrání obrázku se nezdařilo");
      }
      setCoverUploading(false);
      e.target.value = "";
    },
    [handleImageUpload]
  );

  async function handleSave(asDraft = false) {
    if (!user || !articleId) return;
    if (!title.trim()) {
      setError("Zadejte název článku");
      return;
    }
    if (!categoryId) {
      setError("Vyberte kategorii");
      return;
    }
    if (!content.trim() || content === "<p></p>") {
      setError("Článek nemůže být prázdný");
      return;
    }

    setSaving(true);
    setError(null);

    const isAdmin = user.role === "admin";
    const newSlug = slugify(title);
    const updateData: Record<string, unknown> = {
      title: title.trim(),
      slug: newSlug,
      excerpt: excerpt.trim() || null,
      content,
      category_id: categoryId,
      cover_image_url: coverUrl || null,
      status: asDraft ? "draft" : "published",
      published_at: asDraft ? null : new Date().toISOString(),
      // Non-admin edits reset verification!
      verified: isAdmin ? true : false,
    };

    const { error: updateError } = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", articleId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Notify admins if non-admin edited
    if (!asDraft && !isAdmin) {
      fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleTitle: title.trim(),
          articleSlug: newSlug,
          authorName: "Autor",
        }),
      }).catch(() => {});
    }

    if (asDraft) {
      router.push("/clanky");
    } else if (isAdmin) {
      router.push(`/clanky/${newSlug}`);
    } else {
      // Non-admin: article goes back to pending verification
      router.push("/clanky");
      alert("Článek byl upraven a čeká na opětovné schválení administrátorem.");
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-text-muted">Načítání…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '64px 24px' }} className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-2">Článek nenalezen</h1>
        <p className="text-text-muted mb-6">Tento článek neexistuje nebo nemáte oprávnění ho upravovat.</p>
        <Link href="/clanky" className="text-primary hover:underline">← Zpět na články</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/clanky/${slug}`} className="text-text-muted hover:text-white transition-colors">
            ← Zpět
          </Link>
          <h1 className="text-2xl font-bold text-white">Upravit článek</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all text-sm font-medium disabled:opacity-50"
          >
            Uložit koncept
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-primary text-[#0f1117] font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Uložit a publikovat"}
          </button>
        </div>
      </div>

      {/* Re-verification warning for non-admins */}
      {user.role !== "admin" && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          ⚠️ Po uložení bude článek znovu čekat na schválení administrátorem.
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Název článku…"
        className="w-full text-3xl font-bold bg-transparent border-none outline-none text-white placeholder:text-white/15 mb-2"
      />

      {/* Excerpt */}
      <textarea
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        placeholder="Krátký popis článku (volitelné)…"
        rows={2}
        className="w-full bg-transparent border-none outline-none text-gray-400 placeholder:text-white/10 resize-none mb-6 text-base leading-relaxed"
      />

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Category */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Kategorie</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-[#12141f] border border-white/10 text-white text-sm outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="">Vyberte kategorii…</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cover image */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Úvodní obrázek</label>
          <div className="flex items-center gap-3">
            {coverPreview ? (
              <div className="relative group">
                <img
                  src={coverPreview}
                  alt="Cover"
                  className="w-16 h-10 object-cover rounded-lg border border-white/10"
                />
                <button
                  type="button"
                  onClick={() => { setCoverUrl(""); setCoverPreview(""); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ) : null}
            <label
              className={`px-4 py-2.5 rounded-lg border border-white/10 text-sm cursor-pointer transition-all
                ${coverUploading ? "opacity-50 pointer-events-none" : "hover:border-primary/50 text-gray-400 hover:text-white"}
              `}
            >
              {coverUploading ? "Nahrávám…" : coverPreview ? "Změnit" : "Nahrát obrázek"}
              <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Editor */}
      <ArticleEditor
        content={content}
        onChange={setContent}
        onImageUpload={handleImageUpload}
        placeholder="Obsah článku…"
      />

      {/* Bottom actions (mobile) */}
      <div className="flex gap-3 mt-6 sm:hidden">
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-gray-400 text-sm font-medium disabled:opacity-50"
        >
          Koncept
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex-1 px-4 py-3 rounded-lg bg-primary text-[#0f1117] font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit"}
        </button>
      </div>
    </div>
  );
}
