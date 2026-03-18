"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import ImageUpload from "@/components/Bazar/ImageUpload";
import type { Listing, ListingCategory, ListingCondition, ListingScale } from "@/types/database";

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

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const listingId = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cash", "transfer"]);
  const [escrowCommission, setEscrowCommission] = useState<{rate: number, min: number} | null>(null);
  const [showEscrowConfirm, setShowEscrowConfirm] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  const fetchListing = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (fetchError || !data) {
        router.push("/bazar");
        return;
      }

      const l = data as Listing;
      setListing(l);
      setTitle(l.title);
      setDescription(l.description || "");
      setPrice(l.price.toString());
      setCategory(l.category);
      setScale(l.scale || "");
      setBrand(l.brand || "");
      setCondition(l.condition);
      setLocation(l.location || "");
      setShipping(l.shipping);
      setPersonalPickup(l.personal_pickup);
      setImages(l.images || []);
      setPaymentMethods(l.payment_methods && l.payment_methods.length > 0 ? l.payment_methods : ["cash", "transfer"]);
    } catch {
      router.push("/bazar");
    } finally {
      setLoading(false);
    }
  }, [listingId, router]);

  // Fetch escrow commission settings
  useEffect(() => {
    if (!user) return;
    fetch("/api/escrow/public-settings").then(r => r.json()).then(d => {
      setEscrowCommission({ rate: Number(d.commission_rate || 5), min: Number(d.min_commission || 15) });
    }).catch(() => {
      setEscrowCommission({ rate: 5, min: 15 });
    });
  }, [user]);



  // When shipping is unchecked, remove COD from payment methods
  useEffect(() => {
    if (!shipping) {
      setPaymentMethods(prev => prev.filter(m => m !== "cod"));
    }
  }, [shipping]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/prihlaseni");
      return;
    }
    if (user) fetchListing();
  }, [user, authLoading, router, fetchListing]);

  // Check ownership
  useEffect(() => {
    if (listing && user && listing.seller_id !== user.id && profile?.role !== "admin") {
      router.push("/bazar");
    }
  }, [listing, user, profile, router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setShowBrandSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBrands = brand
    ? BRAND_SUGGESTIONS.filter((b) =>
        b.toLowerCase().includes(brand.toLowerCase())
      )
    : BRAND_SUGGESTIONS;

  async function handleSubmit() {
    if (!user || !listing) return;

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
    if (paymentMethods.length === 0) {
      setError("Vyberte alespoň jeden způsob platby");
      return;
    }
    if (paymentMethods.includes("escrow") && !shipping) {
      setError("Bezpečná platba vyžaduje možnost zaslání");
      return;
    }
    if (paymentMethods.includes("cod") && !shipping) {
      setError("Dobírka vyžaduje možnost zaslání");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {

      const { error: updateError } = await supabase
        .from("listings")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          price: parseInt(price),
          condition,
          scale: scale || null,
          brand: brand.trim() || null,
          category,
          images,
          location: location.trim() || null,
          shipping,
          personal_pickup: personalPickup,
          payment_methods: paymentMethods,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listing.id);

      if (updateError) throw updateError;
      router.push(`/bazar/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading || !user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>⏳ Načítám...</p>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <Link href={`/bazar/${listing.id}`} style={{ color: "var(--text-dimmer)", textDecoration: "none", fontSize: "13px" }}>
          ← Zpět na inzerát
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginTop: "12px" }}>
          <span style={{ color: "var(--text-primary)" }}>Upravit </span>
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

      {/* Form — same as /bazar/novy but pre-filled */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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

        {/* Payment methods */}
        <div>
          <label style={labelStyle}>Způsoby platby *</label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {([
              { value: "cash", label: "💵 Hotovost", requiresShipping: false },
              { value: "transfer", label: "🏦 Bankovní převod", requiresShipping: false },
              { value: "cod", label: "📦 Na dobírku", requiresShipping: true },
              { value: "escrow", label: "🛡️ Bezpečná platba", requiresShipping: false },
            ] as const).map((pm) => {
              const disabled = pm.requiresShipping && !shipping;
              const checked = paymentMethods.includes(pm.value);
              return (
                <label
                  key={pm.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    color: disabled ? "var(--text-dimmer)" : "var(--text-body)",
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      if (pm.value === "escrow" && e.target.checked) {
                        setShowEscrowConfirm(true);
                      } else if (e.target.checked) {
                        setPaymentMethods(prev => [...prev, pm.value]);
                      } else {
                        setPaymentMethods(prev => prev.filter(m => m !== pm.value));
                      }
                    }}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  {pm.label}
                </label>
              );
            })}
          </div>
          {!shipping && (
            <p style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "6px" }}>
              💡 Dobírka vyžaduje možnost zaslání
            </p>
          )}
        </div>

        {/* Escrow info (shown when escrow is selected) */}
        {paymentMethods.includes("escrow") && (
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
              🛡️ Bezpečná platba aktivována
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>
              Kupující bude moci zvolit Bezpečnou platbu. Peníze uvolníme prodejci
              až po potvrzení doručení — ochrana pro obě strany.
            </p>
            {escrowCommission && (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px", marginBottom: 0 }}>
                <strong>Provize:</strong> {escrowCommission.rate} % z ceny (min. {escrowCommission.min} Kč) — strhne se z výplaty.
              </p>
            )}
          </div>
        )}

        {/* Escrow confirmation dialog */}
        {showEscrowConfirm && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 9999, padding: "20px",
          }} onClick={() => setShowEscrowConfirm(false)}>
            <div style={{
              background: "var(--bg-card, #1a2236)", borderRadius: "12px",
              padding: "24px", maxWidth: "440px", width: "100%",
              border: "1px solid rgba(34,197,94,0.3)",
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>
                🛡️ Aktivovat Bezpečnou platbu?
              </div>
              <p style={{ fontSize: "14px", color: "var(--text-body)", lineHeight: 1.6, margin: "0 0 8px" }}>
                Aktivací Bezpečné platby umožníte kupujícím využít escrow službu.
              </p>
              <ul style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.8, margin: "0 0 16px", paddingLeft: "20px" }}>
                <li>Peníze budou drženy na escrow účtu do potvrzení doručení</li>
                <li>Provize {escrowCommission ? `${escrowCommission.rate} % (min. ${escrowCommission.min} Kč)` : "5 %"} se strhne z výplaty</li>
                <li>Zvyšuje důvěryhodnost vašeho inzerátu</li>
              </ul>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowEscrowConfirm(false)}
                  style={{
                    padding: "8px 20px", borderRadius: "8px", border: "1px solid var(--border-subtle, #333)",
                    background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px",
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={() => {
                    setPaymentMethods(prev => [...prev, "escrow"]);
                    setShowEscrowConfirm(false);
                  }}
                  style={{
                    padding: "8px 20px", borderRadius: "8px", border: "none",
                    background: "#22c55e", color: "#fff", cursor: "pointer",
                    fontSize: "14px", fontWeight: 600,
                  }}
                >
                  ✅ Aktivovat
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Fotky</label>
          <ImageUpload images={images} onChange={setImages} listingId={listing.id} />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Doporučená velikost: 800 × 600 px (4:3)</p>
        </div>

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
            {submitting ? "⏳ Ukládám..." : "💾 Uložit změny"}
          </button>
          <Link
            href={`/bazar/${listing.id}`}
            style={{
              padding: "14px 24px",
              background: "var(--bg-card)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              fontSize: "16px",
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Zrušit
          </Link>
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
