"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Profile, ShopOrder, UserAddress } from "@/types/database";

type Tab = "osobni" | "adresy" | "dodaci" | "heslo" | "objednavky";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Čeká na platbu", color: "#f59e0b" },
  paid: { label: "Zaplaceno", color: "#22c55e" },
  processing: { label: "Zpracovává se", color: "#3b82f6" },
  shipped: { label: "Odesláno", color: "#8b5cf6" },
  delivered: { label: "Doručeno", color: "#22c55e" },
  cancelled: { label: "Zrušeno", color: "#ef4444" },
  refunded: { label: "Vráceno", color: "#6b7280" },
};

const EMPTY_ADDRESS = {
  label: "Domů",
  full_name: "",
  company: "",
  street: "",
  city: "",
  zip: "",
  country: "CZ",
  phone: "",
};

export default function AccountPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("osobni");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Delivery addresses
  const [deliveryAddresses, setDeliveryAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [newAddress, setNewAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({ ...EMPTY_ADDRESS });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMsg, setAddressMsg] = useState("");

  // Personal info form
  const [personalForm, setPersonalForm] = useState({
    display_name: "",
    phone: "",
    bio: "",
  });

  // Billing address form
  const [billingForm, setBillingForm] = useState({
    billing_street: "",
    billing_city: "",
    billing_zip: "",
    billing_country: "CZ",
    billing_ico: "",
    billing_dic: "",
    billing_company: "",
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function downloadInvoice(orderId: string, orderNum: string) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/shop/invoice?orderId=${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faktura-${orderNum}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load profile data into forms
  useEffect(() => {
    if (!profile) return;
    setPersonalForm({
      display_name: profile.display_name || "",
      phone: profile.phone || "",
      bio: profile.bio || "",
    });
    setBillingForm({
      billing_street: profile.billing_street || "",
      billing_city: profile.billing_city || "",
      billing_zip: profile.billing_zip || "",
      billing_country: profile.billing_country || "CZ",
      billing_ico: profile.billing_ico || "",
      billing_dic: profile.billing_dic || "",
      billing_company: profile.billing_company || "",
    });
  }, [profile]);

  // Load orders when tab switches
  useEffect(() => {
    if (tab === "objednavky" && user && orders.length === 0) {
      setOrdersLoading(true);
      supabase
        .from("shop_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setOrders((data as ShopOrder[]) || []);
          setOrdersLoading(false);
        });
    }
  }, [tab, user, orders.length]);

  // Load delivery addresses
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddressesLoading(true);
    const { data } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setDeliveryAddresses((data as UserAddress[]) || []);
    setAddressesLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === "dodaci" && user && deliveryAddresses.length === 0) {
      loadAddresses();
    }
  }, [tab, user, deliveryAddresses.length, loadAddresses]);

  // Save personal info
  async function savePersonal() {
    if (!user) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: personalForm.display_name || null,
        phone: personalForm.phone || null,
        bio: personalForm.bio || null,
      })
      .eq("id", user.id);

    setSaveMsg(error ? "❌ " + error.message : "✅ Uloženo");
    setSaving(false);
  }

  // Save billing address
  async function saveBilling() {
    if (!user) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        billing_street: billingForm.billing_street || null,
        billing_city: billingForm.billing_city || null,
        billing_zip: billingForm.billing_zip || null,
        billing_country: billingForm.billing_country || "CZ",
        billing_ico: billingForm.billing_ico || null,
        billing_dic: billingForm.billing_dic || null,
        billing_company: billingForm.billing_company || null,
      })
      .eq("id", user.id);

    setSaveMsg(error ? "❌ " + error.message : "✅ Uloženo");
    setSaving(false);
  }

  // Change password
  async function changePassword() {
    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg("❌ Heslo musí mít alespoň 6 znaků");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg("❌ Hesla se neshodují");
      return;
    }

    setPasswordSaving(true);
    setPasswordMsg("");

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    if (error) {
      setPasswordMsg("❌ " + error.message);
    } else {
      setPasswordMsg("✅ Heslo změněno");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    }
    setPasswordSaving(false);
  }

  // Delivery address CRUD
  function startNewAddress() {
    setEditingAddress(null);
    setNewAddress(true);
    setAddressForm({ ...EMPTY_ADDRESS });
    setAddressMsg("");
  }

  function startEditAddress(a: UserAddress) {
    setNewAddress(false);
    setEditingAddress(a);
    setAddressForm({
      label: a.label,
      full_name: a.full_name,
      company: a.company || "",
      street: a.street,
      city: a.city,
      zip: a.zip,
      country: a.country,
      phone: a.phone || "",
    });
    setAddressMsg("");
  }

  function cancelAddressForm() {
    setNewAddress(false);
    setEditingAddress(null);
    setAddressMsg("");
  }

  async function saveDeliveryAddress() {
    if (!user) return;
    if (!addressForm.full_name || !addressForm.street || !addressForm.city || !addressForm.zip) {
      setAddressMsg("❌ Vyplňte jméno, ulici, město a PSČ");
      return;
    }

    setAddressSaving(true);
    setAddressMsg("");

    if (editingAddress) {
      // Update
      const { error } = await supabase
        .from("user_addresses")
        .update({
          label: addressForm.label,
          full_name: addressForm.full_name,
          company: addressForm.company || null,
          street: addressForm.street,
          city: addressForm.city,
          zip: addressForm.zip,
          country: addressForm.country || "CZ",
          phone: addressForm.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingAddress.id);

      if (error) {
        setAddressMsg("❌ " + error.message);
      } else {
        setAddressMsg("✅ Adresa aktualizována");
        setEditingAddress(null);
        await loadAddresses();
      }
    } else {
      // Insert
      const { error } = await supabase
        .from("user_addresses")
        .insert({
          user_id: user.id,
          label: addressForm.label,
          full_name: addressForm.full_name,
          company: addressForm.company || null,
          street: addressForm.street,
          city: addressForm.city,
          zip: addressForm.zip,
          country: addressForm.country || "CZ",
          phone: addressForm.phone || null,
          is_default: deliveryAddresses.length === 0,
        });

      if (error) {
        setAddressMsg("❌ " + error.message);
      } else {
        setAddressMsg("✅ Adresa přidána");
        setNewAddress(false);
        setAddressForm({ ...EMPTY_ADDRESS });
        await loadAddresses();
      }
    }
    setAddressSaving(false);
  }

  async function deleteAddress(id: string) {
    if (!confirm("Opravdu smazat tuto adresu?")) return;
    const { error } = await supabase.from("user_addresses").delete().eq("id", id);
    if (!error) await loadAddresses();
  }

  async function setDefaultAddress(id: string) {
    if (!user) return;
    // Unset all defaults first
    await supabase
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", user.id);
    // Set the new default
    await supabase
      .from("user_addresses")
      .update({ is_default: true })
      .eq("id", id);
    await loadAddresses();
  }

  if (authLoading) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Přihlaste se
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
          Pro zobrazení účtu se musíte přihlásit.
        </p>
        <Link href="/prihlaseni" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          Přihlásit se →
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "osobni", label: "Osobní údaje", icon: "👤" },
    { key: "adresy", label: "Adresy", icon: "🏠" },
    { key: "dodaci", label: "Dodací adresy", icon: "📦" },
    { key: "heslo", label: "Změna hesla", icon: "🔒" },
    { key: "objednavky", label: "Objednávky", icon: "📋" },
  ];

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
        👤 Můj účet
      </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSaveMsg(""); }}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: tab === t.key ? "var(--accent)" : "var(--bg-card)",
              color: tab === t.key ? "var(--accent-text-on)" : "var(--text-muted)",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* === OSOBNÍ ÚDAJE === */}
      {tab === "osobni" && (
        <div style={{ maxWidth: "500px" }}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={user.email || ""}
                disabled
                style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
              />
              <p style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "4px" }}>Email nelze změnit</p>
            </div>
            <div>
              <label style={labelStyle}>Zobrazované jméno</label>
              <input
                type="text"
                value={personalForm.display_name}
                onChange={(e) => setPersonalForm(f => ({ ...f, display_name: e.target.value }))}
                style={inputStyle}
                placeholder="Vaše jméno"
              />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input
                type="tel"
                value={personalForm.phone}
                onChange={(e) => setPersonalForm(f => ({ ...f, phone: e.target.value }))}
                style={inputStyle}
                placeholder="+420 ..."
              />
            </div>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={personalForm.bio}
                onChange={(e) => setPersonalForm(f => ({ ...f, bio: e.target.value }))}
                style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                placeholder="Pár slov o vás..."
                rows={3}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px" }}>
            <button
              onClick={savePersonal}
              disabled={saving}
              style={btnStyle(saving)}
            >
              {saving ? "Ukládám..." : "💾 Uložit"}
            </button>
            {saveMsg && <span style={{ fontSize: "13px", color: saveMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* === ADRESY (Fakturační) === */}
      {tab === "adresy" && (
        <div style={{ maxWidth: "500px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
            🏠 Fakturační adresa
          </h3>
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Ulice a číslo popisné</label>
              <input
                value={billingForm.billing_street}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_street: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Město</label>
                <input
                  value={billingForm.billing_city}
                  onChange={(e) => setBillingForm(f => ({ ...f, billing_city: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>PSČ</label>
                <input
                  value={billingForm.billing_zip}
                  onChange={(e) => setBillingForm(f => ({ ...f, billing_zip: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Země</label>
              <input
                value={billingForm.billing_country}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_country: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginTop: "28px", marginBottom: "16px" }}>
            🏢 Nákup na firmu
          </h3>
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Název firmy</label>
              <input
                value={billingForm.billing_company}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_company: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>IČO</label>
                <input
                  value={billingForm.billing_ico}
                  onChange={(e) => setBillingForm(f => ({ ...f, billing_ico: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>DIČ</label>
                <input
                  value={billingForm.billing_dic}
                  onChange={(e) => setBillingForm(f => ({ ...f, billing_dic: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px" }}>
            <button
              onClick={saveBilling}
              disabled={saving}
              style={btnStyle(saving)}
            >
              {saving ? "Ukládám..." : "💾 Uložit"}
            </button>
            {saveMsg && <span style={{ fontSize: "13px", color: saveMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* === DODACÍ ADRESY === */}
      {tab === "dodaci" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              📦 Dodací adresy
            </h3>
            {!newAddress && !editingAddress && (
              <button
                onClick={startNewAddress}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--accent)",
                  color: "var(--accent-text-on)",
                  cursor: "pointer",
                }}
              >
                ➕ Přidat adresu
              </button>
            )}
          </div>

          {/* Address form (new or edit) */}
          {(newAddress || editingAddress) && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginTop: 0, marginBottom: "12px" }}>
                {editingAddress ? "✏️ Upravit adresu" : "➕ Nová dodací adresa"}
              </h4>
              <div style={{ display: "grid", gap: "12px", maxWidth: "500px" }}>
                <div>
                  <label style={labelStyle}>Pojmenování (např. Domů, Práce)</label>
                  <input
                    value={addressForm.label}
                    onChange={(e) => setAddressForm(f => ({ ...f, label: e.target.value }))}
                    style={inputStyle}
                    placeholder="Domů"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Jméno příjemce *</label>
                  <input
                    value={addressForm.full_name}
                    onChange={(e) => setAddressForm(f => ({ ...f, full_name: e.target.value }))}
                    style={inputStyle}
                    placeholder="Jan Novák"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Firma / Název</label>
                  <input
                    value={addressForm.company}
                    onChange={(e) => setAddressForm(f => ({ ...f, company: e.target.value }))}
                    style={inputStyle}
                    placeholder="Nepovinné — např. název firmy"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ulice a číslo *</label>
                  <input
                    value={addressForm.street}
                    onChange={(e) => setAddressForm(f => ({ ...f, street: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Město *</label>
                    <input
                      value={addressForm.city}
                      onChange={(e) => setAddressForm(f => ({ ...f, city: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>PSČ *</label>
                    <input
                      value={addressForm.zip}
                      onChange={(e) => setAddressForm(f => ({ ...f, zip: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Země</label>
                    <input
                      value={addressForm.country}
                      onChange={(e) => setAddressForm(f => ({ ...f, country: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Telefon</label>
                    <input
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm(f => ({ ...f, phone: e.target.value }))}
                      style={inputStyle}
                      placeholder="+420 ..."
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
                <button
                  onClick={saveDeliveryAddress}
                  disabled={addressSaving}
                  style={btnStyle(addressSaving)}
                >
                  {addressSaving ? "Ukládám..." : "💾 Uložit adresu"}
                </button>
                <button
                  onClick={cancelAddressForm}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Zrušit
                </button>
                {addressMsg && <span style={{ fontSize: "13px", color: addressMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{addressMsg}</span>}
              </div>
            </div>
          )}

          {/* Addresses list */}
          {addressesLoading ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>Načítám adresy...</p>
          ) : deliveryAddresses.length === 0 && !newAddress ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
              <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Zatím nemáte uložené dodací adresy.</p>
              <button
                onClick={startNewAddress}
                style={{
                  padding: "10px 24px",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "var(--accent)",
                  color: "var(--accent-text-on)",
                  cursor: "pointer",
                }}
              >
                ➕ Přidat první adresu
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {deliveryAddresses.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "16px 20px",
                    background: "var(--bg-card)",
                    border: a.is_default ? "2px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: "10px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {a.is_default && "⭐ "}{a.label}
                      </span>
                      {a.is_default && (
                        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: "rgba(59,130,246,0.15)", color: "var(--accent)" }}>
                          Výchozí
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-body)", lineHeight: 1.5 }}>
                      <div>{a.full_name}</div>
                      {a.company && <div style={{ color: "var(--text-dimmer)" }}>{a.company}</div>}
                      <div>{a.street}</div>
                      <div>{a.zip} {a.city}, {a.country}</div>
                      {a.phone && <div style={{ color: "var(--text-dimmer)" }}>📱 {a.phone}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {!a.is_default && (
                      <button
                        onClick={() => setDefaultAddress(a.id)}
                        title="Nastavit jako výchozí"
                        style={smallBtnStyle}
                      >
                        ⭐
                      </button>
                    )}
                    <button
                      onClick={() => startEditAddress(a)}
                      title="Upravit"
                      style={smallBtnStyle}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteAddress(a.id)}
                      title="Smazat"
                      style={{ ...smallBtnStyle, color: "#ef4444" }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === ZMĚNA HESLA === */}
      {tab === "heslo" && (
        <div style={{ maxWidth: "400px" }}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Nové heslo</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                style={inputStyle}
                placeholder="Minimálně 6 znaků"
              />
            </div>
            <div>
              <label style={labelStyle}>Potvrzení hesla</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                style={inputStyle}
                placeholder="Zadejte heslo znovu"
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px" }}>
            <button
              onClick={changePassword}
              disabled={passwordSaving || !passwordForm.newPassword}
              style={btnStyle(passwordSaving || !passwordForm.newPassword)}
            >
              {passwordSaving ? "Měním..." : "🔒 Změnit heslo"}
            </button>
            {passwordMsg && <span style={{ fontSize: "13px", color: passwordMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{passwordMsg}</span>}
          </div>
        </div>
      )}

      {/* === OBJEDNÁVKY === */}
      {tab === "objednavky" && (
        <div>
          {ordersLoading ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "32px 0" }}>Načítám objednávky...</p>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
              <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Zatím nemáte žádné objednávky.</p>
              <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                Prohlédnout shop →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {orders.map((order) => {
                const status = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280" };
                const total = order.total_price || order.price;
                const date = new Date(order.created_at).toLocaleDateString("cs-CZ", {
                  day: "numeric", month: "long", year: "numeric",
                });

                return (
                  <Link
                    key={order.id}
                    href={`/objednavka/${order.order_number}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 20px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        transition: "border-color 0.2s",
                        cursor: "pointer",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", marginBottom: "4px" }}>
                          {order.order_number}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{date}</div>
                        {order.tracking_number && (order.status === "shipped" || order.status === "delivered") && (
                          <div style={{ fontSize: "12px", color: "var(--accent)", marginTop: "4px" }}>
                            📦 Tracking: {order.tracking_number}
                            {order.shipped_at && (
                              <span style={{ color: "var(--text-dimmer)", marginLeft: "8px" }}>
                                (odesláno {new Date(order.shipped_at).toLocaleDateString("cs-CZ")})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: `${status.color}20`,
                          color: status.color,
                        }}>
                          {status.label}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)", minWidth: "80px", textAlign: "right" }}>
                          {total === 0 ? "Zdarma" : `${total} Kč`}
                        </span>
                        <button
                          title="Stáhnout fakturu"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadInvoice(order.id, order.order_number);
                          }}
                          style={{
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            lineHeight: 1,
                            color: "var(--text-muted)",
                            transition: "border-color 0.2s",
                            flexShrink: 0,
                          }}
                        >
                          📄
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 24px",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    background: disabled ? "var(--border-hover)" : "var(--accent)",
    color: disabled ? "var(--text-dimmer)" : "var(--accent-text-on)",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--bg-card)",
  cursor: "pointer",
  fontSize: "14px",
  color: "var(--text-body)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-dim)",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-input)",
  borderRadius: "8px",
  color: "var(--text-body)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};
