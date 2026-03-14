"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Profile, ShopOrder } from "@/types/database";

interface CustomerRow extends Profile {
  email?: string;
  order_count: number;
  total_spent: number;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na platbu",
  paid: "Zaplaceno",
  processing: "Zpracovává se",
  shipped: "Odesláno",
  delivered: "Doručeno",
  cancelled: "Zrušeno",
  refunded: "Vráceno",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  paid: "#22c55e",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
  refunded: "#6b7280",
};

export default function AdminCustomersPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [customerOrders, setCustomerOrders] = useState<ShopOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Editable fields for selected customer
  const [editForm, setEditForm] = useState({
    billing_street: "",
    billing_city: "",
    billing_zip: "",
    billing_country: "CZ",
    billing_ico: "",
    billing_dic: "",
    billing_company: "",
    permanent_discount_percent: 0,
    volume_discount_percent: 0,
    volume_discount_threshold: 0,
    volume_discount_period_days: 365,
  });

  // Check admin
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/prihlaseni"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      setIsAdmin(true);
      setLoading(false);
    }
    checkAdmin();
  }, [router]);

  // Fetch customers with order stats
  const fetchCustomers = useCallback(async () => {
    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!profiles) return;

    // Get order stats grouped by user
    const { data: orders } = await supabase
      .from("shop_orders")
      .select("user_id, total_price, price, status");

    // Get emails from auth (admin only via service role — fallback to billing_email from orders)
    const orderEmails: Record<string, string> = {};
    if (orders) {
      // Collect billing emails from orders
      const { data: ordersWithEmail } = await supabase
        .from("shop_orders")
        .select("user_id, billing_email")
        .not("billing_email", "is", null);
      if (ordersWithEmail) {
        for (const o of ordersWithEmail) {
          if (o.user_id && o.billing_email) {
            orderEmails[o.user_id] = o.billing_email;
          }
        }
      }
    }

    const orderStats: Record<string, { count: number; total: number }> = {};
    if (orders) {
      for (const o of orders) {
        if (!o.user_id || o.status === "cancelled" || o.status === "refunded") continue;
        if (!orderStats[o.user_id]) orderStats[o.user_id] = { count: 0, total: 0 };
        orderStats[o.user_id].count++;
        orderStats[o.user_id].total += (o.total_price || o.price || 0);
      }
    }

    const customerRows: CustomerRow[] = profiles.map((p: Profile) => ({
      ...p,
      email: orderEmails[p.id] || undefined,
      order_count: orderStats[p.id]?.count || 0,
      total_spent: orderStats[p.id]?.total || 0,
    }));

    setCustomers(customerRows);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchCustomers();
  }, [isAdmin, fetchCustomers]);

  // Select customer → load details + orders
  async function selectCustomer(c: CustomerRow) {
    setSelectedCustomer(c);
    setSaveMsg("");
    setEditForm({
      billing_street: c.billing_street || "",
      billing_city: c.billing_city || "",
      billing_zip: c.billing_zip || "",
      billing_country: c.billing_country || "CZ",
      billing_ico: c.billing_ico || "",
      billing_dic: c.billing_dic || "",
      billing_company: c.billing_company || "",
      permanent_discount_percent: c.permanent_discount_percent || 0,
      volume_discount_percent: c.volume_discount_percent || 0,
      volume_discount_threshold: c.volume_discount_threshold || 0,
      volume_discount_period_days: c.volume_discount_period_days || 365,
    });

    // Fetch orders for this customer
    const { data: orders } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("user_id", c.id)
      .order("created_at", { ascending: false });

    setCustomerOrders((orders as ShopOrder[]) || []);
  }

  // Save customer changes
  async function handleSave() {
    if (!selectedCustomer) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        billing_street: editForm.billing_street || null,
        billing_city: editForm.billing_city || null,
        billing_zip: editForm.billing_zip || null,
        billing_country: editForm.billing_country || "CZ",
        billing_ico: editForm.billing_ico || null,
        billing_dic: editForm.billing_dic || null,
        billing_company: editForm.billing_company || null,
        permanent_discount_percent: editForm.permanent_discount_percent,
        volume_discount_percent: editForm.volume_discount_percent,
        volume_discount_threshold: editForm.volume_discount_threshold,
        volume_discount_period_days: editForm.volume_discount_period_days,
      })
      .eq("id", selectedCustomer.id);

    if (error) {
      setSaveMsg("❌ Chyba: " + error.message);
    } else {
      setSaveMsg("✅ Uloženo");
      fetchCustomers();
    }
    setSaving(false);
  }

  // Filter customers
  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.display_name || "").toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.billing_company || "").toLowerCase().includes(q)
    );
  });

  if (loading || !isAdmin) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}>👥 Správa zákazníků</h1>
        <Link href="/admin" style={{ padding: "8px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "13px", textDecoration: "none" }}>
          ← Admin panel
        </Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Hledat podle jména, emailu, firmy..."
          style={inputStyle}
        />
      </div>

      {/* Two column layout when customer selected */}
      <div style={{ display: "grid", gridTemplateColumns: selectedCustomer ? "1fr 1fr" : "1fr", gap: "24px" }}>
        {/* Customer list */}
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Jméno", "Email", "Registrace", "Obj.", "Útrata", "Sleva"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id;
                  const discount = c.permanent_discount_percent || 0;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "var(--accent-bg, rgba(59,130,246,0.1))" : "transparent",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-card)"; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {c.display_name || c.username}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>@{c.username}</div>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>
                        {c.email || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-dimmer)" }}>
                        {new Date(c.created_at).toLocaleDateString("cs-CZ")}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--text-body)" }}>
                        {c.order_count}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: c.total_spent > 0 ? "var(--accent)" : "var(--text-dimmer)" }}>
                        {c.total_spent > 0 ? `${c.total_spent.toLocaleString("cs-CZ")} Kč` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                        {discount > 0 ? (
                          <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                            -{discount} %
                          </span>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-dimmer)" }}>
              {search ? "Žádný zákazník nenalezen" : "Zatím žádní zákazníci"}
            </p>
          )}
          <p style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "8px" }}>
            Celkem: {filtered.length} zákazníků
          </p>
        </div>

        {/* Customer detail */}
        {selectedCustomer && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                {selectedCustomer.display_name || selectedCustomer.username}
              </h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-dimmer)", padding: "4px" }}
              >
                ✕
              </button>
            </div>

            {/* Basic info - read only */}
            <div style={{ marginBottom: "20px", padding: "12px 16px", background: "var(--bg-page)", borderRadius: "8px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "8px", marginTop: 0 }}>Základní info</h3>
              <div style={{ display: "grid", gap: "4px", fontSize: "13px" }}>
                <div><span style={{ color: "var(--text-dimmer)" }}>Jméno:</span> <span style={{ color: "var(--text-primary)" }}>{selectedCustomer.display_name || "—"}</span></div>
                <div><span style={{ color: "var(--text-dimmer)" }}>Username:</span> <span style={{ color: "var(--text-primary)" }}>@{selectedCustomer.username}</span></div>
                <div><span style={{ color: "var(--text-dimmer)" }}>Email:</span> <span style={{ color: "var(--text-primary)" }}>{selectedCustomer.email || "—"}</span></div>
                <div><span style={{ color: "var(--text-dimmer)" }}>Telefon:</span> <span style={{ color: "var(--text-primary)" }}>{selectedCustomer.phone || "—"}</span></div>
                <div><span style={{ color: "var(--text-dimmer)" }}>Registrace:</span> <span style={{ color: "var(--text-primary)" }}>{new Date(selectedCustomer.created_at).toLocaleDateString("cs-CZ")}</span></div>
              </div>
            </div>

            {/* Billing address - editable */}
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "8px" }}>Fakturační adresa</h3>
              <div style={{ display: "grid", gap: "8px" }}>
                <div>
                  <label style={labelStyle}>Ulice</label>
                  <input value={editForm.billing_street} onChange={(e) => setEditForm(f => ({ ...f, billing_street: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={labelStyle}>Město</label>
                    <input value={editForm.billing_city} onChange={(e) => setEditForm(f => ({ ...f, billing_city: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>PSČ</label>
                    <input value={editForm.billing_zip} onChange={(e) => setEditForm(f => ({ ...f, billing_zip: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Země</label>
                  <input value={editForm.billing_country} onChange={(e) => setEditForm(f => ({ ...f, billing_country: e.target.value }))} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Company info */}
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "8px" }}>Firemní údaje</h3>
              <div style={{ display: "grid", gap: "8px" }}>
                <div>
                  <label style={labelStyle}>Firma</label>
                  <input value={editForm.billing_company} onChange={(e) => setEditForm(f => ({ ...f, billing_company: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={labelStyle}>IČO</label>
                    <input value={editForm.billing_ico} onChange={(e) => setEditForm(f => ({ ...f, billing_ico: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>DIČ</label>
                    <input value={editForm.billing_dic} onChange={(e) => setEditForm(f => ({ ...f, billing_dic: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>

            {/* Discounts */}
            <div style={{ marginBottom: "20px", padding: "16px", background: "rgba(34,197,94,0.05)", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.2)" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#22c55e", marginBottom: "12px", marginTop: 0 }}>💰 Slevy</h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Trvalá sleva (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.permanent_discount_percent}
                    onChange={(e) => setEditForm(f => ({ ...f, permanent_discount_percent: parseInt(e.target.value) || 0 }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "8px", marginTop: 0 }}>Objemová sleva</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={labelStyle}>Threshold (Kč)</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.volume_discount_threshold}
                        onChange={(e) => setEditForm(f => ({ ...f, volume_discount_threshold: parseInt(e.target.value) || 0 }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Sleva (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editForm.volume_discount_percent}
                        onChange={(e) => setEditForm(f => ({ ...f, volume_discount_percent: parseInt(e.target.value) || 0 }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Období (dny)</label>
                      <input
                        type="number"
                        min={1}
                        value={editForm.volume_discount_period_days}
                        onChange={(e) => setEditForm(f => ({ ...f, volume_discount_period_days: parseInt(e.target.value) || 365 }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save button */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <button
                onClick={handleSave}
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
                {saving ? "Ukládám..." : "💾 Uložit změny"}
              </button>
              {saveMsg && <span style={{ fontSize: "13px", color: saveMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{saveMsg}</span>}
            </div>

            {/* Customer orders */}
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "8px" }}>📋 Objednávky zákazníka ({customerOrders.length})</h3>
              {customerOrders.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>Žádné objednávky</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Číslo", "Datum", "Částka", "Stav"].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "11px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.map((o) => (
                        <tr key={o.id}>
                          <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                            {o.order_number}
                          </td>
                          <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-dimmer)" }}>
                            {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                          </td>
                          <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                            {(o.total_price || o.price || 0).toLocaleString("cs-CZ")} Kč
                          </td>
                          <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: `${ORDER_STATUS_COLORS[o.status] || "#6b7280"}20`,
                              color: ORDER_STATUS_COLORS[o.status] || "#6b7280",
                            }}>
                              {ORDER_STATUS_LABELS[o.status] || o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-dim)",
  marginBottom: "4px",
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
