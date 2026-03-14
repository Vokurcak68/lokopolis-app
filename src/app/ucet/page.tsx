"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Profile, ShopOrder } from "@/types/database";

type Tab = "osobni" | "adresy" | "heslo" | "objednavky";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Čeká na platbu", color: "#f59e0b" },
  paid: { label: "Zaplaceno", color: "#22c55e" },
  processing: { label: "Zpracovává se", color: "#3b82f6" },
  shipped: { label: "Odesláno", color: "#8b5cf6" },
  delivered: { label: "Doručeno", color: "#22c55e" },
  cancelled: { label: "Zrušeno", color: "#ef4444" },
  refunded: { label: "Vráceno", color: "#6b7280" },
};

export default function AccountPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("osobni");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Personal info form
  const [personalForm, setPersonalForm] = useState({
    display_name: "",
    phone: "",
    bio: "",
  });

  // Address form
  const [addressForm, setAddressForm] = useState({
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

  // Load profile data into forms
  useEffect(() => {
    if (!profile) return;
    setPersonalForm({
      display_name: profile.display_name || "",
      phone: profile.phone || "",
      bio: profile.bio || "",
    });
    setAddressForm({
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

  // Save address
  async function saveAddress() {
    if (!user) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        billing_street: addressForm.billing_street || null,
        billing_city: addressForm.billing_city || null,
        billing_zip: addressForm.billing_zip || null,
        billing_country: addressForm.billing_country || "CZ",
        billing_ico: addressForm.billing_ico || null,
        billing_dic: addressForm.billing_dic || null,
        billing_company: addressForm.billing_company || null,
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
              style={{
                padding: "10px 24px",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                background: saving ? "var(--border-hover)" : "var(--accent)",
                color: saving ? "var(--text-dimmer)" : "var(--accent-text-on)",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Ukládám..." : "💾 Uložit"}
            </button>
            {saveMsg && <span style={{ fontSize: "13px", color: saveMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* === ADRESY === */}
      {tab === "adresy" && (
        <div style={{ maxWidth: "500px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
            🏠 Fakturační adresa
          </h3>
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Ulice a číslo popisné</label>
              <input
                value={addressForm.billing_street}
                onChange={(e) => setAddressForm(f => ({ ...f, billing_street: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Město</label>
                <input
                  value={addressForm.billing_city}
                  onChange={(e) => setAddressForm(f => ({ ...f, billing_city: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>PSČ</label>
                <input
                  value={addressForm.billing_zip}
                  onChange={(e) => setAddressForm(f => ({ ...f, billing_zip: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Země</label>
              <input
                value={addressForm.billing_country}
                onChange={(e) => setAddressForm(f => ({ ...f, billing_country: e.target.value }))}
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
                value={addressForm.billing_company}
                onChange={(e) => setAddressForm(f => ({ ...f, billing_company: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>IČO</label>
                <input
                  value={addressForm.billing_ico}
                  onChange={(e) => setAddressForm(f => ({ ...f, billing_ico: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>DIČ</label>
                <input
                  value={addressForm.billing_dic}
                  onChange={(e) => setAddressForm(f => ({ ...f, billing_dic: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px" }}>
            <button
              onClick={saveAddress}
              disabled={saving}
              style={{
                padding: "10px 24px",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                background: saving ? "var(--border-hover)" : "var(--accent)",
                color: saving ? "var(--text-dimmer)" : "var(--accent-text-on)",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Ukládám..." : "💾 Uložit"}
            </button>
            {saveMsg && <span style={{ fontSize: "13px", color: saveMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{saveMsg}</span>}
          </div>
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
              style={{
                padding: "10px 24px",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                background: passwordSaving || !passwordForm.newPassword ? "var(--border-hover)" : "var(--accent)",
                color: passwordSaving || !passwordForm.newPassword ? "var(--text-dimmer)" : "var(--accent-text-on)",
                cursor: passwordSaving || !passwordForm.newPassword ? "not-allowed" : "pointer",
              }}
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
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", marginBottom: "4px" }}>
                          {order.order_number}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{date}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
};
