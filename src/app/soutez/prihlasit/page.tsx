"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { Competition, CompetitionEntry } from "@/types/database";

/* ============================================================
   HELPERS
   ============================================================ */

function optimizeImageUrl(url: string, width: number = 400): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat(`?width=${width}&quality=75`);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SCALES = [
  { value: "TT", label: "TT (1:120)" },
  { value: "H0", label: "H0 (1:87)" },
  { value: "N", label: "N (1:160)" },
  { value: "Z", label: "Z (1:220)" },
  { value: "G", label: "G (1:22.5)" },
  { value: "jiné", label: "Jiné" },
];

const LANDSCAPES = [
  { value: "horská", label: "Horská" },
  { value: "městská", label: "Městská" },
  { value: "průmyslová", label: "Průmyslová" },
  { value: "venkovská", label: "Venkovská" },
  { value: "nádraží", label: "Nádraží" },
  { value: "jiné", label: "Jiné" },
];

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/* ============================================================
   ENTRY FORM PAGE
   ============================================================ */

export default function EntrySubmitPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);
  const [existingEntry, setExistingEntry] = useState<CompetitionEntry | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scale, setScale] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [landscape, setLandscape] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Find active competition
      const { data: comps } = await supabase
        .from("competitions")
        .select("*")
        .eq("status", "active")
        .order("starts_at", { ascending: false })
        .limit(1);

      const comp = comps && comps.length > 0 ? (comps[0] as Competition) : null;
      setActiveCompetition(comp);

      if (comp) {
        // Check if user already has an entry
        const { data: entry } = await supabase
          .from("competition_entries")
          .select("*")
          .eq("competition_id", comp.id)
          .eq("user_id", user.id)
          .maybeSingle();

        setExistingEntry(entry as CompetitionEntry | null);
      }
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/prihlaseni");
        return;
      }
      fetchData();
    }
  }, [user, authLoading, fetchData, router]);

  function validateFile(f: File): string | null {
    const validExt = ["jpg", "jpeg", "png", "gif", "webp"];
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!validExt.includes(ext))
      return `Nepodporovaný formát (.${ext}). Povolené: ${validExt.join(", ")}`;
    if (f.size > MAX_IMAGE_SIZE)
      return `Obrázek "${f.name}" je příliš velký (${formatFileSize(f.size)}). Maximum je 5 MB.`;
    return null;
  }

  function addFiles(newFiles: File[]) {
    const remaining = MAX_IMAGES - files.length;
    if (remaining <= 0) {
      setError(`Maximální počet fotek je ${MAX_IMAGES}.`);
      return;
    }

    const toAdd: File[] = [];
    for (const f of newFiles.slice(0, remaining)) {
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      toAdd.push(f);
    }

    setError("");
    const newAll = [...files, ...toAdd];
    setFiles(newAll);

    // Generate previews
    const newPreviews: string[] = [...previews];
    for (const f of toAdd) {
      newPreviews.push(URL.createObjectURL(f));
    }
    setPreviews(newPreviews);
  }

  function removeFile(idx: number) {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeCompetition) return;
    if (!title.trim()) {
      setError("Vyplňte název kolejiště.");
      return;
    }
    if (files.length === 0) {
      setError("Přidejte alespoň jednu fotku.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Upload images
      const imageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Nahrávám fotku ${i + 1}/${files.length}...`);
        const file = files[i];
        const ext = file.name.split(".").pop();
        const filePath = `competitions/${user.id}/${Date.now()}_${i}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("images")
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("images")
          .getPublicUrl(filePath);

        imageUrls.push(urlData.publicUrl);
      }

      setUploadProgress("Ukládám přihlášku...");

      const { error: dbErr } = await supabase
        .from("competition_entries")
        .insert({
          competition_id: activeCompetition.id,
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          scale: scale || null,
          dimensions: dimensions.trim() || null,
          landscape: landscape || null,
          images: imageUrls,
        });

      if (dbErr) throw dbErr;

      router.push("/soutez");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba při ukládání";
      setError(msg);
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  if (loading || authLoading) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!activeCompetition) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏆</div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Žádná aktivní soutěž
        </h1>
        <p
          style={{
            color: "var(--text-dim)",
            fontSize: "15px",
            marginBottom: "24px",
          }}
        >
          V tuto chvíli neprobíhá žádná soutěž s otevřeným přihlašováním.
        </p>
        <Link
          href="/soutez"
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Zpět na soutěž
        </Link>
      </div>
    );
  }

  if (existingEntry) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Už jste přihlášeni!
        </h1>
        <p
          style={{
            color: "var(--text-dim)",
            fontSize: "15px",
            marginBottom: "24px",
          }}
        >
          Do této soutěže už máte přihlášku: &quot;{existingEntry.title}&quot;
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link
            href={`/soutez/${existingEntry.id}`}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Zobrazit přihlášku
          </Link>
          <Link
            href="/soutez"
            style={{
              padding: "10px 20px",
              background: "var(--bg-card)",
              color: "var(--text-body)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ← Zpět na soutěž
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 20px" }}>
      <Link
        href="/soutez"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--text-muted)",
          fontSize: "14px",
          textDecoration: "none",
          marginBottom: "24px",
        }}
      >
        ← Zpět na soutěž
      </Link>

      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "8px",
        }}
      >
        🚂 Přihlásit kolejiště
      </h1>
      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "14px",
          marginBottom: "32px",
        }}
      >
        Soutěž: <strong>{activeCompetition.title}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              color: "var(--text-body)",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            Název kolejiště *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Např. Horská dráha TT..."
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "10px",
              color: "var(--text-body)",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              color: "var(--text-body)",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            Popis
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Popište své kolejiště — inspirace, použité techniky, příběh..."
            rows={5}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "10px",
              color: "var(--text-body)",
              fontSize: "15px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Scale & Landscape row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                color: "var(--text-body)",
                marginBottom: "6px",
                fontWeight: 600,
              }}
            >
              Měřítko
            </label>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "10px",
                color: "var(--text-body)",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Vyberte —</option>
              {SCALES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                color: "var(--text-body)",
                marginBottom: "6px",
                fontWeight: 600,
              }}
            >
              Typ krajiny
            </label>
            <select
              value={landscape}
              onChange={(e) => setLandscape(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "10px",
                color: "var(--text-body)",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Vyberte —</option>
              {LANDSCAPES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dimensions */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              color: "var(--text-body)",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            Rozměr
          </label>
          <input
            type="text"
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="Např. 3 × 2 m"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "10px",
              color: "var(--text-body)",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Photos */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              color: "var(--text-body)",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            Fotky * (min 1, max {MAX_IMAGES})
          </label>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() =>
              document.getElementById("competition-file-input")?.click()
            }
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-input)"}`,
              borderRadius: "12px",
              padding: "32px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
              background: dragOver ? "var(--accent-bg)" : "transparent",
              marginBottom: "12px",
            }}
          >
            <input
              id="competition-file-input"
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              multiple
              onChange={(e) => {
                if (e.target.files) addFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📷</div>
            <div style={{ fontSize: "14px", color: "var(--text-dim)" }}>
              Přetáhněte fotky sem nebo klikněte pro výběr
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-faint)",
                marginTop: "6px",
              }}
            >
              JPEG, PNG, GIF, WebP · max 5 MB na fotku
            </div>
          </div>

          {/* Preview grid */}
          {previews.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: "8px",
              }}
            >
              {previews.map((preview, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    width: "100%",
                    paddingTop: "100%",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Image
                    src={preview}
                    alt={`Foto ${i + 1}`}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="100px"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      width: "24px",
                      height: "24px",
                      background: "rgba(0,0,0,0.7)",
                      border: "none",
                      borderRadius: "50%",
                      color: "#fff",
                      fontSize: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      left: "4px",
                      background: "rgba(0,0,0,0.6)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      color: "#fff",
                    }}
                  >
                    {formatFileSize(files[i]?.size || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--danger-bg)",
              border: "1px solid rgba(220,53,69,0.3)",
              borderRadius: "10px",
              color: "var(--danger)",
              fontSize: "14px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(59,130,246,0.1)",
              borderRadius: "10px",
              color: "#3b82f6",
              fontSize: "14px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            ⏳ {uploadProgress}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !title.trim() || files.length === 0}
          style={{
            width: "100%",
            padding: "14px",
            background:
              submitting || !title.trim() || files.length === 0
                ? "var(--border-hover)"
                : "var(--accent)",
            color:
              submitting || !title.trim() || files.length === 0
                ? "var(--text-dimmer)"
                : "var(--accent-text-on)",
            border: "none",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: 700,
            cursor:
              submitting || !title.trim() || files.length === 0
                ? "not-allowed"
                : "pointer",
            transition: "background 0.2s",
          }}
        >
          {submitting ? "Odesílám..." : "🚀 Přihlásit kolejiště do soutěže"}
        </button>
      </form>
    </div>
  );
}
