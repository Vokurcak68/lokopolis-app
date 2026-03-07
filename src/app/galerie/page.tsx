"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import type { GalleryAlbum, GalleryAccess } from "@/types/database";

/* ============================================================
   HELPERS
   ============================================================ */

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function itemCountLabel(count: number): string {
  if (count === 0) return "Prázdné";
  if (count === 1) return "1 položka";
  if (count >= 2 && count <= 4) return `${count} položky`;
  return `${count} položek`;
}

/* ============================================================
   CREATE ALBUM MODAL
   ============================================================ */

function CreateAlbumModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<GalleryAccess>("public");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function handleFileSelect(f: File) {
    const validExt = ["jpg", "jpeg", "png", "gif", "webp"];
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!validExt.includes(ext)) {
      setError(`Nepodporovaný formát (.${ext}). Povolené: ${validExt.join(", ")}`);
      setCoverFile(null);
      return;
    }
    if (f.size > MAX_IMAGE_SIZE) {
      setError(`Obrázek je příliš velký (${formatFileSize(f.size)}). Maximum je 10 MB.`);
      setCoverFile(null);
      return;
    }
    setError("");
    setCoverFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setSaving(true);
    setError("");

    try {
      let coverImageUrl: string | null = null;

      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const filePath = `albums/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from("gallery")
          .upload(filePath, coverFile);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(filePath);

        coverImageUrl = urlData.publicUrl;
      }

      const { error: dbErr } = await supabase.from("gallery_albums").insert({
        title: title.trim(),
        description: description.trim() || null,
        cover_image_url: coverImageUrl,
        access,
        created_by: user.id,
      });

      if (dbErr) throw dbErr;

      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba při vytváření alba";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
            📁 Nové album
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Název alba */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Název alba *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Např. Výstava Praha 2025"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Popis */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Popis
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Volitelný popis alba..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Přístup */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
              Přístup
            </label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "var(--text-body)",
                }}
              >
                <input
                  type="radio"
                  name="access"
                  value="public"
                  checked={access === "public"}
                  onChange={() => setAccess("public")}
                  style={{ accentColor: "var(--accent)" }}
                />
                🌐 Veřejné
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "var(--text-body)",
                }}
              >
                <input
                  type="radio"
                  name="access"
                  value="authenticated"
                  checked={access === "authenticated"}
                  onChange={() => setAccess("authenticated")}
                  style={{ accentColor: "var(--accent)" }}
                />
                🔒 Jen přihlášení
              </label>
            </div>
          </div>

          {/* Cover image */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              Titulní obrázek (volitelné)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() =>
                document.getElementById("album-cover-input")?.click()
              }
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-input)"}`,
                borderRadius: "12px",
                padding: "24px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.2s",
                background: dragOver ? "var(--accent-bg-subtle)" : "transparent",
              }}
            >
              <input
                id="album-cover-input"
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
                style={{ display: "none" }}
              />
              {coverFile ? (
                <div>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>🖼️</div>
                  <div style={{ fontSize: "14px", color: "var(--text-body)", fontWeight: 500 }}>
                    {coverFile.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "4px" }}>
                    {formatFileSize(coverFile.size)}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>🖼️</div>
                  <div style={{ fontSize: "13px", color: "var(--text-dim)" }}>
                    Přetáhněte obrázek nebo klikněte pro výběr
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "4px" }}>
                    JPEG, PNG, GIF, WebP · max 10 MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--danger-bg)",
                border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: "8px",
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !title.trim()}
            style={{
              width: "100%",
              padding: "12px",
              background: saving || !title.trim() ? "var(--border-hover)" : "var(--accent)",
              color: saving || !title.trim() ? "var(--text-dimmer)" : "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: saving || !title.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {saving ? "Vytvářím..." : "Vytvořit album"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   ALBUM CARD
   ============================================================ */

function AlbumCard({
  album,
  isAdmin,
  isAuthenticated,
  onDelete,
}: {
  album: GalleryAlbum;
  isAdmin: boolean;
  isAuthenticated: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const needsAuth = album.access === "authenticated" && !isAuthenticated;

  function handleClick() {
    if (!needsAuth) {
      router.push(`/galerie/${album.id}`);
    }
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        cursor: needsAuth ? "default" : "pointer",
        transition: "all 0.2s",
        position: "relative",
      }}
      onClick={handleClick}
      onMouseEnter={() => {
        if (cardRef.current && !needsAuth) {
          cardRef.current.style.transform = "translateY(-3px)";
          cardRef.current.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
          cardRef.current.style.borderColor = "var(--accent-border-strong)";
        }
      }}
      onMouseLeave={() => {
        if (cardRef.current) {
          cardRef.current.style.transform = "translateY(0)";
          cardRef.current.style.boxShadow = "none";
          cardRef.current.style.borderColor = "var(--border)";
        }
      }}
    >
      {/* Cover image area */}
      <div
        style={{
          width: "100%",
          height: "200px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {needsAuth ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, var(--bg-input), var(--bg-elevated))",
              position: "relative",
            }}
          >
            {album.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={album.cover_image_url}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(20px) brightness(0.4)",
                }}
              />
            )}
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "20px" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔒</div>
              <a
                href="/prihlaseni"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "var(--accent)", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}
              >
                Přihlaste se pro zobrazení
              </a>
            </div>
          </div>
        ) : album.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.cover_image_url}
            alt={album.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, var(--bg-input) 0%, var(--bg-elevated) 100%)",
            }}
          >
            <span style={{ fontSize: "56px", opacity: 0.3 }}>📷</span>
          </div>
        )}

        {/* Title overlay at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
            padding: "32px 16px 14px",
          }}
        >
          <h3
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#fff",
              marginBottom: "2px",
              lineHeight: 1.3,
            }}
          >
            {album.title}
          </h3>
        </div>

        {/* Item count badge */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(15,17,23,0.8)",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--accent)",
            fontWeight: 600,
            backdropFilter: "blur(4px)",
          }}
        >
          {itemCountLabel(album.item_count)}
        </div>

        {/* Access badge */}
        {album.access === "authenticated" && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              background: "var(--accent-border)",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              color: "var(--accent)",
            }}
          >
            🔒
          </div>
        )}
      </div>

      {/* Info bar */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-dimmer)",
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "220px",
            margin: 0,
          }}
        >
          {album.description || "\u00A0"}
        </p>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-faint)",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {album.author_username && (
            <span style={{ color: "var(--text-dimmer)" }}>
              {album.author_username}
            </span>
          )}
          <span>{timeAgo(album.created_at)}</span>
        </div>
      </div>

      {/* Admin delete */}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: "absolute",
            bottom: "52px",
            right: "12px",
            padding: "6px 10px",
            background: "rgba(15,17,23,0.8)",
            border: "1px solid rgba(220,53,69,0.3)",
            borderRadius: "8px",
            color: "var(--danger)",
            fontSize: "14px",
            cursor: "pointer",
            transition: "background 0.2s",
            zIndex: 10,
            backdropFilter: "blur(4px)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--danger-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(15,17,23,0.8)";
          }}
        >
          🗑️
        </button>
      )}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function GalleryPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isAuthenticated = !!user;

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.getSession();

      const { data, error } = await supabase
        .from("gallery_albums")
        .select("*, profiles:created_by(username)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: GalleryAlbum[] = (data || []).map((row: Record<string, unknown>) => {
        const profiles = row.profiles as { username: string } | null;
        return {
          id: row.id as string,
          title: row.title as string,
          description: row.description as string | null,
          cover_image_url: row.cover_image_url as string | null,
          access: row.access as GalleryAccess,
          created_by: row.created_by as string | null,
          item_count: row.item_count as number,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          author_username: profiles?.username ?? undefined,
        };
      });

      setAlbums(mapped);
    } catch {
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchAlbums();
    }
  }, [fetchAlbums, authLoading]);

  async function handleDeleteAlbum(album: GalleryAlbum) {
    if (!confirm(`Opravdu smazat album "${album.title}" a všechny jeho položky?`)) return;

    try {
      const { error } = await supabase
        .from("gallery_albums")
        .delete()
        .eq("id", album.id);
      if (error) throw error;
      fetchAlbums();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba při mazání");
    }
  }

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
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>Foto</span>
            <span style={{ color: "var(--accent)" }}>galerie</span>
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
            Fotky, videa a záznamy ze světa modelové železnice
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent)")
            }
          >
            📁 Nové album
          </button>
        )}
      </div>

      {/* Albums grid */}
      {loading || authLoading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            Načítám alba...
          </p>
        </div>
      ) : albums.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📷</div>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "16px",
              marginBottom: "4px",
            }}
          >
            Zatím nejsou žádná alba
          </p>
          <p style={{ color: "var(--text-faint)", fontSize: "13px" }}>
            {isAdmin
              ? 'Vytvořte první album kliknutím na "Nové album"'
              : "Galerie se brzy naplní obsahem"}
          </p>
        </div>
      ) : (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media (min-width: 640px) {
                  .gallery-albums-grid { grid-template-columns: repeat(2, 1fr) !important; }
                }
                @media (min-width: 1024px) {
                  .gallery-albums-grid { grid-template-columns: repeat(3, 1fr) !important; }
                }
              `,
            }}
          />
          <div
            className="gallery-albums-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "20px",
            }}
          >
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                isAdmin={isAdmin}
                isAuthenticated={isAuthenticated}
                onDelete={() => handleDeleteAlbum(album)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create album modal */}
      {showCreate && (
        <CreateAlbumModal
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchAlbums()}
        />
      )}
    </div>
  );
}
