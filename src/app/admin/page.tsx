"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  totalRevenue: number;
  totalProducts: number;
  activeProducts: number;
  totalUsers: number;
  totalArticles: number;
  totalListings: number;
  recentOrders: Array<{
    id: string;
    order_number: string;
    status: string;
    total_price: number;
    created_at: string;
  }>;
}

const adminSections = [
  { href: "/admin/shop", icon: "🛒", title: "Shop", desc: "Produkty, objednávky, kategorie, kupóny" },
  { href: "/admin/clanky", icon: "📝", title: "Články", desc: "Správa a moderování článků" },
  { href: "/admin/zakaznici", icon: "👥", title: "Zákazníci", desc: "Přehled registrovaných uživatelů" },
  { href: "/admin/sablony", icon: "📧", title: "Šablony", desc: "E-mailové šablony" },
  { href: "/admin/escrow", icon: "🛡️", title: "Escrow", desc: "Bezpečná platba, spory, nastavení" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na platbu",
  paid: "Zaplaceno",
  processing: "Zpracovává se",
  shipped: "Odesláno",
  delivered: "Doručeno",
  cancelled: "Zrušeno",
  refunded: "Vráceno",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f0a030",
  paid: "#22c55e",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
  refunded: "#6b7280",
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/prihlaseni"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin") { router.push("/"); return; }

      // Načteme statistiky paralelně
      const [ordersRes, productsRes, usersRes, articlesRes, bazarRes, recentRes] = await Promise.all([
        supabase.from("shop_orders").select("status, total_price"),
        supabase.from("shop_products").select("id, status"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase.from("shop_orders").select("id, order_number, status, total_price, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const orders = ordersRes.data || [];
      const products = productsRes.data || [];
      const paidStatuses = ["paid", "processing", "shipped", "delivered"];

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === "pending").length,
        paidOrders: orders.filter(o => paidStatuses.includes(o.status)).length,
        totalRevenue: orders.filter(o => paidStatuses.includes(o.status)).reduce((sum, o) => sum + (o.total_price || 0), 0),
        totalProducts: products.length,
        activeProducts: products.filter(p => p.status === "active").length,
        totalUsers: usersRes.count || 0,
        totalArticles: articlesRes.count || 0,
        totalListings: bazarRes.count || 0,
        recentOrders: recentRes.data || [],
      });

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám...</p>
      </div>
    );
  }

  const statCards = stats ? [
    { label: "Tržby", value: `${stats.totalRevenue.toLocaleString("cs-CZ")} Kč`, icon: "💰", color: "#22c55e" },
    { label: "Objednávky", value: stats.totalOrders, icon: "📦", color: "#3b82f6", sub: `${stats.pendingOrders} čeká` },
    { label: "Produkty", value: `${stats.activeProducts}/${stats.totalProducts}`, icon: "🏷️", color: "#f0a030" },
    { label: "Uživatelé", value: stats.totalUsers, icon: "👥", color: "#8b5cf6" },
    { label: "Články", value: stats.totalArticles, icon: "📝", color: "#ec4899" },
    { label: "Bazar", value: stats.totalListings, icon: "🏪", color: "#f97316" },
  ] : [];

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "32px" }}>
        ⚙️ Admin panel
      </h1>

      {/* Stat karty */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              borderLeft: `4px solid ${s.color}`,
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "4px" }}>{s.icon}</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: "11px", color: s.color, marginTop: "2px" }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Poslední objednávky */}
      {stats && stats.recentOrders.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
            📋 Poslední objednávky
          </h2>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            {stats.recentOrders.map((o, i) => (
              <Link
                key={o.id}
                href={`/admin/shop?tab=orders`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < stats.recentOrders.length - 1 ? "1px solid var(--border)" : "none",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "14px" }}>{o.order_number}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                    {o.total_price?.toLocaleString("cs-CZ")} Kč
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: `${STATUS_COLORS[o.status] || "#6b7280"}22`,
                    color: STATUS_COLORS[o.status] || "#6b7280",
                  }}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sekce */}
      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
        🔧 Správa
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
        {adminSections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "block",
              padding: "20px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>{s.icon}</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>{s.title}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
