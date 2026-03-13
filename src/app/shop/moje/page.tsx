"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { ShopProduct, ShopOrder } from "@/types/database";
import { getShopCategories, getCategoryLabel, type ShopCategory } from "@/lib/shop-categories";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na platbu",
  paid: "Zaplaceno",
  cancelled: "Zrušeno",
  refunded: "Vráceno",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  paid: "#22c55e",
  cancelled: "#ef4444",
  refunded: "#6b7280",
};

interface PurchaseWithProduct {
  id: string;
  product_id: string;
  granted_at: string;
  product: ShopProduct | null;
}

interface OrderWithProduct extends ShopOrder {
  product: { title: string; slug: string } | null;
}

export default function MyPurchasesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseWithProduct[]>([]);
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch purchases with products
      const { data: purchaseData } = await supabase
        .from("user_purchases")
        .select("id, product_id, granted_at, product:shop_products(*)")
        .eq("user_id", user.id)
        .order("granted_at", { ascending: false });

      setPurchases((purchaseData as unknown as PurchaseWithProduct[]) || []);

      // Fetch orders
      const { data: orderData } = await supabase
        .from("shop_orders")
        .select("*, product:shop_products(title, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((orderData as unknown as OrderWithProduct[]) || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    getShopCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/prihlaseni");
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  async function handleDownload(productId: string) {
    setDownloading(productId);
    try {
      const res = await fetch(`/api/shop/download?productId=${productId}`);
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Chyba při stahování");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      alert("Chyba při stahování");
    } finally {
      setDownloading(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "24px", fontSize: "14px" }}>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none" }}>Shop</Link>
        <span style={{ color: "var(--text-dimmer)" }}>›</span>
        <span style={{ color: "var(--text-dim)" }}>Moje nákupy</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "32px" }}>
        📥 Moje nákupy
      </h1>

      {/* Purchased products */}
      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
          Zakoupené produkty
        </h2>

        {purchases.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
            <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
              Zatím nemáte žádné produkty.
            </p>
            <Link
              href="/shop"
              style={{
                display: "inline-block",
                marginTop: "12px",
                padding: "10px 20px",
                background: "var(--accent)",
                borderRadius: "8px",
                color: "var(--accent-text-on)",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              Prohlédnout Shop
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {purchases.map((purchase) => {
              const p = purchase.product;
              if (!p) return null;

              return (
                <div
                  key={purchase.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                  }}
                >
                  {/* Image */}
                  <div style={{ width: "64px", height: "48px", borderRadius: "6px", overflow: "hidden", position: "relative", flexShrink: 0, background: "var(--bg-page)" }}>
                    {p.cover_image_url ? (
                      <Image src={p.cover_image_url} alt={p.title} fill style={{ objectFit: "cover" }} sizes="64px" />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>📦</div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/shop/${p.slug}`}
                      style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
                    >
                      {p.title}
                    </Link>
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "2px" }}>
                      {getCategoryLabel(categories, p.category)} • Získáno {new Date(purchase.granted_at).toLocaleDateString("cs-CZ")}
                    </div>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => handleDownload(p.id)}
                    disabled={downloading === p.id}
                    style={{
                      padding: "8px 16px",
                      background: downloading === p.id ? "var(--border)" : "var(--accent)",
                      border: "none",
                      borderRadius: "8px",
                      color: "var(--accent-text-on)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: downloading === p.id ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {downloading === p.id ? "Stahuji..." : "📥 Stáhnout"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Order history */}
      <section>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
          Historie objednávek
        </h2>

        {orders.length === 0 ? (
          <p style={{ padding: "24px 0", color: "var(--text-dimmer)", textAlign: "center" }}>
            Žádné objednávky
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Číslo", "Produkt", "Cena", "Stav", "Datum"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--text-dimmer)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--accent)" }}>
                      {o.order_number}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px" }}>
                      {o.product ? (
                        <Link href={`/shop/${o.product.slug}`} style={{ color: "var(--text-body)", textDecoration: "none" }}>
                          {o.product.title}
                        </Link>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {o.price === 0 ? "Zdarma" : `${o.price} Kč`}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: `${ORDER_STATUS_COLORS[o.status]}20`,
                          color: ORDER_STATUS_COLORS[o.status],
                        }}
                      >
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-dimmer)" }}>
                      {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ height: "48px" }} />
    </div>
  );
}
