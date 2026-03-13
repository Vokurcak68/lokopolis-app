"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ShopOrder, OrderItem, ShopProduct, ShippingMethod, PaymentMethod } from "@/types/database";

interface OrderDetail extends ShopOrder {
  items: (OrderItem & { product: ShopProduct | null })[];
  shipping: ShippingMethod | null;
  paymentObj: PaymentMethod | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Čeká na platbu", color: "#f59e0b" },
  paid: { label: "Zaplaceno", color: "#22c55e" },
  processing: { label: "Zpracovává se", color: "#3b82f6" },
  shipped: { label: "Odesláno", color: "#8b5cf6" },
  delivered: { label: "Doručeno", color: "#22c55e" },
  cancelled: { label: "Zrušeno", color: "#ef4444" },
  refunded: { label: "Vráceno", color: "#6b7280" },
};

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: orderData } = await supabase
        .from("shop_orders")
        .select("*")
        .eq("order_number", orderNumber)
        .single();

      if (!orderData) {
        setLoading(false);
        return;
      }

      // Load order items
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderData.id);

      let itemsWithProducts: (OrderItem & { product: ShopProduct | null })[] = [];
      if (itemsData && itemsData.length > 0) {
        const productIds = itemsData.map((i) => i.product_id);
        const { data: products } = await supabase
          .from("shop_products")
          .select("*")
          .in("id", productIds);

        itemsWithProducts = itemsData.map((item) => ({
          ...item,
          product: (products?.find((p) => p.id === item.product_id) as ShopProduct) || null,
        }));
      } else if (orderData.product_id) {
        // Legacy single-product order
        const { data: product } = await supabase
          .from("shop_products")
          .select("*")
          .eq("id", orderData.product_id)
          .single();

        if (product) {
          itemsWithProducts = [{
            id: "legacy",
            order_id: orderData.id,
            product_id: orderData.product_id,
            quantity: 1,
            unit_price: orderData.price,
            total_price: orderData.price,
            created_at: orderData.created_at,
            product: product as ShopProduct,
          }];
        }
      }

      // Load shipping/payment
      let shipping: ShippingMethod | null = null;
      let paymentObj: PaymentMethod | null = null;

      if (orderData.shipping_method_id) {
        const { data } = await supabase.from("shipping_methods").select("*").eq("id", orderData.shipping_method_id).single();
        shipping = data as ShippingMethod | null;
      }
      if (orderData.payment_method_id) {
        const { data } = await supabase.from("payment_methods").select("*").eq("id", orderData.payment_method_id).single();
        paymentObj = data as PaymentMethod | null;
      }

      setOrder({
        ...(orderData as ShopOrder),
        items: itemsWithProducts,
        shipping,
        paymentObj,
      });
      setLoading(false);
    })();
  }, [orderNumber]);

  if (loading) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám objednávku...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Objednávka nenalezena
        </h1>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none" }}>← Zpět do shopu</Link>
      </div>
    );
  }

  const status = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280" };
  const isPending = order.status === "pending";
  const isPaid = order.status === "paid" || order.status === "processing" || order.status === "shipped" || order.status === "delivered";
  const showPaymentInfo = isPending && (order.payment_method === "bank-transfer" || order.payment_method === "qr-payment");
  const totalPrice = order.total_price || order.price;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 20px" }}>
      {/* Success banner */}
      <div
        style={{
          padding: "24px",
          background: isPaid ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
          border: `1px solid ${isPaid ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
          borderRadius: "12px",
          textAlign: "center",
          marginBottom: "32px",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>{isPaid ? "✅" : "📋"}</div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          {isPaid ? "Objednávka dokončena!" : "Objednávka přijata"}
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-muted)" }}>
          Číslo objednávky: <strong style={{ color: "var(--accent)" }}>{order.order_number}</strong>
        </p>
      </div>

      {/* Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Stav objednávky</span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            background: `${status.color}20`,
            color: status.color,
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Payment info for pending orders */}
      {showPaymentInfo && (
        <div
          style={{
            padding: "20px",
            background: "var(--bg-card)",
            border: "2px solid var(--accent)",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
            💳 Platební údaje
          </h3>
          <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.8 }}>
            <div><strong>Číslo účtu:</strong> XXXX/XXXX (bude doplněno)</div>
            <div><strong>Částka:</strong> {totalPrice} Kč</div>
            <div><strong>Variabilní symbol:</strong> {order.order_number.replace(/\D/g, "")}</div>
            <div><strong>Zpráva:</strong> {order.order_number}</div>
          </div>
          {order.paymentObj?.instructions && (
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "12px" }}>
              {order.paymentObj.instructions}
            </p>
          )}
        </div>
      )}

      {/* Products */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px" }}>Produkty</h3>
        {order.items.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                {item.product?.title || "Produkt"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {item.quantity}× {item.unit_price} Kč
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>
              {item.total_price === 0 ? "Zdarma" : `${item.total_price} Kč`}
            </div>
          </div>
        ))}

        {/* Totals */}
        <div style={{ marginTop: "12px", fontSize: "14px" }}>
          {order.shipping_price > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Doprava ({order.shipping?.name})</span>
              <span>{order.shipping_price} Kč</span>
            </div>
          )}
          {order.payment_surcharge > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Příplatek za platbu</span>
              <span>{order.payment_surcharge} Kč</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--border)", fontWeight: 700, fontSize: "18px", color: "var(--accent)" }}>
            <span>Celkem</span>
            <span>{totalPrice} Kč</span>
          </div>
        </div>
      </div>

      {/* Download links for paid digital orders */}
      {isPaid && order.items.some((i) => i.product?.file_url) && (
        <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#22c55e", marginBottom: "12px" }}>📥 Ke stažení</h3>
          {order.items.filter((i) => i.product?.file_url).map((item) => (
            <Link
              key={item.id}
              href={`/shop/${item.product?.slug}`}
              style={{ display: "block", color: "var(--accent)", textDecoration: "none", fontSize: "14px", marginBottom: "6px", fontWeight: 600 }}
            >
              📥 {item.product?.title}
            </Link>
          ))}
        </div>
      )}

      {/* Back links */}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
          ← Zpět do shopu
        </Link>
        <Link href="/objednavky" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>
          Moje objednávky
        </Link>
      </div>
    </div>
  );
}
