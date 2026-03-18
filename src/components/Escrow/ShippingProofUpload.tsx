"use client";

import { useState, useRef, useCallback } from "react";

const CARRIER_INSTRUCTIONS: Record<string, string> = {
  "ceska-posta": '📸 Screenshot z appky „Moje zásilky" nebo foto podacího lístku z pobočky. Musí být viditelné tracking číslo a datum podání.',
  "zasilkovna": '📸 Screenshot z appky Zásilkovna → „Moje zásilky" s číslem zásilky a stavem „Podáno", nebo screenshot potvrzovacího emailu.',
  "ppl": "📸 Screenshot potvrzovacího emailu od PPL nebo foto příjmového lístku z ParcelShopu.",
  "dpd": "📸 Screenshot z appky myDPD s detailem zásilky, nebo screenshot potvrzovacího emailu.",
  "gls": "📸 Foto příjmového lístku z ParcelShopu nebo screenshot potvrzovacího emailu.",
  "geis": "📸 Foto přepravního listu (CMR) nebo screenshot potvrzovacího emailu.",
};

const DEFAULT_INSTRUCTION = "📸 Foto podacího lístku nebo screenshot potvrzení o odeslání zásilky.";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILES = 2;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

interface ShippingProofUploadProps {
  carrier: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function ShippingProofUpload({ carrier, files, onFilesChange }: ShippingProofUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const instruction = CARRIER_INSTRUCTIONS[carrier] || DEFAULT_INSTRUCTION;

  const validateAndAdd = useCallback((newFiles: FileList | File[]) => {
    setError("");
    const incoming = Array.from(newFiles);
    const total = files.length + incoming.length;

    if (total > MAX_FILES) {
      setError(`Maximálně ${MAX_FILES} soubory. Aktuálně: ${files.length}.`);
      return;
    }

    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`Nepodporovaný formát: ${f.name}. Povolené: JPG, PNG, WebP.`);
        return;
      }
      if (f.size > MAX_SIZE) {
        setError(`Soubor ${f.name} je příliš velký (max 5 MB).`);
        return;
      }
    }

    onFilesChange([...files, ...incoming]);
  }, [files, onFilesChange]);

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next);
    setError("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAdd(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>
        Foto důkazu odeslání (volitelné, max {MAX_FILES})
      </label>

      {/* Carrier-specific instruction */}
      {carrier && (
        <div style={{
          padding: "10px 12px",
          borderRadius: "8px",
          background: "rgba(240,160,48,0.08)",
          border: "1px solid rgba(240,160,48,0.2)",
          marginBottom: "10px",
          fontSize: "12px",
          color: "var(--text-body)",
          lineHeight: 1.5,
        }}>
          {instruction}
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          {files.map((file, i) => (
            <div key={i} style={{ position: "relative", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={`Důkaz ${i + 1}`}
                style={{
                  width: "120px",
                  height: "90px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              />
              <button
                onClick={() => removeFile(i)}
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                  lineHeight: "22px",
                  textAlign: "center",
                }}
              >
                ✕
              </button>
              <div style={{ fontSize: "10px", color: "var(--text-dimmer)", marginTop: "2px", textAlign: "center", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {files.length < MAX_FILES && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                validateAndAdd(e.target.files);
              }
              // Reset input so same file can be re-selected
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={{ display: "none" }}
          />
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              border: `2px dashed ${dragOver ? "rgba(240,160,48,0.6)" : "var(--border)"}`,
              background: dragOver ? "rgba(240,160,48,0.05)" : "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "13px",
              textAlign: "center",
              transition: "all 0.2s",
            }}
          >
            📷 Přetáhněte fotku sem nebo klikněte pro výběr
            <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "4px" }}>
              JPG, PNG, WebP · max 5 MB
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: "6px",
          padding: "8px 12px",
          borderRadius: "6px",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          color: "#ef4444",
          fontSize: "12px",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
