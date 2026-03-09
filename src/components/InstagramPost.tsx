"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

interface InstagramPostProps {
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  categoryName: string | null;
  tags: { name: string }[];
  articleUrl: string;
  articleContent: string | null;
  onClose: () => void;
}

function generateHashtags(categoryName: string | null, tags: { name: string }[]): string {
  const base = ["#lokopolis", "#modelováželeznice", "#modelářství", "#kolejiště"];
  
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

function extractImagesFromHtml(html: string | null): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1] && !match[1].startsWith("data:")) {
      urls.push(match[1]);
    }
  }
  return urls;
}

export default function InstagramPost({
  title,
  excerpt,
  coverUrl,
  categoryName,
  tags,
  articleUrl,
  articleContent,
  onClose,
}: InstagramPostProps) {
  const [copied, setCopied] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);

  // Collect all images: cover first, then content images (deduplicated)
  const allImages = useMemo(() => {
    const contentImages = extractImagesFromHtml(articleContent);
    const images: { url: string; label: string }[] = [];
    
    if (coverUrl) {
      images.push({ url: coverUrl, label: "Cover" });
    }
    
    contentImages.forEach((url, i) => {
      if (url !== coverUrl) {
        images.push({ url, label: `Obrázek ${i + 1}` });
      }
    });
    
    return images;
  }, [coverUrl, articleContent]);

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

  async function handleDownloadImage(url: string, index: number) {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = blob.type.includes("png") ? "png" : "jpg";
      a.download = `lokopolis-${title.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}-${index + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
    setDownloading(false);
  }

  async function handleDownloadAll() {
    setDownloading(true);
    for (let i = 0; i < allImages.length; i++) {
      await handleDownloadImage(allImages[i].url, i);
      // Small delay between downloads
      if (i < allImages.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setDownloading(false);
  }

  async function handleShare() {
    try {
      // Fetch the current image as a File for sharing
      const res = await fetch(currentImage.url);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const file = new File([blob], `lokopolis-post.${ext}`, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text: postText,
          files: [file],
        });
      } else {
        // Fallback — share without image
        await navigator.share({
          title,
          text: postText,
        });
      }
    } catch {
      // User cancelled or share failed — ignore
    }
  }

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const currentImage = allImages[selectedIdx];

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
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            📸 Instagram Post
          </span>
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

          {/* Image carousel */}
          {allImages.length > 0 ? (
            <div style={{ marginBottom: "16px" }}>
              {/* Main image */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#1a1a2e",
                }}
              >
                <Image
                  src={currentImage.url}
                  alt={currentImage.label}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="480px"
                />
                {/* Image counter */}
                {allImages.length > 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      borderRadius: "12px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {selectedIdx + 1} / {allImages.length}
                  </div>
                )}
                {/* Nav arrows */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedIdx((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))}
                      style={{
                        position: "absolute",
                        left: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        fontSize: "16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setSelectedIdx((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        fontSize: "16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginTop: "10px",
                    overflowX: "auto",
                    paddingBottom: "4px",
                  }}
                >
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      style={{
                        position: "relative",
                        width: "56px",
                        height: "56px",
                        borderRadius: "6px",
                        overflow: "hidden",
                        border: i === selectedIdx ? "2px solid #f0a030" : "2px solid transparent",
                        flexShrink: 0,
                        cursor: "pointer",
                        opacity: i === selectedIdx ? 1 : 0.6,
                        transition: "all 0.15s",
                        padding: 0,
                        background: "none",
                      }}
                    >
                      <Image
                        src={img.url}
                        alt={img.label}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="56px"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Download buttons */}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  onClick={() => handleDownloadImage(currentImage.url, selectedIdx)}
                  disabled={downloading}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-surface)",
                    color: "var(--text-body)",
                    fontSize: "13px",
                    cursor: "pointer",
                    opacity: downloading ? 0.6 : 1,
                  }}
                >
                  ⬇️ Stáhnout tento ({currentImage.label})
                </button>
                {allImages.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloading}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid #f0a030",
                      background: "rgba(240, 160, 48, 0.1)",
                      color: "#f0a030",
                      fontSize: "13px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      opacity: downloading ? 0.6 : 1,
                    }}
                  >
                    ⬇️ Všechny ({allImages.length})
                  </button>
                )}
              </div>
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
              Článek nemá žádné obrázky — přidej je v editoru
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

          {/* Action buttons */}
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
            {canShare && (
              <button
                onClick={handleShare}
                style={{
                  padding: "12px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                📤 Sdílet
              </button>
            )}
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
              1. Stáhni obrázky (jeden nebo všechny — IG umí karusel)<br />
              2. Zkopíruj text<br />
              3. Otevři Instagram → Nový příspěvek<br />
              4. Vyber obrázky, vlož text<br />
              5. Publikuj 🎉
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
