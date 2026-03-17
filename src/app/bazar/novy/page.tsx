"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import ImageUpload from "@/components/Bazar/ImageUpload";
import type { ListingCategory, ListingCondition, ListingScale } from "@/types/database";

const CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: "lokomotivy", label: "🚂 Lokomotivy" },
  { value: "vagony", label: "🚃 Vagóny" },
  { value: "koleje", label: "🛤️ Koleje" },
  { value: "prislusenstvi", label: "🔧 Příslušenství" },
  { value: "budovy", label: "🏠 Budovy" },
  { value: "elektronika", label: "⚡ Elektronika" },
  { value: "literatura", label: "📚 Literatura" },
  { value: "kolejiste", label: "🗺️ Kolejiště" },
  { value: "ostatni", label: "📦 Ostatní" },
];

const SCALES: { value: ListingScale; label: string }[] = [
  { value: "TT", label: "TT (1:120)" },
  { value: "H0", label: "H0 (1:87)" },
  { value: "N", label: "N (1:160)" },
  { value: "Z", label: "Z (1:220)" },
  { value: "G", label: "G (1:22.5)" },
  { value: "0", label: "0 (1:45)" },
  { value: "1", label: "1 (1:32)" },
  { value: "other", label: "Jiné" },
];

const CONDITIONS: { value: ListingCondition; label: string; color: string }[] = [
  { value: "new", label: "Nový", color: "#22c55e" },
  { value: "opened", label: "Rozbalený", color: "#3b82f6" },
  { value: "used", label: "Použitý", color: "#f59e0b" },
  { value: "parts", label: "Na díly", color: "#ef4444" },
];

const BRAND_SUGGESTIONS = [
  "Tillig", "Roco", "Piko", "Fleischmann", "Märklin", "Arnold",
  "Brawa", "ESU", "Lenz", "Viessmann", "Faller", "Noch",
  "Auhagen", "Kibri", "Vollmer", "Kuehn", "Kato", "Tomix",
  "Lima", "Rivarossi", "Hornby", "Bachmann", "MTB",
];

export default function NewListingPageWrapper() {
  return (
    <Suspense fallback={<div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 20px", textAlign: "center", color: "var(--text-dimmer)" }}>⏳ Načítám...</div>}>
      <NewListingPage />
    </Suspense>
  );
}

function NewListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<ListingCategory | "">("");
  const [scale, setScale] = useState<ListingScale | "">("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<ListingCondition>("used");
  const [location, setLocation] = useState("");
  const [shipping, setShipping] = useState(true);
  const [personalPickup, setPersonalPickup] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/prihlaseni");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setShowBrandSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load data from existing listing (copy)
  useEffect(() => {
    const copyId = searchParams.get("copy");
    if (!copyId) return;

    supabase
      .from("listings")
      .select("*")
      .eq("id", copyId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setTitle(data.title + " (kopie)");
        setDescription(data.description || "");
        setPrice(String(data.price || ""));
        setCategory(data.category || "");
        setScale(data.scale || "");
        setBrand(data.brand || "");
        setCondition(data.condition || "used");
        setLocation(data.location || "");
        setShipping(data.shipping ?? true);
        setPersonalPickup(data.personal_pickup ?? true);
        // Images are NOT copied — user should upload new ones
      });
  }, [searchParams]);

  const filteredBrands = brand
    ? BRAND_SUGGESTIONS.filter((b) =>
        b.toLowerCase().includes(brand.toLowerCase())
      )
    : BRAND_SUGGESTIONS;

  async function handleSubmit() {
    if (!user) return;

    // Validation
    if (!title.trim()) {
      setError("Vyplňte název inzerátu");
      return;
    }
    if (!price || parseInt(price) <= 0) {
      setError("Zadejte platnou cenu");
      return;
    }
    if (!category) {
      setError("Vyberte kategorii");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from("listings")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          price: parseInt(price),
          condition,
          scale: scale || null,
          brand: brand.trim() || null,
          category,
          images,
          seller_id: user.id,
          location: location.trim() || null,
          shipping,
          personal_pickup: personalPickup,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      router.push(`/bazar/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při vytváření inzerátu");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>⏳ Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <Link href="/bazar" style={{ color: "var(--text-dimmer)", textDecoration: "none", fontSize: "13px" }}>
          ← Zpět na bazar
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginTop: "12px" }}>
          <span style={{ color: "var(--text-primary)" }}>Nový </span>
          <span style={{ color: "var(--accent)" }}>inzerát</span>
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            fontSize: "14px",
            marginBottom: "20px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Název inzerátu *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="např. Tillig TT lokomotiva BR 218"
            maxLength={200}
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Popis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Podrobný popis stavu, historie, příslušenství..."
            rows={5}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Price + Category row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Cena (Kč) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min={1}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Kategorie *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ListingCategory)}
              style={inputStyle}
            >
              <option value="">Vyberte kategorii</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scale + Brand row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Měřítko</label>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value as ListingScale)}
              style={inputStyle}
            >
              <option value="">Nevybráno</option>
              {SCALES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div ref={brandRef} style={{ position: "relative" }}>
            <label style={labelStyle}>Značka</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setShowBrandSuggestions(true);
              }}
              onFocus={() => setShowBrandSuggestions(true)}
              placeholder="Tillig, Roco, Piko..."
              style={inputStyle}
            />
            {showBrandSuggestions && filteredBrands.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 10,
                  marginTop: "4px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {filteredBrands.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setBrand(b);
                      setShowBrandSuggestions(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      color: "var(--text-body)",
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--accent-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Condition */}
        <div>
          <label style={labelStyle}>Stav *</label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCondition(c.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `2px solid ${condition === c.value ? c.color : "var(--border)"}`,
                  background: condition === c.value ? `${c.color}15` : "transparent",
                  color: condition === c.value ? c.color : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label style={labelStyle}>Lokace</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="např. Praha, Brno, Olomouc..."
            style={inputStyle}
          />
        </div>

        {/* Shipping options */}
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--text-body)" }}>
            <input
              type="checkbox"
              checked={shipping}
              onChange={(e) => setShipping(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            📦 Nabízím zaslání
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--text-body)" }}>
            <input
              type="checkbox"
              checked={personalPickup}
              onChange={(e) => setPersonalPickup(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            🤝 Osobní předání
          </label>
        </div>

        {/* Images */}
        <div>
          <label style={labelStyle}>Fotky</label>
          <ImageUpload images={images} onChange={setImages} />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Doporučená velikost: 800 × 600 px (4:3)</p>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "14px 32px",
              background: submitting ? "var(--border-hover)" : "var(--accent)",
              color: submitting ? "var(--text-dimmer)" : "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              flex: 1,
            }}
          >
            {submitting ? "⏳ Vytvářím inzerát..." : "🚀 Zveřejnit inzerát"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-input)",
  borderRadius: "8px",
  color: "var(--text-body)",
  fontSize: "14px",
  outline: "none",
};
