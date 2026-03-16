"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import QRCode from "qrcode";
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
  const [bankAccount, setBankAccount] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const { user } = useAuth();

  // Load bank account from shop settings
  useEffect(() => {
    fetch("/api/shop/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.company && typeof s.company === "object" && s.company.bank_account) {
          setBankAccount(s.company.bank_account);
        }
      })
      .catch(() => {});
  }, []);

  // Convert Czech account number (123456789/0800) to IBAN (CZ__0800...)
  function czechToIBAN(account: string): string {
    // If already IBAN format
    if (/^[A-Z]{2}\d{2}/.test(account.replace(/\s/g, ""))) {
      return account.replace(/\s/g, "");
    }

    // Parse prefix-number/bankCode
    const match = account.replace(/\s/g, "").match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
    if (!match) return account; // can't parse, return as-is

    const prefix = (match[1] || "").padStart(6, "0");
    const number = match[2].padStart(10, "0");
    const bankCode = match[3];

    // BBAN = bankCode (4) + prefix (6) + number (10) = 20 digits
    const bban = bankCode + prefix + number;

    // IBAN check: move CZ00 to end → bban + "1235" (C=12, Z=35) + "00"
    const numStr = bban + "123500";
    // Modulo 97 using string-based arithmetic (no BigInt needed)
    let remainder = 0;
    for (const ch of numStr) {
      remainder = (remainder * 10 + parseInt(ch)) % 97;
    }
    const checkDigits = (98 - remainder).toString().padStart(2, "0");

    return `CZ${checkDigits}${bban}`;
  }

  // Generate QR code for SPD payment
  useEffect(() => {
    if (!order || !bankAccount) return;
    const isPendingPayment = order.status === "pending" && (order.payment_method === "bank-transfer" || order.payment_method === "qr-payment");
    if (!isPendingPayment) return;

    const totalPrice = order.total_price || order.price;
    const vs = order.order_number.replace(/\D/g, "");
    const iban = czechToIBAN(bankAccount);
    const spd = `SPD*1.0*ACC:${iban}*AM:${totalPrice.toFixed(2)}*CC:CZK*MSG:${order.order_number}*X-VS:${vs}`;

    QRCode.toDataURL(spd, { width: 200, margin: 2 })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [order, bankAccount]);

  async function downloadInvoice(orderId: string, orderNum: string) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    // Build URL — for guests, pass email for verification
    let url = `/api/shop/invoice?orderId=${orderId}`;
    if (!token && order?.guest_email) {
      url += `&email=${encodeURIComponent(order.guest_email)}`;
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `faktura-${orderNum}.pdf`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  useEffect(() => {
    (async () => {
      // Try API route first (works for both guests and logged-in users)
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const apiRes = await fetch(`/api/shop/order?orderNumber=${encodeURIComponent(orderNumber)}`, { headers });

      if (apiRes.ok) {
        const data = await apiRes.json();
        setOrder({
          ...data,
          items: data.items || [],
          shipping: data.shipping || null,
          paymentObj: data.paymentObj || null,
        } as OrderDetail);
        setLoading(false);
        return;
      }

      // Fallback: direct Supabase query (logged-in users with RLS)
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
            vat_rate: (product as ShopProduct)?.vat_rate ?? 21,
            created_at: orderData.created_at,
            product: product as ShopProduct,
          }];
        }
      }

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
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>
          {order.status === "delivered" ? "✅" : order.status === "shipped" ? "📦" : order.status === "cancelled" ? "❌" : isPaid ? "💳" : "📋"}
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          {status.label}
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
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.8, flex: "1 1 200px" }}>
              {bankAccount && <div><strong>Číslo účtu:</strong> {bankAccount}</div>}
              <div><strong>Částka:</strong> {totalPrice} Kč</div>
              <div><strong>Variabilní symbol:</strong> {order.order_number.replace(/\D/g, "")}</div>
              <div><strong>Zpráva:</strong> {order.order_number}</div>
            </div>
            {qrDataUrl && (
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <img src={qrDataUrl} alt="QR platba" style={{ width: "160px", height: "160px", borderRadius: "8px" }} />
                <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "4px" }}>
                  Naskenujte v bankovní aplikaci
                </div>
              </div>
            )}
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

      {/* Shipping & Payment info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        {/* Billing address */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px" }}>🧾 Fakturační adresa</h3>
          <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.7 }}>
            {order.billing_company && <div style={{ fontWeight: 600 }}>{order.billing_company}</div>}
            <div>{order.billing_name}</div>
            {order.billing_street && <div>{order.billing_street}</div>}
            {(order.billing_city || order.billing_zip) && <div>{order.billing_city} {order.billing_zip}</div>}
            {order.billing_ico && <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>IČO: {order.billing_ico}</div>}
            {order.billing_dic && <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>DIČ: {order.billing_dic}</div>}
            {order.billing_email && <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: order.billing_ico ? "0" : "4px" }}>{order.billing_email}</div>}
            {order.billing_phone && <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Tel: {order.billing_phone}</div>}
          </div>
        </div>

        {/* Delivery address / Pickup point */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px" }}>
            {order.pickup_point_name ? "📍 Výdejní místo" : "📦 Doručovací adresa"}
          </h3>
          <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.7 }}>
            {order.pickup_point_name ? (
              <>
                {order.pickup_point_carrier && <div style={{ fontWeight: 600 }}>{order.pickup_point_carrier}</div>}
                <div>{order.pickup_point_name}</div>
                {order.pickup_point_address && <div>{order.pickup_point_address}</div>}
              </>
            ) : order.shipping_name ? (
              <>
                <div>{order.shipping_name}</div>
                {order.shipping_street && <div>{order.shipping_street}</div>}
                {(order.shipping_city || order.shipping_zip) && <div>{order.shipping_city} {order.shipping_zip}</div>}
              </>
            ) : (
              <div style={{ color: "var(--text-muted)" }}>Shodná s fakturační</div>
            )}
          </div>
        </div>
      </div>

      {/* Shipping & Payment methods */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>🚚 Doprava</h3>
          <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>
            {order.shipping?.name || "—"}
            {order.shipping_price > 0 && <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>{order.shipping_price} Kč</span>}
            {order.shipping_price === 0 && <span style={{ color: "#22c55e", marginLeft: "8px" }}>Zdarma</span>}
          </div>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>💳 Platba</h3>
          <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>
            {order.paymentObj?.name || order.payment_method || "—"}
            {order.payment_surcharge > 0 && <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>+{order.payment_surcharge} Kč</span>}
          </div>
        </div>
      </div>

      {/* Tracking & Timeline */}
      {(order.status === "shipped" || order.status === "delivered" || order.tracking_number) && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "16px" }}>📦 Sledování zásilky</h3>

          {/* Tracking number */}
          {order.tracking_number && (
            <div style={{ marginBottom: "16px", fontSize: "14px", color: "var(--text-primary)" }}>
              <span style={{ color: "var(--text-muted)" }}>Tracking číslo: </span>
              {order.tracking_url ? (
                <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                  {order.tracking_number} ↗
                </a>
              ) : (
                <strong>{order.tracking_number}</strong>
              )}
            </div>
          )}

          {/* Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { key: "pending", label: "Přijata", date: order.created_at, done: true },
              { key: "paid", label: "Zaplacena", date: order.paid_at, done: !!order.paid_at },
              { key: "shipped", label: "Odesláno", date: order.shipped_at, done: !!order.shipped_at },
              { key: "delivered", label: "Doručeno", date: order.delivered_at, done: !!order.delivered_at },
            ].map((step, i, arr) => (
              <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "24px" }}>
                  <div style={{
                    width: "20px", height: "20px", borderRadius: "50%",
                    background: step.done ? "var(--accent)" : "var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", color: step.done ? "var(--accent-text-on)" : "var(--text-dimmer)",
                    fontWeight: 700, flexShrink: 0,
                  }}>
                    {step.done ? "✓" : (i + 1)}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: "2px", height: "24px", background: step.done ? "var(--accent)" : "var(--border)" }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? "8px" : "0" }}>
                  <div style={{ fontSize: "14px", fontWeight: step.done ? 600 : 400, color: step.done ? "var(--text-primary)" : "var(--text-dimmer)" }}>
                    {step.label}
                  </div>
                  {step.done && step.date && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(step.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Invoice download — only after payment */}
      <div style={{ marginTop: "16px" }}>
        {isPaid ? (
          <button
            onClick={() => downloadInvoice(order.id, order.order_number)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            📄 Stáhnout fakturu
          </button>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            📄 Faktura bude dostupná po zaplacení objednávky.
          </p>
        )}
      </div>

      {/* Guest: CTA to create account */}
      {!user && order.guest_email && (
        <div
          style={{
            marginTop: "24px",
            padding: "20px",
            background: "rgba(139,92,246,0.06)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "15px", color: "var(--text-primary)", marginBottom: "12px", fontWeight: 600 }}>
            🎉 Chcete si vytvořit účet?
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
            Získáte přehled objednávek, věrnostní body a rychlejší nákupy příště.
          </p>
          <Link
            href={`/registrace?email=${encodeURIComponent(order.guest_email)}`}
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "opacity 0.2s",
            }}
          >
            Vytvořit účet
          </Link>
        </div>
      )}

      {/* Back links */}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <Link href="/shop" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
          ← Zpět do shopu
        </Link>
        {user && (
          <Link href="/objednavky" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>
            Moje objednávky
          </Link>
        )}
      </div>
    </div>
  );
}
