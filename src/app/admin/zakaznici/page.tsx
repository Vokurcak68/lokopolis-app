"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

interface CustomerRow extends Profile {
  email?: string;
  order_count: number;
  total_spent: number;
}

export default function AdminCustomersPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");

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

  const fetchCustomers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!profiles) return;

    const { data: orders } = await supabase
      .from("shop_orders")
      .select("user_id, total_price, price, status");

    const orderEmails: Record<string, string> = {};
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>👥 Správa zákazníků</h1>
        <Link href="/admin" style={{ padding: "8px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "13px", textDecoration: "none" }}>
          ← Admin panel
        </Link>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Hledat podle jména, emailu, firmy..."
          style={inputStyle}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Jméno", "Email", "Registrace", "Obj.", "Útrata", "Sleva", "Role"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const discount = c.permanent_discount_percent || 0;
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/zakaznici/${c.id}`)}
                  style={{ cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-card)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {c.is_blocked && <span title="Zablokovaný" style={{ fontSize: "14px" }}>🚫</span>}
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: c.is_blocked ? "var(--text-dimmer)" : "var(--text-primary)" }}>
                          {c.display_name || c.username}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>@{c.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>
                    {c.email || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-dimmer)", whiteSpace: "nowrap" }}>
                    {new Date(c.created_at).toLocaleDateString("cs-CZ")}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--text-body)" }}>
                    {c.order_count}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: c.total_spent > 0 ? "var(--accent)" : "var(--text-dimmer)", whiteSpace: "nowrap" }}>
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
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: c.role === "admin" ? "rgba(239,68,68,0.15)" : "rgba(107,114,128,0.15)",
                      color: c.role === "admin" ? "#ef4444" : "var(--text-dimmer)",
                    }}>
                      {c.role}
                    </span>
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
  );
}

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
