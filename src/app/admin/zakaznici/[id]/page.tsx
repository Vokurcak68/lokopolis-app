"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Profile, ShopOrder, UserAddress, LoyaltyLevel } from "@/types/database";

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

export default function AdminCustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loyaltyLevel, setLoyaltyLevel] = useState<LoyaltyLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

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
    admin_note: "",
    is_blocked: false,
  });

  // Check admin
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/prihlaseni"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      setIsAdmin(true);
    }
    checkAdmin();
  }, [router]);

  // Load customer data
  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);

    // Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", customerId)
      .single();

    if (!profile) {
      router.push("/admin/zakaznici");
      return;
    }

    setCustomer(profile as Profile);
    setEditForm({
      billing_street: profile.billing_street || "",
      billing_city: profile.billing_city || "",
      billing_zip: profile.billing_zip || "",
      billing_country: profile.billing_country || "CZ",
      billing_ico: profile.billing_ico || "",
      billing_dic: profile.billing_dic || "",
      billing_company: profile.billing_company || "",
      permanent_discount_percent: profile.permanent_discount_percent || 0,
      volume_discount_percent: profile.volume_discount_percent || 0,
      volume_discount_threshold: profile.volume_discount_threshold || 0,
      volume_discount_period_days: profile.volume_discount_period_days || 365,
      admin_note: profile.admin_note || "",
      is_blocked: profile.is_blocked || false,
    });

    // Email from orders
    const { data: orderEmail } = await supabase
      .from("shop_orders")
      .select("billing_email")
      .eq("user_id", customerId)
      .not("billing_email", "is", null)
      .limit(1)
      .single();
    if (orderEmail?.billing_email) setCustomerEmail(orderEmail.billing_email);

    // Orders
    const { data: ordersData } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false });
    setOrders((ordersData as ShopOrder[]) || []);

    // Delivery addresses
    const { data: addressesData } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", customerId)
      .order("is_default", { ascending: false });
    setAddresses((addressesData as UserAddress[]) || []);

    // Loyalty level
    if (profile.loyalty_level_id) {
      const { data: level } = await supabase
        .from("loyalty_levels")
        .select("*")
        .eq("id", profile.loyalty_level_id)
        .single();
      if (level) setLoyaltyLevel(level as LoyaltyLevel);
    }

    setLoading(false);
  }, [customerId, router]);

  useEffect(() => {
    if (isAdmin) loadCustomer();
  }, [isAdmin, loadCustomer]);

  // Save
  async function handleSave() {
    if (!customer) return;
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
        admin_note: editForm.admin_note || null,
        is_blocked: editForm.is_blocked,
      })
      .eq("id", customer.id);

    if (error) {
      setSaveMsg("❌ Chyba: " + error.message);
    } else {
      setSaveMsg("✅ Uloženo");
      loadCustomer();
    }
    setSaving(false);
  }

  // Stats
  const validOrders = orders.filter(o => o.status !== "cancelled" && o.status !== "refunded");
  const totalSpent = validOrders.reduce((sum, o) => sum + (o.total_price || o.price || 0), 0);
  const avgOrder = validOrders.length > 0 ? Math.round(totalSpent / validOrders.length) : 0;
  const lastOrderDate = orders.length > 0 ? new Date(orders[0].created_at).toLocaleDateString("cs-CZ") : "—";

  if (loading || !isAdmin) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám...</p>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/admin/zakaznici"
            style={{ padding: "8px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "13px", textDecoration: "none" }}
          >
            ← Zpět na seznam
          </Link>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            {customer.display_name || customer.username}
          </h1>
          {customer.is_blocked && (
            <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
              🚫 Zablokován
            </span>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Objednávek", value: String(validOrders.length), color: "var(--accent)" },
          { label: "Celková útrata", value: totalSpent > 0 ? `${totalSpent.toLocaleString("cs-CZ")} Kč` : "—", color: "#22c55e" },
          { label: "Ø objednávka", value: avgOrder > 0 ? `${avgOrder.toLocaleString("cs-CZ")} Kč` : "—", color: "var(--text-primary)" },
          { label: "Poslední obj.", value: lastOrderDate, color: "var(--text-primary)" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "4px" }}>{s.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main content - responsive grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>

        {/* Základní info */}
        <Section title="👤 Základní info">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", fontSize: "13px" }}>
            <InfoRow label="Jméno" value={customer.display_name || "—"} />
            <InfoRow label="Username" value={`@${customer.username}`} />
            <InfoRow label="Email" value={customerEmail || "—"} />
            <InfoRow label="Telefon" value={customer.phone || "—"} />
            <InfoRow label="Registrace" value={new Date(customer.created_at).toLocaleDateString("cs-CZ")} />
            <InfoRow label="Role" value={customer.role} />
          </div>
        </Section>

        {/* Admin poznámka */}
        <Section title="📝 Poznámka admina">
          <textarea
            value={editForm.admin_note}
            onChange={(e) => setEditForm(f => ({ ...f, admin_note: e.target.value }))}
            placeholder="Interní poznámka o zákazníkovi..."
            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
            rows={3}
          />
        </Section>

        {/* Fakturační adresa + Firemní údaje — dvousloupcově na desktopu */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          <Section title="🏠 Fakturační adresa">
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
          </Section>

          <Section title="🏢 Firemní údaje">
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
          </Section>
        </div>

        {/* Dodací adresy */}
        <Section title={`📦 Dodací adresy (${addresses.length})`}>
          {addresses.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-dimmer)", margin: 0 }}>Zákazník nemá uložené dodací adresy</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
              {addresses.map((a) => (
                <div key={a.id} style={{ padding: "12px 16px", background: "var(--bg-page)", borderRadius: "8px", border: a.is_default ? "2px solid var(--accent)" : "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {a.is_default && "⭐ "}{a.label}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-body)", lineHeight: 1.5 }}>
                    <div>{a.full_name}</div>
                    <div>{a.street}</div>
                    <div>{a.zip} {a.city}</div>
                    <div>{a.country}</div>
                    {a.phone && <div style={{ marginTop: "4px", color: "var(--text-dimmer)" }}>📱 {a.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Slevy */}
        <Section title="💰 Slevy" cardStyle={{ background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.2)" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
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
        </Section>

        {/* Věrnostní program */}
        <Section title="🏆 Věrnostní program">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", fontSize: "13px" }}>
            <InfoRow label="Body" value={String(customer.loyalty_points || 0)} />
            <InfoRow label="Úroveň" value={loyaltyLevel ? `${loyaltyLevel.icon} ${loyaltyLevel.name}` : "—"} />
            {loyaltyLevel && <InfoRow label="Sleva za úroveň" value={`${loyaltyLevel.discount_percent} %`} />}
            {loyaltyLevel && <InfoRow label="Násobitel bodů" value={`${loyaltyLevel.points_multiplier}×`} />}
          </div>
        </Section>

        {/* Blokace účtu */}
        <Section title="🔒 Blokace účtu" cardStyle={editForm.is_blocked ? { background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.3)" } : undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={editForm.is_blocked}
                onChange={(e) => setEditForm(f => ({ ...f, is_blocked: e.target.checked }))}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              Zablokovat zákazníka
            </label>
          </div>
          {editForm.is_blocked && (
            <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px", margin: "8px 0 0 0" }}>
              ⚠️ Zablokovaný zákazník se nemůže přihlásit ani nakupovat.
            </p>
          )}
        </Section>

        {/* Uložit */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 0" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "12px 32px",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
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

        {/* Objednávky */}
        <Section title={`📋 Objednávky zákazníka (${orders.length})`}>
          {orders.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-dimmer)", margin: 0 }}>Žádné objednávky</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Číslo", "Datum", "Částka", "Stav"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "11px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                        <Link href={`/admin/shop?order=${o.order_number}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {o.order_number}
                        </Link>
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-dimmer)", whiteSpace: "nowrap" }}>
                        {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
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
        </Section>
      </div>
    </div>
  );
}

// Helper components
function Section({ title, children, cardStyle }: { title: string; children: React.ReactNode; cardStyle?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", ...cardStyle }}>
      <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginTop: 0, marginBottom: "12px" }}>{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "var(--text-dimmer)" }}>{label}:</span>{" "}
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
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
  boxSizing: "border-box",
};
