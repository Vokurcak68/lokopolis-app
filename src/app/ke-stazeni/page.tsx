"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { Download, DownloadCategory } from "@/types/database";

/* ============================================================
   CONSTANTS
   ============================================================ */

const CATEGORIES: { value: DownloadCategory | "all"; label: string; icon: string }[] = [
  { value: "all", label: "Vše", icon: "📁" },
  { value: "kolejovy-plan", label: "Kolejové plány", icon: "📐" },
  { value: "stl-model", label: "STL modely", icon: "🧊" },
  { value: "3d-tisk", label: "3D tisk", icon: "🖨️" },
  { value: "navod", label: "Návody", icon: "📖" },
  { value: "software", label: "Software", icon: "💻" },
  { value: "ostatni", label: "Ostatní", icon: "📦" },
];

const ALLOWED_TYPES = [
  "application/pdf",
  "model/stl",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "application/dxf",
  "image/vnd.dxf",
];

const ALLOWED_EXTENSIONS = ["pdf", "stl", "zip", "rar", "7z", "jpg", "jpeg", "png", "dxf", "svg"];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function getFileIcon(fileType: string | null, fileName: string): { emoji: string; colorClass: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (fileType?.includes("pdf") || ext === "pdf") return { emoji: "📄", colorClass: "pdf" };
  if (ext === "stl" || fileType?.includes("stl")) return { emoji: "🧊", colorClass: "stl" };
  if (ext === "zip" || ext === "rar" || ext === "7z") return { emoji: "📦", colorClass: "zip" };
  if (fileType?.includes("image") || ["jpg", "jpeg", "png", "svg"].includes(ext)) return { emoji: "🖼️", colorClass: "img" };
  if (ext === "dxf") return { emoji: "📐", colorClass: "dxf" };
  return { emoji: "📎", colorClass: "other" };
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ============================================================
   UPLOAD MODAL
   ============================================================ */

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DownloadCategory>("ostatni");
  const [access, setAccess] = useState<"public" | "authenticated">("public");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function validateFile(f: File): string | null {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Nepodporovaný typ souboru (.${ext}). Povolené: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (f.size > MAX_FILE_SIZE) {
      return `Soubor je příliš velký (${formatFileSize(f.size)}). Maximum je 50 MB.`;
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
    if (!file || !title.trim() || !user) return;

    setUploading(true);
    setError("");

    try {
      // 1. Upload souboru do storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("downloads")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      // 2. Získat public URL
      const { data: urlData } = supabase.storage
        .from("downloads")
        .getPublicUrl(filePath);

      // 3. Uložit záznam do DB
      const { error: dbErr } = await supabase.from("downloads").insert({
        title: title.trim(),
        description: description.trim() || null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
        category,
        access,
        uploaded_by: user.id,
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#1a1e2e",
          border: "1px solid #252838",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>
            ➕ Nahrát soubor
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#8a8ea0",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Název */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
              Název *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Např. Kolejový plán — Podhorské nádraží"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#1e2233",
                border: "1px solid #2a2f45",
                borderRadius: "8px",
                color: "#e0e0e0",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Popis */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
              Popis
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Volitelný popis souboru..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#1e2233",
                border: "1px solid #2a2f45",
                borderRadius: "8px",
                color: "#e0e0e0",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Kategorie */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
              Kategorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DownloadCategory)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#1e2233",
                border: "1px solid #2a2f45",
                borderRadius: "8px",
                color: "#e0e0e0",
                fontSize: "14px",
                outline: "none",
              }}
            >
              {CATEGORIES.filter(c => c.value !== "all").map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Přístup */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "8px", fontWeight: 500 }}>
              Přístup
            </label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#e0e0e0" }}>
                <input
                  type="radio"
                  name="access"
                  value="public"
                  checked={access === "public"}
                  onChange={() => setAccess("public")}
                  style={{ accentColor: "#f0a030" }}
                />
                🌐 Veřejné
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#e0e0e0" }}>
                <input
                  type="radio"
                  name="access"
                  value="authenticated"
                  checked={access === "authenticated"}
                  onChange={() => setAccess("authenticated")}
                  style={{ accentColor: "#f0a030" }}
                />
                🔒 Jen přihlášení
              </label>
            </div>
          </div>

          {/* Soubor — drag & drop */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#a0a4b8", marginBottom: "6px", fontWeight: 500 }}>
              Soubor *
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#f0a030" : "#2a2f45"}`,
                borderRadius: "12px",
                padding: "32px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.2s",
                background: dragOver ? "rgba(240,160,48,0.05)" : "transparent",
              }}
            >
              <input
                id="file-input"
                type="file"
                accept={ALLOWED_EXTENSIONS.map(e => `.${e}`).join(",")}
                onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
                style={{ display: "none" }}
              />
              {file ? (
                <div>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                    {getFileIcon(file.type, file.name).emoji}
                  </div>
                  <div style={{ fontSize: "14px", color: "#e0e0e0", fontWeight: 500 }}>{file.name}</div>
                  <div style={{ fontSize: "12px", color: "#6a6e80", marginTop: "4px" }}>
                    {formatFileSize(file.size)}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📁</div>
                  <div style={{ fontSize: "14px", color: "#8a8ea0" }}>
                    Přetáhněte soubor sem nebo klikněte pro výběr
                  </div>
                  <div style={{ fontSize: "12px", color: "#555a70", marginTop: "6px" }}>
                    PDF, STL, ZIP, RAR, 7Z, JPG, PNG, DXF, SVG · max 50 MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading || !file || !title.trim()}
            style={{
              width: "100%",
              padding: "12px",
              background: uploading || !file || !title.trim() ? "#353a50" : "#f0a030",
              color: uploading || !file || !title.trim() ? "#6a6e80" : "#0f1117",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: uploading || !file || !title.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {uploading ? "Nahrávám..." : "Nahrát soubor"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function DownloadsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<DownloadCategory | "all">("all");
  const [showUpload, setShowUpload] = useState(false);

  const isAdmin = profile?.role === "admin";

  const fetchDownloads = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure we have fresh auth session before querying
      await supabase.auth.getSession();

      let query = supabase
        .from("downloads")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeCategory !== "all") {
        query = query.eq("category", activeCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDownloads((data as Download[]) || []);
    } catch {
      // silently fail, show empty
      setDownloads([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    // Wait until auth state is resolved before fetching
    if (!authLoading) {
      fetchDownloads();
    }
  }, [fetchDownloads, authLoading]);

  async function handleDelete(dl: Download) {
    if (!confirm(`Opravdu smazat "${dl.title}"?`)) return;

    try {
      // 1. Smazat soubor ze storage
      const urlParts = dl.file_url.split("/downloads/");
      if (urlParts[1]) {
        const storagePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from("downloads").remove([storagePath]);
      }

      // 2. Smazat záznam z DB
      const { error } = await supabase.from("downloads").delete().eq("id", dl.id);
      if (error) throw error;

      fetchDownloads();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba při mazání");
    }
  }

  async function handleDownload(dl: Download) {
    // Increment counter
    try {
      await supabase.rpc("increment_download_count", { download_id: dl.id });
    } catch {
      // don't block download if counter fails
    }

    // Force download — fetch as blob to bypass browser preview
    try {
      const res = await fetch(dl.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dl.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback — otevřít v novém tabu
      window.open(dl.file_url, "_blank");
    }

    // Refresh to show updated count (longer delay to avoid race with auth)
    setTimeout(() => fetchDownloads(), 1500);
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
            <span style={{ color: "#fff" }}>Ke </span>
            <span style={{ color: "#f0a030" }}>stažení</span>
          </h1>
          <p style={{ fontSize: "15px", color: "#8a8ea0" }}>
            Kolejové plány, STL modely, návody a další soubory ke stažení
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            style={{
              padding: "10px 20px",
              background: "#f0a030",
              color: "#0f1117",
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
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ffb84d")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f0a030")}
          >
            ➕ Nahrát soubor
          </button>
        )}
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px", flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              style={{
                padding: "8px 16px",
                background: isActive ? "rgba(240,160,48,0.15)" : "#1a1e2e",
                border: `1px solid ${isActive ? "#f0a030" : "#252838"}`,
                borderRadius: "8px",
                color: isActive ? "#f0a030" : "#a0a4b8",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          );
        })}
      </div>

      {/* Downloads grid */}
      {loading || authLoading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "#6a6e80", fontSize: "14px" }}>Načítám soubory...</p>
        </div>
      ) : downloads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📂</div>
          <p style={{ color: "#8a8ea0", fontSize: "16px", marginBottom: "4px" }}>Žádné soubory k zobrazení</p>
          <p style={{ color: "#555a70", fontSize: "13px" }}>
            {activeCategory !== "all" ? "Zkuste jinou kategorii" : "Zatím nebyly nahrány žádné soubory"}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {downloads.map((dl) => {
            const icon = getFileIcon(dl.file_type, dl.file_name);
            const ext = dl.file_name.split(".").pop()?.toUpperCase() || "";
            const needsAuth = dl.access === "authenticated" && !user;

            return (
              <div
                key={dl.id}
                style={{
                  background: "#1a1e2e",
                  border: "1px solid #252838",
                  borderRadius: "12px",
                  padding: "20px",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#353a50";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#252838";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Top row: icon + info */}
                <div style={{ display: "flex", gap: "14px", flex: 1 }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      flexShrink: 0,
                      background:
                        icon.colorClass === "pdf" ? "rgba(220,53,69,0.15)" :
                        icon.colorClass === "stl" ? "rgba(32,201,151,0.15)" :
                        icon.colorClass === "zip" ? "rgba(102,126,234,0.15)" :
                        icon.colorClass === "img" ? "rgba(240,160,48,0.15)" :
                        icon.colorClass === "dxf" ? "rgba(160,100,220,0.15)" :
                        "rgba(138,142,160,0.15)",
                    }}
                  >
                    {icon.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#e0e0e0", marginBottom: "4px", lineHeight: 1.4 }}>
                      {dl.title}
                    </h3>
                    {dl.description && (
                      <p style={{ fontSize: "13px", color: "#6a6e80", lineHeight: 1.4, marginBottom: "8px" }}>
                        {dl.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#555a70", background: "#1e2233", padding: "2px 8px", borderRadius: "4px" }}>
                        {ext}
                      </span>
                      <span style={{ fontSize: "11px", color: "#555a70" }}>
                        {formatFileSize(dl.file_size)}
                      </span>
                      <span style={{ fontSize: "11px", color: "#555a70" }}>
                        ⬇️ {dl.download_count}×
                      </span>
                      {dl.access === "authenticated" && (
                        <span style={{ fontSize: "11px", color: "#f0a030" }}>
                          🔒 Pro přihlášené
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Download button + admin delete */}
                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #252838", display: "flex", gap: "8px" }}>
                  {needsAuth ? (
                    <a
                      href="/prihlaseni"
                      style={{
                        display: "block",
                        textAlign: "center",
                        padding: "10px",
                        flex: 1,
                        background: "rgba(240,160,48,0.1)",
                        border: "1px solid rgba(240,160,48,0.3)",
                        borderRadius: "8px",
                        color: "#f0a030",
                        fontSize: "13px",
                        fontWeight: 500,
                        textDecoration: "none",
                        transition: "background 0.2s",
                      }}
                    >
                      🔒 Přihlaste se pro stažení
                    </a>
                  ) : (
                    <button
                      onClick={() => handleDownload(dl)}
                      style={{
                        display: "block",
                        flex: 1,
                        padding: "10px",
                        background: "rgba(240,160,48,0.15)",
                        border: "1px solid rgba(240,160,48,0.3)",
                        borderRadius: "8px",
                        color: "#f0a030",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(240,160,48,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(240,160,48,0.15)";
                      }}
                    >
                      ⬇️ Stáhnout
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(dl)}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(220,53,69,0.1)",
                        border: "1px solid rgba(220,53,69,0.3)",
                        borderRadius: "8px",
                        color: "#ff6b6b",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(220,53,69,0.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(220,53,69,0.1)";
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => fetchDownloads()}
        />
      )}
    </div>
  );
}
