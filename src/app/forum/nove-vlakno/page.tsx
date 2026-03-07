"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { ForumSection } from "@/types/database";

export default function NewThreadPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "#6a6e80", fontSize: "14px" }}>Načítám...</p>
      </div>
    }>
      <NewThreadContent />
    </Suspense>
  );
}

function NewThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("section") || "";
  const { user, profile, loading: authLoading } = useAuth();

  const [sections, setSections] = useState<ForumSection[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    supabase
      .from("forum_sections")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setSections(data);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_forum_banned", { check_user_id: user.id }).then(({ data }) => {
      if (data) setIsBanned(true);
    });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!user) { setError("Musíte být přihlášeni"); return; }
    if (isBanned) { setError("Máte zákaz přispívat na fórum"); return; }
    if (title.trim().length < 5) { setError("Nadpis musí mít alespoň 5 znaků"); return; }
    if (content.trim().length < 10) { setError("Obsah musí mít alespoň 10 znaků"); return; }
    if (!selectedSlug) { setError("Vyberte sekci"); return; }

    const section = sections.find(s => s.slug === selectedSlug);
    if (!section) { setError("Neplatná sekce"); return; }

    setSubmitting(true);
    try {
      const { data, error: err } = await supabase
        .from("forum_threads")
        .insert({
          section_id: section.id,
          author_id: user.id,
          title: title.trim(),
          content: content.trim(),
        })
        .select("id")
        .single();

      if (err) throw err;
      router.push(`/forum/${selectedSlug}/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při vytváření vlákna");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "#6a6e80", fontSize: "14px" }}>Načítám...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "24px", color: "#fff", marginBottom: "8px" }}>Přihlaste se</h1>
        <p style={{ color: "#8a8ea0", marginBottom: "16px" }}>Pro založení vlákna se musíte přihlásit</p>
        <Link href="/prihlaseni" style={{ color: "#f0a030", textDecoration: "none" }}>→ Přihlášení</Link>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
        <h1 style={{ fontSize: "24px", color: "#ff6b6b", marginBottom: "8px" }}>Zákaz přispívání</h1>
        <p style={{ color: "#8a8ea0" }}>Máte zákaz přispívat na fórum</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontSize: "13px", color: "#6a6e80" }}>
        <Link href="/forum" style={{ color: "#f0a030", textDecoration: "none" }}>Fórum</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#a0a4b8" }}>Nové vlákno</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", marginBottom: "32px" }}>
        📝 Nové vlákno
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Section */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
            Sekce *
          </label>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "#1e2233",
              border: "1px solid #2a2f45",
              borderRadius: "8px",
              color: "#e0e0e0",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="">— Vyberte sekci —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.slug}>{s.icon} {s.name}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
            Nadpis * <span style={{ color: "#555a70", fontWeight: 400 }}>(min. 5 znaků)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={5}
            placeholder="O čem chcete diskutovat?"
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "#1e2233",
              border: "1px solid #2a2f45",
              borderRadius: "8px",
              color: "#e0e0e0",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Content */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
            Obsah * <span style={{ color: "#555a70", fontWeight: 400 }}>(min. 10 znaků)</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            minLength={10}
            rows={10}
            placeholder="Napište první příspěvek..."
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "#1e2233",
              border: "1px solid #2a2f45",
              borderRadius: "8px",
              color: "#e0e0e0",
              fontSize: "14px",
              lineHeight: 1.6,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(220,53,69,0.1)",
            border: "1px solid rgba(220,53,69,0.3)",
            borderRadius: "8px",
            color: "#ff6b6b",
            fontSize: "13px",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 28px",
              background: submitting ? "#353a50" : "#f0a030",
              color: submitting ? "#6a6e80" : "#0f1117",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Vytvářím..." : "Vytvořit vlákno"}
          </button>
          <Link
            href={selectedSlug ? `/forum/${selectedSlug}` : "/forum"}
            style={{
              padding: "12px 28px",
              background: "#353a50",
              color: "#a0a4b8",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            Zrušit
          </Link>
        </div>
      </form>
    </div>
  );
}
