"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { GalleryItem, GalleryItemType, GalleryAccess, GalleryAlbum } from "@/types/database";

/* ============================================================
   HELPERS
   ============================================================ */

const FILTERS: { value: GalleryItemType | "all"; label: string; icon: string }[] = [
  { value: "all", label: "Vše", icon: "🖼️" },
  { value: "image", label: "Fotky", icon: "📷" },
  { value: "video", label: "Videa", icon: "🎬" },
  { value: "youtube", label: "YouTube", icon: "▶️" },
];

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp";
const VIDEO_ACCEPT = ".mp4,.webm,.mov";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ============================================================
   LIGHTBOX
   ============================================================ */

function Lightbox({
  items,
  currentIndex,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const item = items[currentIndex];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < items.length - 1) onNavigate(currentIndex + 1);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [currentIndex, items.length, onClose, onNavigate]);

  const ytId = item.type === "youtube" ? extractYouTubeId(item.media_url) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.9)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "var(--text-primary)",
          fontSize: "28px",
          cursor: "pointer",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2001,
        }}
      >
        ✕
      </button>

      {/* Prev */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
          style={{
            position: "absolute",
            left: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "28px",
            cursor: "pointer",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2001,
          }}
        >
          ‹
        </button>
      )}

      {/* Next */}
      {currentIndex < items.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
          style={{
            position: "absolute",
            right: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "28px",
            cursor: "pointer",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2001,
          }}
        >
          ›
        </button>
      )}

      {/* Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {item.type === "image" && (
          <Image
            src={item.media_url}
            alt={item.title}
            width={1200}
            height={800}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: "8px",
            }}
            sizes="90vw"
          />
        )}
        {item.type === "video" && (
          <video
            src={item.media_url}
            controls
            autoPlay
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: "8px",
            }}
          />
        )}
        {item.type === "youtube" && ytId && (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: "min(90vw, 960px)",
              height: "min(70vh, 540px)",
              border: "none",
              borderRadius: "8px",
            }}
          />
        )}
        <div style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>
            {item.title}
          </h3>
          {item.description && (
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{item.description}</p>
          )}
          <p style={{ color: "var(--text-faint)", fontSize: "12px", marginTop: "4px" }}>
            {currentIndex + 1} / {items.length}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   UPLOAD MODAL (for adding items to album)
   ============================================================ */

function UploadModal({
  albumId,
  onClose,
  onUploaded,
}: {
  albumId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { user } = useAuth();
  const [mediaType, setMediaType] = useState<GalleryItemType>("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<GalleryAccess>("public");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function validateFile(f: File): string | null {
    if (mediaType === "image") {
      const validExt = ["jpg", "jpeg", "png", "gif", "webp"];
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!validExt.includes(ext)) return `Nepodporovaný formát (.${ext}). Povolené: ${validExt.join(", ")}`;
      if (f.size > MAX_IMAGE_SIZE) return `Obrázek je příliš velký (${formatFileSize(f.size)}). Maximum je 10 MB.`;
    } else if (mediaType === "video") {
      const validExt = ["mp4", "webm", "mov"];
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!validExt.includes(ext)) return `Nepodporovaný formát (.${ext}). Povolené: ${validExt.join(", ")}`;
      if (f.size > MAX_VIDEO_SIZE) return `Video je příliš velké (${formatFileSize(f.size)}). Maximum je 100 MB.`;
    }
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
    } else {
      setError("");
      setFile(f);
    }
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

    if (mediaType === "youtube") {
      if (!youtubeUrl.trim() || !isValidYouTubeUrl(youtubeUrl)) {
        setError("Zadejte platnou YouTube URL");
        return;
      }
    } else if (!file) {
      setError("Vyberte soubor");
      return;
    }

    setUploading(true);
    setError("");

    try {
      let mediaUrl = "";
      let thumbnailUrl: string | null = null;

      if (mediaType === "youtube") {
        mediaUrl = youtubeUrl.trim();
        const ytId = extractYouTubeId(mediaUrl);
        if (ytId) {
          thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        }
      } else if (file) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from("gallery")
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(filePath);

        mediaUrl = urlData.publicUrl;
      }

      const { error: dbErr } = await supabase.from("gallery_items").insert({
        title: title.trim(),
        description: description.trim() || null,
        type: mediaType,
        media_url: mediaUrl,
        thumbnail_url: thumbnailUrl,
        access,
        uploaded_by: user.id,
        album_id: albumId,
      });

      if (dbErr) throw dbErr;

      onUploaded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba při nahrávání";
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  const acceptStr = mediaType === "image" ? IMAGE_ACCEPT : VIDEO_ACCEPT;
  const maxSizeLabel = mediaType === "image" ? "10 MB" : "100 MB";
  const formatsLabel =
    mediaType === "image"
      ? "JPEG, PNG, GIF, WebP"
      : "MP4, WebM, MOV";

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
            ➕ Přidat do alba
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
          {/* Typ média */}
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
              Typ média
            </label>
            <div style={{ display: "flex", gap: "12px" }}>
              {(
                [
                  { value: "image", label: "📷 Fotka" },
                  { value: "video", label: "🎬 Video" },
                  { value: "youtube", label: "▶️ YouTube" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
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
                    name="mediaType"
                    value={opt.value}
                    checked={mediaType === opt.value}
                    onChange={() => {
                      setMediaType(opt.value);
                      setFile(null);
                      setYoutubeUrl("");
                      setError("");
                    }}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Název */}
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
              Název *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Název položky"
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
              placeholder="Volitelný popis..."
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

          {/* YouTube URL */}
          {mediaType === "youtube" && (
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
                YouTube URL *
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => {
                  setYoutubeUrl(e.target.value);
                  setError("");
                }}
                placeholder="https://www.youtube.com/watch?v=..."
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
              {youtubeUrl && isValidYouTubeUrl(youtubeUrl) && (
                <div style={{ marginTop: "8px" }}>
                  <Image
                    src={`https://img.youtube.com/vi/${extractYouTubeId(youtubeUrl)}/hqdefault.jpg`}
                    alt="YouTube thumbnail"
                    width={320}
                    height={180}
                    style={{
                      width: "100%",
                      maxWidth: "320px",
                      height: "auto",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* File upload (image/video) */}
          {mediaType !== "youtube" && (
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
                Soubor *
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() =>
                  document.getElementById("gallery-file-input")?.click()
                }
                style={{
                  border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-input)"}`,
                  borderRadius: "12px",
                  padding: "32px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                  background: dragOver
                    ? "var(--accent-bg-subtle)"
                    : "transparent",
                }}
              >
                <input
                  id="gallery-file-input"
                  type="file"
                  accept={acceptStr}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  }}
                  style={{ display: "none" }}
                />
                {file ? (
                  <div>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                      {mediaType === "image" ? "📷" : "🎬"}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "var(--text-body)",
                        fontWeight: 500,
                      }}
                    >
                      {file.name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-dimmer)",
                        marginTop: "4px",
                      }}
                    >
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                      {mediaType === "image" ? "📷" : "🎬"}
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                      Přetáhněte soubor sem nebo klikněte pro výběr
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-faint)",
                        marginTop: "6px",
                      }}
                    >
                      {formatsLabel} · max {maxSizeLabel}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
            disabled={uploading || !title.trim()}
            style={{
              width: "100%",
              padding: "12px",
              background:
                uploading || !title.trim() ? "var(--border-hover)" : "var(--accent)",
              color:
                uploading || !title.trim() ? "var(--text-dimmer)" : "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor:
                uploading || !title.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {uploading ? "Nahrávám..." : "Přidat do alba"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   GALLERY CARD (item within album)
   ============================================================ */

function GalleryCard({
  item,
  isAdmin,
  isAuthenticated,
  onOpen,
  onDelete,
}: {
  item: GalleryItem;
  isAdmin: boolean;
  isAuthenticated: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const needsAuth = item.access === "authenticated" && !isAuthenticated;
  const ytId = item.type === "youtube" ? extractYouTubeId(item.media_url) : null;

  const typeIcon =
    item.type === "image" ? "📷" : item.type === "video" ? "🎬" : "▶️";
  const typeLabel =
    item.type === "image" ? "Fotka" : item.type === "video" ? "Video" : "YouTube";

  let thumbUrl: string | null = null;
  if (item.thumbnail_url) {
    thumbUrl = item.thumbnail_url;
  } else if (item.type === "youtube" && ytId) {
    thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  } else if (item.type === "image") {
    thumbUrl = item.media_url;
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
        borderBottom: "3px solid var(--accent)",
        position: "relative",
      }}
      onClick={() => {
        if (!needsAuth) onOpen();
      }}
      onMouseEnter={() => {
        if (cardRef.current) {
          cardRef.current.style.transform = "translateY(-3px)";
          cardRef.current.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
          cardRef.current.style.borderColor = "var(--border-hover)";
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
      {/* Thumbnail / preview */}
      <div
        style={{
          width: "100%",
          height: "200px",
          background: "var(--bg-page)",
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
              background: "var(--bg-page)",
              position: "relative",
            }}
          >
            {thumbUrl && (
              <Image
                src={thumbUrl}
                alt=""
                fill
                style={{
                  objectFit: "cover",
                  filter: "blur(20px) brightness(0.4)",
                }}
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            )}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                textAlign: "center",
                padding: "20px",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔒</div>
              <a
                href="/prihlaseni"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: "var(--accent)",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Přihlaste se pro zobrazení
              </a>
            </div>
          </div>
        ) : thumbUrl ? (
          <>
            <Image
              src={thumbUrl}
              alt={item.title}
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 768px) 50vw, 33vw"
            />
            {item.type !== "image" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(240,160,48,0.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                  }}
                >
                  ▶
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              color: "var(--border-hover)",
            }}
          >
            {typeIcon}
          </div>
        )}

        {/* Type badge */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            background: "rgba(15,17,23,0.8)",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {typeIcon} {typeLabel}
        </div>

        {/* Access badge */}
        {item.access === "authenticated" && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
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

      {/* Info */}
      <div style={{ padding: "14px 16px" }}>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-body)",
            marginBottom: "4px",
            lineHeight: 1.4,
          }}
        >
          {item.title}
        </h3>
        {item.description && (
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-dimmer)",
              lineHeight: 1.4,
              marginBottom: "0",
            }}
          >
            {item.description}
          </p>
        )}
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
            bottom: "12px",
            right: "12px",
            padding: "6px 10px",
            background: "var(--danger-bg)",
            border: "1px solid rgba(220,53,69,0.3)",
            borderRadius: "8px",
            color: "var(--danger)",
            fontSize: "14px",
            cursor: "pointer",
            transition: "background 0.2s",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(220,53,69,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--danger-bg)";
          }}
        >
          🗑️
        </button>
      )}
    </div>
  );
}

