"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { ShopOrder } from "@/types/database";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Čeká na platbu", color: "#f59e0b" },
  paid: { label: "Zaplaceno", color: "#22c55e" },
  processing: { label: "Zpracovává se", color: "#3b82f6" },
  shipped: { label: "Odesláno", color: "#8b5cf6" },
  delivered: { label: "Doručeno", color: "#22c55e" },
  cancelled: { label: "Zrušeno", color: "#ef4444" },
  refunded: { label: "Vráceno", color: "#6b7280" },
};

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    (async () => {
      const { data } = await supabase
        .from("shop_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((data as ShopOrder[]) || []);
      setLoading(false);
    })();
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Přihlaste se
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
          Pro zobrazení objednávek se musíte přihlásit.
        </p>
        <Link href="/prihlaseni" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          Přihlásit se →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "32px" }}>
        📦 Moje objednávky
      </h1>

      {orders.length === 0 ? (
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
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: `${status.color}20`,
                        color: status.color,
                      }}
                    >
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
  );
}
