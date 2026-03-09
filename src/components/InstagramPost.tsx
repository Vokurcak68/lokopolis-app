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
  const MAX_HASHTAGS = 5;

  // Always include #lokopolis as the first one
  const result = ["#lokopolis"];

  // Add one category-specific hashtag
  const categoryMap: Record<string, string> = {
    "Stavba kolejiště": "#kolejiste",
    "Recenze modelů": "#recenze",
    "Návody & tipy": "#navody",
    "Krajina & scenérie": "#scenerie",
    "Digitální řízení": "#dcc",
    "Přestavby": "#kitbashing",
    "Kolejové plány": "#trackplan",
    "Modelové domy": "#modelovedomy",
    "Nátěry a patina": "#weathering",
    "Osvětlení": "#osvetleni",
    "3D tisk": "#3dtisk",
    "Ze světa": "#modelrailway",
  };

  if (categoryName && categoryMap[categoryName]) {
    result.push(categoryMap[categoryName]);
  }

  // Fill remaining slots with article tags
  const tagHashtags = tags
    .map((t) => "#" + t.name.toLowerCase().replace(/\s+/g, "").replace(/[^\wěščřžýáíéúůďťňó]/g, ""))
    .filter((h) => !result.includes(h));

  for (const h of tagHashtags) {
    if (result.length >= MAX_HASHTAGS) break;
    result.push(h);
  }

  return result.join(" ");
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
    `🔗 Odkaz na článek v biu 👆`,
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

  async function fetchAsFile(url: string, index: number): Promise<File> {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    return new File([blob], `lokopolis-${index + 1}.${ext}`, { type: blob.type });
  }

  // Share via Web Share API (saves to Photos on iOS) or fallback to download
  async function handleSaveImage(url: string, index: number) {
    setDownloading(true);
    try {
      const file = await fetchAsFile(url, index);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Fallback: classic download
        const blobUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // User cancelled share — not an error
    }
    setDownloading(false);
  }

  async function handleSaveAll() {
    setDownloading(true);
    try {
      const files = await Promise.all(allImages.map((img, i) => fetchAsFile(img.url, i)));
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files });
      } else {
        // Fallback: download one by one
        for (const file of files) {
          const blobUrl = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } catch {
      // User cancelled
    }
    setDownloading(false);
  }

  const [step, setStep] = useState<1 | 2>(1);

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
                  onClick={() => handleSaveImage(currentImage.url, selectedIdx)}
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
                  {downloading ? "⏳ Ukládám..." : `📤 Uložit tento (${currentImage.label})`}
                </button>
                {allImages.length > 1 && (
                  <button
                    onClick={handleSaveAll}
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
                    📤 Všechny ({allImages.length})
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

          {/* Step indicator */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <div
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                textAlign: "center",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                background: step === 1 ? "#f0a030" : "var(--bg-surface)",
                color: step === 1 ? "#000" : "var(--text-body)",
                border: step === 1 ? "1px solid #f0a030" : "1px solid var(--border-color)",
              }}
            >
              1️⃣ Obrázky
            </div>
            <div
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                textAlign: "center",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                background: step === 2 ? "#f0a030" : "var(--bg-surface)",
                color: step === 2 ? "#000" : "var(--text-body)",
                border: step === 2 ? "1px solid #f0a030" : "1px solid var(--border-color)",
              }}
            >
              2️⃣ Text
            </div>
          </div>

          {step === 2 && (
            <>
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

              <button
                onClick={handleCopy}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "none",
                  background: copied ? "#22c55e" : "#f0a030",
                  color: copied ? "#fff" : "#000",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {copied ? "✅ Zkopírováno! Vlož do Instagramu" : "📋 Kopírovat text do schránky"}
              </button>
            </>
          )}

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
              {step === 1 ? (
                <>
                  <strong>Krok 1:</strong> Ulož obrázky do fotek (📤 → „Uložit obrázek")<br />
                  IG karusel = až 10 fotek. Pak klikni na <strong>2️⃣ Text</strong>
                </>
              ) : (
                <>
                  <strong>Krok 2:</strong> Zkopíruj text → otevři Instagram →<br />
                  Nový příspěvek → vyber obrázky z fotek →<br />
                  vlož text ze schránky → Publikuj 🎉<br /><br />
                  💡 <strong>Tip:</strong> V IG profilu dej do pole Web:<br />
                  <code style={{ fontSize: "12px", background: "rgba(240,160,48,0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                    lokopolis.cz/links
                  </code>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