/* ============================================================
   ALBUM DETAIL PAGE
   ============================================================ */

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.id as string;

  const { user, profile, loading: authLoading } = useAuth();
  const [album, setAlbum] = useState<GalleryAlbum | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeFilter, setActiveFilter] = useState<GalleryItemType | "all">("all");
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isAdmin = profile?.role === "admin";
  const isAuthenticated = !!user;

  const fetchAlbum = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("gallery_albums")
        .select("*, profiles:created_by(username)")
        .eq("id", albumId)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      const profiles = (data as Record<string, unknown>).profiles as { username: string } | null;
      setAlbum({
        id: data.id,
        title: data.title,
        description: data.description,
        cover_image_url: data.cover_image_url,
        access: data.access,
        created_by: data.created_by,
        item_count: data.item_count,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author_username: profiles?.username ?? undefined,
      });
    } catch {
      setNotFound(true);
    }
  }, [albumId]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.getSession();

      let query = supabase
        .from("gallery_items")
        .select("*")
        .eq("album_id", albumId)
        .order("created_at", { ascending: false });

      if (activeFilter !== "all") {
        query = query.eq("type", activeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems((data as GalleryItem[]) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [albumId, activeFilter]);

  useEffect(() => {
    if (!authLoading) {
      fetchAlbum();
      fetchItems();
    }
  }, [fetchAlbum, fetchItems, authLoading]);

  async function handleDelete(item: GalleryItem) {
    if (!confirm(`Opravdu smazat "${item.title}"?`)) return;

    try {
      if (item.type !== "youtube") {
        const urlParts = item.media_url.split("/gallery/");
        if (urlParts[1]) {
          const storagePath = decodeURIComponent(urlParts[1]);
          await supabase.storage.from("gallery").remove([storagePath]);
        }
      }

      const { error } = await supabase
        .from("gallery_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;

      fetchItems();
      fetchAlbum(); // refresh item_count
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba při mazání");
    }
  }

  const openableItems = items.filter(
    (i) => !(i.access === "authenticated" && !isAuthenticated)
  );

  function openLightbox(item: GalleryItem) {
    const idx = openableItems.findIndex((i) => i.id === item.id);
    if (idx !== -1) setLightboxIndex(idx);
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>😕</div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Album nenalezeno
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "15px", marginBottom: "24px" }}>
          Toto album neexistuje nebo k němu nemáte přístup.
        </p>
        <Link
          href="/galerie"
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
          ← Zpět na galerii
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Back link */}
      <Link
        href="/galerie"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--text-muted)",
          fontSize: "14px",
          textDecoration: "none",
          marginBottom: "24px",
          transition: "color 0.2s",
        }}
      >
        ← Zpět na galerii
      </Link>

      {/* Album header */}
      {album && (
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              marginBottom: "8px",
              color: "var(--text-primary)",
            }}
          >
            {album.title}
          </h1>
          {album.description && (
            <p style={{ fontSize: "15px", color: "var(--text-dim)", marginBottom: "8px", lineHeight: 1.6 }}>
              {album.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "var(--text-faint)" }}>
            {album.author_username && (
              <span>Autor: <span style={{ color: "var(--text-dimmer)" }}>{album.author_username}</span></span>
            )}
            <span>{album.item_count} {album.item_count === 1 ? "položka" : album.item_count >= 2 && album.item_count <= 4 ? "položky" : "položek"}</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Filter buttons */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                style={{
                  padding: "8px 16px",
                  background: isActive ? "var(--accent-border)" : "var(--bg-card)",
                  border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "8px",
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {f.icon} {f.label}
              </button>
            );
          })}
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
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
            ➕ Přidat do alba
          </button>
        )}
      </div>

      {/* Gallery grid */}
      {loading || authLoading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            Načítám obsah alba...
          </p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🖼️</div>
          <p style={{ color: "var(--text-dim)", fontSize: "16px", marginBottom: "4px" }}>
            Album je zatím prázdné
          </p>
          <p style={{ color: "var(--text-faint)", fontSize: "13px" }}>
            {activeFilter !== "all"
              ? "Zkuste jiný filtr"
              : isAdmin
                ? 'Přidejte obsah kliknutím na "Přidat do alba"'
                : "Zatím nebyl přidán žádný obsah"}
          </p>
        </div>
      ) : (
        <div>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media (min-width: 640px) {
                  .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
                }
                @media (min-width: 1024px) {
                  .gallery-grid { grid-template-columns: repeat(3, 1fr) !important; }
                }
              `,
            }}
          />
          <div
            className="gallery-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "16px",
            }}
          >
            {items.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                isAuthenticated={isAuthenticated}
                onOpen={() => openLightbox(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          albumId={albumId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            fetchItems();
            fetchAlbum();
          }}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          items={openableItems}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(idx) => setLightboxIndex(idx)}
        />
      )}
    </div>
  );
}
