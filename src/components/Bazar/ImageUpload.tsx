"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";

const MAX_IMAGES = 8;
const MAX_SIZE_MB = 5;

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  listingId?: string;
}

export default function ImageUpload({ images, onChange, listingId }: ImageUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!user) {
        setError("Musíte být přihlášeni");
        return;
      }

      const fileArray = Array.from(files);
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        setError(`Maximum je ${MAX_IMAGES} fotek`);
        return;
      }

      const toUpload = fileArray.slice(0, remaining);
      const oversized = toUpload.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
      if (oversized.length > 0) {
        setError(`Některé soubory jsou větší než ${MAX_SIZE_MB} MB`);
        return;
      }

      const invalidType = toUpload.filter(
        (f) => !f.type.startsWith("image/")
      );
      if (invalidType.length > 0) {
        setError("Povoleny jsou pouze obrázky");
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const newUrls: string[] = [];
        const uploadId = listingId || crypto.randomUUID();

        for (const file of toUpload) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const fileName = `${user.id}/${uploadId}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("bazar")
            .upload(fileName, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("bazar").getPublicUrl(fileName);

          newUrls.push(publicUrl);
        }

        onChange([...images, ...newUrls]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Chyba při nahrávání"
        );
      } finally {
        setUploading(false);
      }
    },
    [user, images, onChange, listingId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const updated = [...images];
      updated.splice(index, 1);
      onChange(updated);
    },
    [images, onChange]
  );

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItemRef.current = index;
  };

  const handleDragEnd = () => {
    if (
      dragItemRef.current !== null &&
      dragOverItemRef.current !== null &&
      dragItemRef.current !== dragOverItemRef.current
    ) {
      const updated = [...images];
      const dragItem = updated[dragItemRef.current];
      updated.splice(dragItemRef.current, 1);
      updated.splice(dragOverItemRef.current, 0, dragItem);
      onChange(updated);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${
            dragOver ? "var(--accent)" : "var(--border)"
          }`,
          borderRadius: "12px",
          padding: "32px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver
            ? "rgba(240,160,48,0.05)"
            : "var(--bg-input)",
          transition: "all 0.2s",
          marginBottom: "16px",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <div style={{ color: "var(--accent)", fontSize: "14px" }}>
            ⏳ Nahrávám fotky...
          </div>
        ) : (
          <>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📷</div>
            <div
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Přetáhněte sem fotky nebo klikněte pro výběr
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>
              Max {MAX_IMAGES} fotek, max {MAX_SIZE_MB} MB každá • První fotka = hlavní
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#ef4444",
            background: "rgba(239,68,68,0.1)",
            marginBottom: "12px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "8px",
          }}
        >
          {images.map((url, index) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={{
                position: "relative",
                borderRadius: "8px",
                overflow: "hidden",
                border: `2px solid ${
                  index === 0 ? "var(--accent)" : "var(--border)"
                }`,
                aspectRatio: "4/3",
                cursor: "grab",
                background: "var(--bg-page)",
              }}
            >
              <Image
                src={url.replace("/object/public/", "/render/image/public/").concat("?width=200&quality=75")}
                alt={`Fotka ${index + 1}`}
                fill
                style={{ objectFit: "contain" }}
                sizes="120px"
              />
              {index === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "4px",
                    left: "4px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 600,
                    background: "var(--accent)",
                    color: "#000",
                  }}
                >
                  Hlavní
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
