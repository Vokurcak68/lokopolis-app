"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
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
        <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám...</p>
      </div>
    }>
      <NewThreadContent />
    </Suspense>
  );
}

interface ImagePreview {
  file: File;
  preview: string;
  uploading: boolean;
  url: string | null;
  error: string | null;
}

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MERITKA = ["TT", "H0", "N", "Z", "G", "jiné"];
const KRAJINY = ["horská", "městská", "průmyslová", "venkovská", "nádraží", "jiné"];

function NewThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("section") || "";
  const { user, loading: authLoading } = useAuth();

  const [sections, setSections] = useState<ForumSection[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isBanned, setIsBanned] = useState(false);

  // Image upload state
  const [images, setImages] = useState<ImagePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Structured fields for moje-kolejiste
  const [meritko, setMeritko] = useState("");
  const [rozmer, setRozmer] = useState("");
  const [krajina, setKrajina] = useState("");

  const isMojeKolejiste = selectedSlug === "moje-kolejiste";

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

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`Maximálně ${MAX_IMAGES} fotek`);
      return;
    }

    const toAdd = fileArray.slice(0, remaining);
    const newImages: ImagePreview[] = [];

    for (const file of toAdd) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Nepodporovaný formát: ${file.name}. Povoleno: JPEG, PNG, WebP, GIF`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`Soubor ${file.name} je příliš velký (max 5 MB)`);
        continue;
      }
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        url: null,
        error: null,
      });
    }

    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
    }
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const uploadImages = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    const urls: string[] = [];

    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];
      if (img.url) {
        urls.push(img.url);
        continue;
      }

      updatedImages[i] = { ...img, uploading: true };
      setImages([...updatedImages]);

      const ext = img.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `forum/${user.id}/${Date.now()}_${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, img.file, { contentType: img.file.type });

      if (uploadError) {
        updatedImages[i] = { ...img, uploading: false, error: uploadError.message };
        setImages([...updatedImages]);
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from("images").getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      updatedImages[i] = { ...img, uploading: false, url: publicUrl };
      setImages([...updatedImages]);
      urls.push(publicUrl);
    }

    return urls;
  }, [images, user]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

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
      // Upload images first
      const uploadedUrls = await uploadImages();

      // Build content with structured header for moje-kolejiste
      let finalContent = "";

      if (isMojeKolejiste && (meritko || rozmer || krajina)) {
        finalContent += '<div class="kolejiste-info">';
        if (meritko) finalContent += `<span class="kolejiste-tag">📐 Měřítko: ${meritko}</span>`;
        if (rozmer) finalContent += `<span class="kolejiste-tag">📏 Rozměr: ${rozmer}</span>`;
        if (krajina) finalContent += `<span class="kolejiste-tag">🏔️ Krajina: ${krajina}</span>`;
        finalContent += '</div>\n\n';
      }

      finalContent += content.trim();

      // Append uploaded images
      if (uploadedUrls.length > 0) {
        finalContent += "\n\n";
        for (const url of uploadedUrls) {
          finalContent += `<img src="${url}" alt="Fotka" />\n`;
        }
      }

      const { data, error: err } = await supabase
        .from("forum_threads")
        .insert({
          section_id: section.id,
          author_id: user.id,
          title: title.trim(),
          content: finalContent,
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
        <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "8px" }}>Přihlaste se</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: "16px" }}>Pro založení vlákna se musíte přihlásit</p>
        <Link href="/prihlaseni" style={{ color: "var(--accent)", textDecoration: "none" }}>→ Přihlášení</Link>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
        <h1 style={{ fontSize: "24px", color: "#ff6b6b", marginBottom: "8px" }}>Zákaz přispívání</h1>
        <p style={{ color: "var(--text-dim)" }}>Máte zákaz přispívat na fórum</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontSize: "13px", color: "var(--text-dimmer)" }}>
        <Link href="/forum" style={{ color: "var(--accent)", textDecoration: "none" }}>Fórum</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "var(--text-muted)" }}>Nové vlákno</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "32px" }}>
        📝 Nové vlákno
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Section */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
            Sekce *
          </label>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              color: "var(--text-body)",
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

        {/* Structured fields for moje-kolejiste */}
        {isMojeKolejiste && (
          <div style={{
            background: "rgba(240,160,48,0.05)",
            border: "1px solid rgba(240,160,48,0.2)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--accent)", marginBottom: "16px" }}>
              🏗️ Parametry kolejiště
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 500 }}>
                  Měřítko
                </label>
                <select
                  value={meritko}
                  onChange={(e) => setMeritko(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-input)",
                    borderRadius: "8px",
                    color: "var(--text-body)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                >
                  <option value="">— Vyberte —</option>
                  {MERITKA.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 500 }}>
                  Typ krajiny
                </label>
                <select
                  value={krajina}
                  onChange={(e) => setKrajina(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-input)",
                    borderRadius: "8px",
                    color: "var(--text-body)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                >
                  <option value="">— Vyberte —</option>
                  {KRAJINY.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 500 }}>
                  Rozměr kolejiště
                </label>
                <input
                  type="text"
                  value={rozmer}
                  onChange={(e) => setRozmer(e.target.value)}
                  placeholder="např. 3 × 2 m"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-input)",
                    borderRadius: "8px",
                    color: "var(--text-body)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
            Nadpis * <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(min. 5 znaků)</span>
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
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              color: "var(--text-body)",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Content */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
            Obsah * <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(min. 10 znaků)</span>
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
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "8px",
              color: "var(--text-body)",
              fontSize: "14px",
              lineHeight: 1.6,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Image Upload */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
            📷 Fotky <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(max {MAX_IMAGES}, do 5 MB)</span>
          </label>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "12px",
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(240,160,48,0.05)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📸</div>
            <p style={{ fontSize: "14px", color: "var(--text-dim)", margin: 0 }}>
              Přetáhněte fotky sem nebo klikněte pro výběr
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "4px" }}>
              JPEG, PNG, WebP, GIF · Max 5 MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />

          {/* Preview grid */}
          {images.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: "8px",
              marginTop: "12px",
            }}>
              {images.map((img, i) => (
                <div key={i} style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  aspectRatio: "1",
                  background: "var(--bg-card)",
                  border: `1px solid ${img.error ? "rgba(220,53,69,0.5)" : "var(--border)"}`,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.preview}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {img.uploading && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "20px",
                    }}>
                      ⏳
                    </div>
                  )}
                  {img.error && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(220,53,69,0.9)",
                      color: "#fff",
                      fontSize: "10px",
                      padding: "2px 4px",
                      textAlign: "center",
                    }}>
                      Chyba
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      border: "none",
                      fontSize: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
              background: submitting ? "var(--border-hover)" : "var(--accent)",
              color: submitting ? "var(--text-dimmer)" : "var(--bg-page)",
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
              background: "var(--border-hover)",
              color: "var(--text-muted)",
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
