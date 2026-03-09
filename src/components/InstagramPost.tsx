"use client";

import { useState } from "react";
import Image from "next/image";

interface InstagramPostProps {
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  categoryName: string | null;
  tags: { name: string }[];
  articleUrl: string;
  onClose: () => void;
}

function generateHashtags(categoryName: string | null, tags: { name: string }[]): string {
  const base = ["#lokopolis", "#modelovaželezniceˇ", "#modelarství", "#kolejiště"];
  
  const categoryMap: Record<string, string[]> = {
    "Stavba kolejiště": ["#stavbakolejiste", "#modelovékolejiste"],
    "Recenze modelů": ["#recenze", "#modelyvlaků"],
    "Návody & tipy": ["#navody", "#tipy", "#diy"],
    "Krajina & scenérie": ["#krajina", "#scenerie", "#diorama"],
    "Digitální řízení": ["#dcc", "#digitalnirizeni"],
    "Přestavby": ["#prestavby", "#kitbashing"],
    "Kolejové plány": ["#kolejovéplány", "#trackplan"],
    "Modelové domy": ["#modelovedomy", "#budovy"],
    "Nátěry a patina": ["#weathering", "#patina", "#airbrush"],
    "Osvětlení": ["#osvetleni", "#led", "#modeloveosvetleni"],
    "3D tisk": ["#3dtisk", "#3dprint", "#stl"],
    "Ze světa": ["#zesveta", "#modelrailway"],
  };

  const catTags = categoryName ? (categoryMap[categoryName] || []) : [];
  
  const tagHashtags = tags
    .slice(0, 5)
    .map((t) => "#" + t.name.toLowerCase().replace(/\s+/g, "").replace(/[^\wěščřžýáíéúůďťňó]/g, ""));

  const all = [...new Set([...base, ...catTags, ...tagHashtags])];
  return all.join(" ");
}

export default function InstagramPost({
  title,
  excerpt,
  coverUrl,
  categoryName,
  tags,
  articleUrl,
  onClose,
}: InstagramPostProps) {
  const [copied, setCopied] = useState(false);

  const hashtags = generateHashtags(categoryName, tags);
  
  const postText = [
    `📰 ${title}`,
    "",
    excerpt || "",
    "",
    `👉 Celý článek na lokopolis.cz`,
    `🔗 ${articleUrl}`,
    "",
    hashtags,
  ]
    .filter((line) => line !== null)
    .join("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = postText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleDownloadImage() {
    if (!coverUrl) return;
    try {
      const res = await fetch(coverUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lokopolis-${title.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(coverUrl, "_blank");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "0",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              📸 Instagram Post
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-body)",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Preview */}
        <div style={{ padding: "20px" }}>
          {/* Image preview */}
          {coverUrl ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "1",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "16px",
                background: "#1a1a2e",
              }}
            >
              <Image
                src={coverUrl}
                alt={title}
                fill
                style={{ objectFit: "cover" }}
                sizes="480px"
              />
              {/* Download overlay */}
              <button
                onClick={handleDownloadImage}
                style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "10px",
                  background: "rgba(0,0,0,0.7)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                ⬇️ Stáhnout obrázek
              </button>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "8px",
                background: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                color: "var(--text-body)",
                fontSize: "14px",
              }}
            >
              Článek nemá cover obrázek — přidej ho v editoru
            </div>
          )}

          {/* Text preview */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "var(--text-body)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {postText}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: copied ? "#22c55e" : "#f0a030",
                color: copied ? "#fff" : "#000",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              {copied ? "✅ Zkopírováno!" : "📋 Kopírovat text"}
            </button>
          </div>

          {/* Instructions */}
          <div
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              background: "rgba(240, 160, 48, 0.08)",
              borderRadius: "8px",
              border: "1px solid rgba(240, 160, 48, 0.15)",
            }}
          >
            <p style={{ fontSize: "13px", color: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>
              <strong>Postup:</strong><br />
              1. Stáhni cover obrázek<br />
              2. Zkopíruj text<br />
              3. Otevři Instagram → Nový příspěvek<br />
              4. Vyber stažený obrázek, vlož text<br />
              5. Publikuj 🎉
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
