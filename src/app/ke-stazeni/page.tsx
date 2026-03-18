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

function getFileIcon(fileType: string | null, fileName: string): { icon: React.ReactNode; colorClass: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  // SVG icons for a cleaner, more professional look
  const svgStyle = { width: "28px", height: "28px" };
  if (fileType?.includes("pdf") || ext === "pdf") return {
    icon: <svg style={svgStyle} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h1.5a1.5 1.5 0 000-3H9v6"/><path d="M15 12h2"/><path d="M15 15h1"/></svg>,
    colorClass: "pdf"
  };
  if (ext === "stl" || fileType?.includes("stl")) return {
    icon: <svg style={svgStyle} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    colorClass: "stl"
  };
  if (ext === "zip" || ext === "rar" || ext === "7z") return {
    icon: <svg style={svgStyle} viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V3h13"/><path d="M12 3v4h4"/><rect x="9" y="13" width="6" height="4" rx="1"/><line x1="12" y1="13" x2="12" y2="11"/></svg>,
    colorClass: "zip"
  };
  if (fileType?.includes("image") || ["jpg", "jpeg", "png", "svg"].includes(ext)) return {
    icon: <svg style={svgStyle} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    colorClass: "img"
  };
  if (ext === "dxf") return {
    icon: <svg style={svgStyle} viewBox="0 0 24 24" fill="none" stroke="#a064dc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    colorClass: "dxf"
  };
  return {
    icon: <svg style={svgStyle} viewBox="0 0 24 24" fill="none" stroke="#8a8ea0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    colorClass: "other"
  };
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
            ➕ Nahrát soubor
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
          {/* Název */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
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
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Popis */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
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
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Kategorie */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
              Kategorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DownloadCategory)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
                borderRadius: "8px",
                color: "var(--text-body)",
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
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 500 }}>
              Přístup
            </label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "var(--text-body)" }}>
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
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "var(--text-body)" }}>
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

          {/* Soubor — drag & drop */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
              Soubor *
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-input)"}`,
                borderRadius: "12px",
                padding: "32px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.2s",
                background: dragOver ? "var(--accent-bg-subtle)" : "transparent",
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
                    {getFileIcon(file.type, file.name).icon}
                  </div>
                  <div style={{ fontSize: "14px", color: "var(--text-body)", fontWeight: 500 }}>{file.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "4px" }}>
                    {formatFileSize(file.size)}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📁</div>
                  <div style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                    Přetáhněte soubor sem nebo klikněte pro výběr
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "6px" }}>
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
              background: "var(--danger-bg)",
              border: "1px solid rgba(220,53,69,0.3)",
              borderRadius: "8px",
              color: "var(--danger)",
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
              background: uploading || !file || !title.trim() ? "var(--border-hover)" : "var(--accent)",
              color: uploading || !file || !title.trim() ? "var(--text-dimmer)" : "var(--accent-text-on)",
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
            <span style={{ color: "var(--text-primary)" }}>Ke </span>
            <span style={{ color: "var(--accent)" }}>stažení</span>
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
            Kolejové plány, STL modely, návody a další soubory ke stažení
          </p>
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
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
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
              {cat.icon} {cat.label}
            </button>
          );
        })}
      </div>

      {/* Downloads grid */}
      {loading || authLoading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám soubory...</p>
        </div>
      ) : downloads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📂</div>
          <p style={{ color: "var(--text-dim)", fontSize: "16px", marginBottom: "4px" }}>Žádné soubory k zobrazení</p>
          <p style={{ color: "var(--text-faint)", fontSize: "13px" }}>
            {activeCategory !== "all" ? "Zkuste jinou kategorii" : "Zatím nebyly nahrány žádné soubory"}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
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
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "14px",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-hover)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
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
                      flexShrink: 0,
                      background:
                        icon.colorClass === "pdf" ? "var(--danger-bg)" :
                        icon.colorClass === "stl" ? "var(--success-bg)" :
                        icon.colorClass === "zip" ? "rgba(102,126,234,0.15)" :
                        icon.colorClass === "img" ? "var(--accent-border)" :
                        icon.colorClass === "dxf" ? "rgba(160,100,220,0.15)" :
                        "rgba(138,142,160,0.15)",
                    }}
                  >
                    {icon.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px", lineHeight: 1.4 }}>
                      {dl.title}
                    </h3>
                    {dl.description && (
                      <p style={{ fontSize: "13px", color: "var(--text-dimmer)", lineHeight: 1.4, marginBottom: "8px" }}>
                        {dl.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-faint)", background: "var(--bg-input)", padding: "2px 8px", borderRadius: "4px" }}>
                        {ext}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>
                        {formatFileSize(dl.file_size)}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>
                        ⬇️ {dl.download_count}×
                      </span>
                      {dl.access === "authenticated" && (
                        <span style={{ fontSize: "11px", color: "var(--accent)" }}>
                          🔒 Pro přihlášené
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Download button + admin delete */}
                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
                  {needsAuth ? (
                    <a
                      href="/prihlaseni"
                      style={{
                        display: "block",
                        textAlign: "center",
                        padding: "10px",
                        flex: 1,
                        background: "var(--accent-bg)",
                        border: "1px solid var(--accent-border-strong)",
                        borderRadius: "8px",
                        color: "var(--accent)",
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
                        background: "var(--accent-bg)",
                        border: "1px solid var(--accent-border-strong)",
                        borderRadius: "8px",
                        color: "var(--accent)",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--accent-border)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--accent-border)";
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
                        background: "var(--danger-bg)",
                        border: "1px solid rgba(220,53,69,0.3)",
                        borderRadius: "8px",
                        color: "var(--danger)",
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
                        e.currentTarget.style.background = "var(--danger-bg)";
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
