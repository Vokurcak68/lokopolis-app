"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/Auth/AuthProvider";
import { useCart } from "@/components/Shop/CartProvider";
import { supabase } from "@/lib/supabase";
import Turnstile from "@/components/Turnstile";
import PickupPointSelector from "@/components/Shop/PickupPointSelector";
import type { PickupPoint } from "@/components/Shop/PickupPointSelector";
import type { ShippingMethod, PaymentMethod, UserAddress } from "@/types/database";

interface BillingData {
  name: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  isBusiness: boolean;
  ico: string;
  dic: string;
  differentShipping: boolean;
  shippingName: string;
  shippingCompany: string;
  shippingStreet: string;
  shippingCity: string;
  shippingZip: string;
  shippingCountry: string;
}

const STEPS = ["Údaje", "Doprava", "Platba", "Shrnutí"];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { items, cartTotal, clearCart } = useCart();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [billing, setBilling] = useState<BillingData>({
    name: "", company: "", email: "", phone: "", street: "", city: "", zip: "", country: "CZ",
    isBusiness: false, ico: "", dic: "",
    differentShipping: false, shippingName: "", shippingCompany: "", shippingStreet: "", shippingCity: "", shippingZip: "", shippingCountry: "CZ",
  });

  // Saved delivery addresses
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string>("");
  const [pickupPoint, setPickupPoint] = useState<PickupPoint | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; description: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [loyaltyInfo, setLoyaltyInfo] = useState<{ points: number; pointsValueCzk: number; currentLevel: { name: string; icon: string; color: string } | null } | null>(null);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [checkoutStartedAt] = useState<number>(() => Date.now());
  const [website] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Determine if cart is all-digital
  const isAllDigital = items.every((i) => !!i.product.file_url);

  // Pre-fill from profile (billing_name has priority over display_name)
  const profileFilledRef = useRef(false);
  useEffect(() => {
    if (!user || !profile || profileFilledRef.current) return;
    profileFilledRef.current = true;

    setBilling((b) => ({
      ...b,
      name: profile.billing_name || "",
      company: profile.billing_company || "",
      email: user.email || "",
      phone: profile.phone || "",
      street: profile.billing_street || "",
      city: profile.billing_city || "",
      zip: profile.billing_zip || "",
      country: profile.billing_country || "CZ",
      isBusiness: !!(profile.billing_ico),
      ico: profile.billing_ico || "",
      dic: profile.billing_dic || "",
    }));
  }, [user, profile]);

  // Load saved delivery addresses
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (data) setSavedAddresses(data as UserAddress[]);
    })();
  }, [user]);

  // Load loyalty info
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/shop/loyalty", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLoyaltyInfo(data);
      }
    })();
  }, [user]);

  // Load shipping/payment methods
  useEffect(() => {
    (async () => {
      const { data: sm } = await supabase
        .from("shipping_methods")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (sm) setShippingMethods(sm as ShippingMethod[]);

      const { data: pm } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (pm) setPaymentMethods(pm as PaymentMethod[]);
    })();
  }, []);

  // Auto-select email shipping for digital-only
  useEffect(() => {
    if (isAllDigital && shippingMethods.length > 0) {
      const emailMethod = shippingMethods.find((s) => s.digital_only);
      if (emailMethod) setSelectedShipping(emailMethod.id);
    }
  }, [isAllDigital, shippingMethods]);

  const selectedShippingObj = shippingMethods.find((s) => s.id === selectedShipping);

  // Odvodit carrier z vybraného shipping method slugu
  const pickupCarrier: "balikovna" | "zasilkovna" | null = (() => {
    const slug = selectedShippingObj?.slug || "";
    if (slug.startsWith("zasilkovna")) return "zasilkovna";
    if (slug.startsWith("balikovna")) return "balikovna";
    // Fallback: všechny pickup_point metody bez specifického prefixu = balíkovna
    if (selectedShippingObj?.shipping_type === "pickup_point") return "balikovna";
    return null;
  })();
  const selectedPaymentObj = paymentMethods.find((p) => p.id === selectedPayment);
  const shippingPrice = selectedShippingObj
    ? (selectedShippingObj.free_from && cartTotal >= selectedShippingObj.free_from ? 0 : selectedShippingObj.price)
    : 0;
  const paymentSurcharge = selectedPaymentObj?.surcharge || 0;
  const couponDiscountAmount = couponApplied?.discount || 0;
  const loyaltyDiscountAmount = Math.floor(loyaltyPointsToUse * 0.1);
  const totalPrice = Math.max(0, cartTotal - couponDiscountAmount - loyaltyDiscountAmount + shippingPrice + paymentSurcharge);

  // Filter methods based on cart content
  const filteredShipping = shippingMethods.filter((s) => {
    if (isAllDigital && s.physical_only) return false;
    if (!isAllDigital && s.digital_only) return false;
    return true;
  });

  const filteredPayment = paymentMethods.filter((p) => {
    // Hide cash-on-delivery for digital shipments
    if (selectedShippingObj?.digital_only && p.slug === "cash-on-delivery") return false;
    return true;
  });

  function handleAddressSelect(addressId: string) {
    setSelectedAddressId(addressId);
    if (addressId === "" || addressId === "manual") {
      // Clear shipping fields for manual entry
      setBilling((b) => ({
        ...b,
        shippingName: "",
        shippingCompany: "",
        shippingStreet: "",
        shippingCity: "",
        shippingZip: "",
        shippingCountry: "CZ",
      }));
      return;
    }
    const addr = savedAddresses.find((a) => a.id === addressId);
    if (addr) {
      setBilling((b) => ({
        ...b,
        shippingName: addr.full_name || "",
        shippingCompany: addr.company || "",
        shippingStreet: addr.street || "",
        shippingCity: addr.city || "",
        shippingZip: addr.zip || "",
        shippingCountry: addr.country || "CZ",
      }));
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Košík je prázdný
        </h1>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          ← Zpět do shopu
        </Link>
      </div>
    );
  }

  function validateStep(): boolean {
    setError("");
    if (step === 0) {
      if (!billing.name.trim()) { setError("Vyplňte jméno"); return false; }
      if (!billing.email.trim() || !billing.email.includes("@")) { setError("Vyplňte platný email"); return false; }
      if (!isAllDigital) {
        if (!billing.street.trim()) { setError("Vyplňte ulici"); return false; }
        if (!billing.city.trim()) { setError("Vyplňte město"); return false; }
        if (!billing.zip.trim()) { setError("Vyplňte PSČ"); return false; }
      }
      if (billing.isBusiness && !billing.ico.trim()) { setError("Vyplňte IČ"); return false; }
    }
    if (step === 1 && !selectedShipping) { setError("Vyberte způsob dopravy"); return false; }
    if (step === 1 && selectedShippingObj?.shipping_type === "pickup_point" && !pickupPoint) { setError("Vyberte výdejní místo"); return false; }
    if (step === 2 && !selectedPayment) { setError("Vyberte způsob platby"); return false; }
    return true;
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    if (!turnstileToken) {
      setCouponError("Potvrďte prosím anti-bot ověření.");
      return;
    }
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await fetch("/api/shop/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          items: items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            price: i.product.price,
            category: i.product.category,
          })),
          userId: user?.id || null,
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || "Neplatný kupón");
        setCouponApplied(null);
      } else {
        setCouponApplied({ code: data.code, discount: data.discount, description: data.description });
        setCouponError("");
      }
    } catch {
      setCouponError("Chyba při ověřování kupónu");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError("");
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    if (!turnstileToken) {
      setError("Potvrďte prosím anti-bot ověření.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          billing,
          shippingMethodId: selectedShipping,
          paymentMethodId: selectedPayment,
          pickupPoint: selectedShippingObj?.shipping_type === "pickup_point" ? pickupPoint : null,
          pickupPointCarrier: selectedShippingObj?.shipping_type === "pickup_point" ? pickupCarrier : null,
          couponCode: couponApplied?.code || null,
          loyaltyPointsToUse: loyaltyPointsToUse > 0 ? loyaltyPointsToUse : null,
          turnstileToken,
          startedAt: checkoutStartedAt,
          website,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Chyba při vytváření objednávky");
        return;
      }

      clearCart();
      router.push(`/objednavka/${data.orderNumber}`);
    } catch {
      setError("Chyba serveru");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "var(--text-muted)",
    marginBottom: "4px",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
        Pokladna
      </h1>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "32px" }}>
        {STEPS.map((s, idx) => (
          <div key={s} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                height: "4px",
                borderRadius: "2px",
                background: idx <= step ? "var(--accent)" : "var(--border)",
                transition: "background 0.3s",
                marginBottom: "6px",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                fontWeight: idx === step ? 700 : 400,
                color: idx <= step ? "var(--accent)" : "var(--text-dimmer)",
              }}
            >
              {idx + 1}. {s}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#ef4444",
            fontSize: "14px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Billing */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Fakturační údaje</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Jméno a příjmení *</label>
              <input style={inputStyle} value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Telefon</label>
            <input style={inputStyle} type="tel" value={billing.phone} onChange={(e) => setBilling({ ...billing, phone: e.target.value })} />
          </div>

          {!isAllDigital && (
            <>
              <div>
                <label style={labelStyle}>Ulice a číslo popisné *</label>
                <input style={inputStyle} value={billing.street} onChange={(e) => setBilling({ ...billing, street: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Město *</label>
                  <input style={inputStyle} value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>PSČ *</label>
                  <input style={inputStyle} value={billing.zip} onChange={(e) => setBilling({ ...billing, zip: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {/* Business checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--text-muted)" }}>
            <input type="checkbox" checked={billing.isBusiness} onChange={(e) => setBilling({ ...billing, isBusiness: e.target.checked })} />
            Nakupuji na firmu
          </label>
          {billing.isBusiness && (
            <>
              <div>
                <label style={labelStyle}>Název firmy *</label>
                <input style={inputStyle} value={billing.company} onChange={(e) => setBilling({ ...billing, company: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>IČ *</label>
                  <input style={inputStyle} value={billing.ico} onChange={(e) => setBilling({ ...billing, ico: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>DIČ</label>
                  <input style={inputStyle} value={billing.dic} onChange={(e) => setBilling({ ...billing, dic: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {/* Different shipping address */}
          {!isAllDigital && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--text-muted)" }}>
                <input type="checkbox" checked={billing.differentShipping} onChange={(e) => {
                  setBilling({ ...billing, differentShipping: e.target.checked });
                  if (!e.target.checked) setSelectedAddressId("");
                }} />
                Doručovací adresa je jiná
              </label>
              {billing.differentShipping && (
                <div style={{ padding: "16px", background: "var(--bg-page)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Address picker for logged-in users with saved addresses */}
                  {user && savedAddresses.length > 0 && (
                    <div>
                      <label style={labelStyle}>Uložené adresy</label>
                      <select
                        style={inputStyle}
                        value={selectedAddressId}
                        onChange={(e) => handleAddressSelect(e.target.value)}
                      >
                        <option value="">— Vyberte uloženou adresu —</option>
                        {savedAddresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.is_default ? "⭐ " : ""}{a.label} — {a.full_name}, {a.street}, {a.city}
                          </option>
                        ))}
                        <option value="manual">+ Zadat novou adresu ručně</option>
                      </select>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>Jméno příjemce</label>
                      <input style={inputStyle} value={billing.shippingName} onChange={(e) => setBilling({ ...billing, shippingName: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Firma</label>
                      <input style={inputStyle} value={billing.shippingCompany} onChange={(e) => setBilling({ ...billing, shippingCompany: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Ulice *</label>
                    <input style={inputStyle} value={billing.shippingStreet} onChange={(e) => setBilling({ ...billing, shippingStreet: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>Město *</label>
                      <input style={inputStyle} value={billing.shippingCity} onChange={(e) => setBilling({ ...billing, shippingCity: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>PSČ *</label>
                      <input style={inputStyle} value={billing.shippingZip} onChange={(e) => setBilling({ ...billing, shippingZip: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Shipping */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Způsob dopravy</h2>
          {isAllDigital && (
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Váš košík obsahuje pouze digitální produkty — doručení proběhne ihned emailem.
            </p>
          )}
          {filteredShipping.map((s) => {
            const isFree = s.free_from && cartTotal >= s.free_from;
            return (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "16px",
                  background: selectedShipping === s.id ? "rgba(240, 160, 48, 0.08)" : "var(--bg-card)",
                  border: `1px solid ${selectedShipping === s.id ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="shipping"
                  checked={selectedShipping === s.id}
                  onChange={() => { setSelectedShipping(s.id); setPickupPoint(null); }}
                  style={{ marginTop: "3px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", marginBottom: "2px" }}>
                    {s.name}
                  </div>
                  {s.description && (
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{s.description}</div>
                  )}
                  {s.delivery_days && (
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "2px" }}>
                      ⏱ {s.delivery_days}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                  {isFree ? (
                    <span style={{ color: "#22c55e" }}>Zdarma</span>
                  ) : s.price === 0 ? (
                    "Zdarma"
                  ) : (
                    `${s.price} Kč`
                  )}
                </div>
              </label>
            );
          })}

          {/* Výběr výdejního místa (Balíkovna / Zásilkovna) */}
          {selectedShippingObj?.shipping_type === "pickup_point" && pickupCarrier && (
            <PickupPointSelector
              onSelect={(point) => setPickupPoint(point.id ? point : null)}
              selectedPoint={pickupPoint}
              carrier={pickupCarrier}
            />
          )}
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Způsob platby</h2>
          {filteredPayment.map((p) => (
            <label
              key={p.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "16px",
                background: selectedPayment === p.id ? "rgba(240, 160, 48, 0.08)" : "var(--bg-card)",
                border: `1px solid ${selectedPayment === p.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <input
                type="radio"
                name="payment"
                checked={selectedPayment === p.id}
                onChange={() => setSelectedPayment(p.id)}
                style={{ marginTop: "3px" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", marginBottom: "2px" }}>
                  {p.name}
                </div>
                {p.description && (
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{p.description}</div>
                )}
              </div>
              {p.surcharge > 0 && (
                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  +{p.surcharge} Kč
                </div>
              )}
            </label>
          ))}
        </div>
      )}

      {/* Step 4: Summary */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Shrnutí objednávky</h2>

          {/* Products */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px" }}>Produkty</h3>
            {items.map(({ product, quantity }) => (
              <div key={product.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                <span style={{ color: "var(--text-primary)" }}>
                  {product.title} {quantity > 1 && `(${quantity}×)`}
                </span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {product.price === 0 ? "Zdarma" : `${product.price * quantity} Kč`}
                </span>
              </div>
            ))}
          </div>

          {/* Billing */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Fakturační údaje</h3>
            <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6 }}>
              <div>{billing.name}</div>
              <div>{billing.email}</div>
              {billing.phone && <div>{billing.phone}</div>}
              {billing.street && <div>{billing.street}, {billing.zip} {billing.city}</div>}
              {billing.isBusiness && <div>IČ: {billing.ico}{billing.dic && ` · DIČ: ${billing.dic}`}</div>}
            </div>
          </div>

          {/* Shipping & Payment */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Doprava</h3>
              <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>{selectedShippingObj?.name}</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                {shippingPrice === 0 ? "Zdarma" : `${shippingPrice} Kč`}
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Platba</h3>
              <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>{selectedPaymentObj?.name}</div>
              {paymentSurcharge > 0 && (
                <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>+{paymentSurcharge} Kč</div>
              )}
            </div>
          </div>

          {/* Loyalty Points */}
          {user && loyaltyInfo && loyaltyInfo.points > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px" }}>
                {loyaltyInfo.currentLevel?.icon || "⭐"} Věrnostní body
                <span style={{ marginLeft: "8px", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: loyaltyInfo.currentLevel?.color || "#cd7f32", color: "#fff" }}>
                  {loyaltyInfo.currentLevel?.name || "Bronzový"}
                </span>
              </h3>
              <div style={{ fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px" }}>
                Máte <strong>{loyaltyInfo.points} bodů</strong> (hodnota {loyaltyInfo.pointsValueCzk} Kč)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <label style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Uplatnit bodů:</label>
                <input
                  type="range"
                  min={0}
                  max={Math.min(loyaltyInfo.points, Math.floor(cartTotal / 0.1))}
                  step={10}
                  value={loyaltyPointsToUse}
                  onChange={(e) => setLoyaltyPointsToUse(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)", minWidth: "100px", textAlign: "right" }}>
                  {loyaltyPointsToUse} bodů = {loyaltyDiscountAmount} Kč
                </span>
              </div>
              {loyaltyPointsToUse > 0 && (
                <button onClick={() => setLoyaltyPointsToUse(0)} style={{ marginTop: "8px", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}>✕ Nepoužívat body</button>
              )}
            </div>
          )}

          {/* Coupon */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px" }}>🎟️ Slevový kupón</h3>
            {couponApplied ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ padding: "4px 12px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "6px", fontSize: "14px", fontWeight: 600, color: "#22c55e" }}>
                    ✅ {couponApplied.code} ({couponApplied.description})
                  </span>
                  <span style={{ marginLeft: "12px", fontSize: "14px", fontWeight: 600, color: "#22c55e" }}>-{couponApplied.discount} Kč</span>
                </div>
                <button onClick={removeCoupon} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>✕ Odebrat</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                  placeholder="Zadejte kód kupónu"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: "8px", fontSize: "14px",
                    border: `1px solid ${couponError ? "#ef4444" : "var(--border)"}`,
                    background: "var(--bg-header)", color: "var(--text-primary)",
                    textTransform: "uppercase", letterSpacing: "1px",
                  }}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                />
                <button
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  style={{
                    padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
                    border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-text-on)",
                    cursor: couponLoading || !couponCode.trim() ? "not-allowed" : "pointer",
                    opacity: couponLoading || !couponCode.trim() ? 0.5 : 1,
                  }}
                >
                  {couponLoading ? "..." : "Uplatnit"}
                </button>
              </div>
            )}
            {couponError && <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{couponError}</p>}
          </div>

          {/* Total */}
          <div
            style={{
              padding: "20px",
              background: "var(--bg-card)",
              border: "2px solid var(--accent)",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
              <span>Produkty</span><span>{cartTotal} Kč</span>
            </div>
            {couponDiscountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "#22c55e" }}>
                <span>Sleva ({couponApplied?.code})</span><span>-{couponDiscountAmount} Kč</span>
              </div>
            )}
            {loyaltyDiscountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "#a855f7" }}>
                <span>⭐ Věrnostní body ({loyaltyPointsToUse} b.)</span><span>-{loyaltyDiscountAmount} Kč</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
              <span>Doprava</span><span>{shippingPrice === 0 ? "Zdarma" : `${shippingPrice} Kč`}</span>
            </div>
            {paymentSurcharge > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
                <span>Příplatek za platbu</span><span>+{paymentSurcharge} Kč</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>Celkem k úhradě</span>
              <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)" }}>{totalPrice} Kč</span>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: "16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
              marginBottom: "16px",
              padding: "12px 16px",
              background: "var(--bg-card)",
              borderRadius: "8px",
              border: "1px solid var(--border)",
            }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{ marginTop: "3px", accentColor: "var(--accent, #f0a030)" }}
            />
            <span>
              Souhlasím s{" "}
              <Link href="/obchodni-podminky" target="_blank" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                obchodními podmínkami
              </Link>{" "}
              a beru na vědomí zpracování osobních údajů dle{" "}
              <Link href="/ochrana-udaju" target="_blank" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                zásad ochrany osobních údajů
              </Link>
            </span>
          </label>

          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>
            Ověření proti botům
          </div>
          <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
          <input
            type="text"
            name="website"
            value={website}
            onChange={() => {}}
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", opacity: 0, pointerEvents: "none" }}
          />
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px", gap: "12px" }}>
        {step > 0 ? (
          <button
            onClick={() => { setError(""); setStep(step - 1); }}
            style={{
              padding: "12px 24px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Zpět
          </button>
        ) : (
          <Link
            href="/kosik"
            style={{
              padding: "12px 24px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            ← Košík
          </Link>
        )}

        {step < 3 ? (
          <button
            onClick={() => {
              if (validateStep()) {
                // For all-digital, skip shipping step if already auto-selected
                if (step === 0 && isAllDigital && selectedShipping) {
                  setStep(2);
                } else {
                  setStep(step + 1);
                }
              }
            }}
            style={{
              padding: "12px 28px",
              border: "none",
              borderRadius: "10px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Pokračovat →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !turnstileToken || !agreedToTerms}
            style={{
              padding: "14px 32px",
              border: "none",
              borderRadius: "10px",
              background: (submitting || !turnstileToken || !agreedToTerms) ? "var(--text-muted)" : "#22c55e",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: (submitting || !turnstileToken || !agreedToTerms) ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Odesílám..." : "✓ Dokončit objednávku"}
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
