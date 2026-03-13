"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { ShopProduct, ShopOrder } from "@/types/database";

import { getShopCategories, type ShopCategory, CATEGORY_META } from "@/lib/shop-categories";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivní",
  draft: "Koncept",
  archived: "Archivováno",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  draft: "#f59e0b",
  archived: "#6b7280",
};

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface OrderWithDetails extends ShopOrder {
  product: { title: string } | null;
  user: { username: string; display_name: string | null; email?: string } | null;
}

type AdminTab = "products" | "orders" | "add" | "edit";

export default function AdminShopPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AdminTab>("products");

  // Categories — loaded dynamically from products
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [customCategory, setCustomCategory] = useState("");

  // Build category labels
  const CATEGORY_LABELS: Record<string, string> = {};
  for (const c of categories) {
    CATEGORY_LABELS[c.slug] = `${c.emoji} ${c.name}`;
  }

  // Product list
  const [products, setProducts] = useState<ShopProduct[]>([]);

  // Orders
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>("pending");

  // Add/Edit form
  const [editProduct, setEditProduct] = useState<ShopProduct | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    long_description: "",
    price: 0,
    original_price: "",
    category: "kolejovy-plan" as string,
    scale: "",
    tags: "",
    featured: false,
    status: "active" as string,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check admin
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/prihlaseni");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    }
    checkAdmin();
  }, [router]);

  // Fetch categories dynamically from products
  const fetchCategories = useCallback(async () => {
    const cats = await getShopCategories();
    setCategories(cats);
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from("shop_products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts((data as ShopProduct[]) || []);
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from("shop_orders")
      .select("*, product:shop_products(title), user:profiles!shop_orders_user_id_fkey(username, display_name)")
      .order("created_at", { ascending: false });

    if (orderFilter) {
      query = query.eq("status", orderFilter);
    }

    const { data } = await query;
    setOrders((data as unknown as OrderWithDetails[]) || []);
  }, [orderFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchCategories();
      fetchProducts();
      fetchOrders();
    }
  }, [isAdmin, fetchCategories, fetchProducts, fetchOrders]);

  // Upload file to shop bucket
  async function uploadFile(file: File, folder: string): Promise<string | null> {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("shop").upload(path, file);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    return path;
  }

  // Save product
  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    try {
      let cover_image_url = editProduct?.cover_image_url || null;
      let preview_images = editProduct?.preview_images || [];
      let file_url = editProduct?.file_url || null;
      let file_name = editProduct?.file_name || null;
      let file_size = editProduct?.file_size || null;
      let file_type = editProduct?.file_type || null;

      // Upload cover image
      if (coverFile) {
        const path = await uploadFile(coverFile, "covers");
        if (path) {
          const { data: { publicUrl } } = supabase.storage.from("shop").getPublicUrl(path);
          cover_image_url = publicUrl;
        }
      }

      // Upload preview images
      if (previewFiles.length > 0) {
        const urls: string[] = [...preview_images];
        for (const file of previewFiles) {
          const path = await uploadFile(file, "previews");
          if (path) {
            const { data: { publicUrl } } = supabase.storage.from("shop").getPublicUrl(path);
            urls.push(publicUrl);
          }
        }
        preview_images = urls;
      }

      // Upload product file
      if (productFile) {
        const path = await uploadFile(productFile, "files");
        if (path) {
          file_url = path;
          file_name = productFile.name;
          file_size = productFile.size;
          file_type = productFile.name.split(".").pop() || null;
        }
      }

      const productData = {
        title: formData.title,
        slug: formData.slug || slugify(formData.title),
        description: formData.description || null,
        long_description: formData.long_description || null,
        price: formData.price,
        original_price: formData.original_price ? parseInt(formData.original_price) : null,
        category: formData.category,
        scale: formData.scale || null,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        featured: formData.featured,
        status: formData.status,
        cover_image_url,
        preview_images,
        file_url,
        file_name,
        file_size,
        file_type,
      };

      if (editProduct) {
        // Update
        const { error } = await supabase
          .from("shop_products")
          .update(productData)
          .eq("id", editProduct.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("shop_products")
          .insert(productData);

        if (error) throw error;
      }

      // Reset and go back to list
      resetForm();
      setTab("products");
      fetchProducts();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEditProduct(null);
    setFormData({
      title: "",
      slug: "",
      description: "",
      long_description: "",
      price: 0,
      original_price: "",
      category: "kolejovy-plan",
      scale: "",
      tags: "",
      featured: false,
      status: "active",
    });
    setCoverFile(null);
    setPreviewFiles([]);
    setProductFile(null);
    setSaveError(null);
  }

  function startEdit(product: ShopProduct) {
    setEditProduct(product);
    setFormData({
      title: product.title,
      slug: product.slug,
      description: product.description || "",
      long_description: product.long_description || "",
      price: product.price,
      original_price: product.original_price?.toString() || "",
      category: product.category,
      scale: product.scale || "",
      tags: product.tags?.join(", ") || "",
      featured: product.featured,
      status: product.status,
    });
    setTab("edit");
  }

  async function confirmPayment(orderId: string) {
    const { data: order } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!order) return;

    // Update order status
    await supabase
      .from("shop_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId);

    // Create purchase
    await supabase.from("user_purchases").insert({
      user_id: order.user_id,
      product_id: order.product_id,
      order_id: orderId,
    });

    fetchOrders();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Opravdu smazat tento produkt?")) return;
    await supabase.from("shop_products").delete().eq("id", id);
    fetchProducts();
  }

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
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}>
          🛒 Admin — Shop
        </h1>
        <Link
          href="/admin"
          style={{
            padding: "8px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-muted)",
            fontSize: "13px",
            textDecoration: "none",
          }}
        >
          ← Admin panel
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        {(["products", "orders", "add"] as AdminTab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === "add") resetForm();
              setTab(t);
            }}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: tab === t || (tab === "edit" && t === "add") ? "var(--accent)" : "var(--bg-card)",
              color: tab === t || (tab === "edit" && t === "add") ? "var(--accent-text-on)" : "var(--text-muted)",
            }}
          >
            {t === "products" ? "📦 Produkty" : t === "orders" ? "📋 Objednávky" : "➕ Přidat"}
          </button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {tab === "products" && (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["", "Název", "Kategorie", "Cena", "Stav", "Stažení", "Akce"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--text-dimmer)",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      {p.cover_image_url ? (
                        <div style={{ width: "48px", height: "36px", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
                          <Image src={p.cover_image_url} alt="" fill style={{ objectFit: "cover" }} sizes="48px" />
                        </div>
                      ) : (
                        <div style={{ width: "48px", height: "36px", borderRadius: "4px", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                          📦
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{p.slug}</div>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>
                      {CATEGORY_LABELS[p.category] || p.category}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: p.price === 0 ? "#22c55e" : "var(--accent)" }}>
                      {p.price === 0 ? "Zdarma" : `${p.price} Kč`}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: `${STATUS_COLORS[p.status]}20`,
                          color: STATUS_COLORS[p.status],
                        }}
                      >
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-dimmer)" }}>
                      {p.download_count}×
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => startEdit(p)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            cursor: "pointer",
                            border: "1px solid var(--border)",
                            background: "var(--bg-card)",
                            color: "var(--text-muted)",
                          }}
                        >
                          ✏️ Upravit
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            cursor: "pointer",
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: "rgba(239,68,68,0.1)",
                            color: "#ef4444",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {products.length === 0 && (
            <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-dimmer)" }}>
              Zatím žádné produkty. Přidejte první!
            </p>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === "orders" && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {["pending", "paid", "cancelled", ""].map((s) => (
              <button
                key={s}
                onClick={() => setOrderFilter(s)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${orderFilter === s ? "var(--accent)" : "var(--border)"}`,
                  background: orderFilter === s ? "var(--accent)" : "transparent",
                  color: orderFilter === s ? "var(--accent-text-on)" : "var(--text-muted)",
                }}
              >
                {s ? ORDER_STATUS_LABELS[s] : "Všechny"}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Číslo", "Produkt", "Uživatel", "Cena", "Stav", "Datum", "Akce"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--text-dimmer)",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
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
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>
                      {o.product?.title || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>
                      {o.user?.display_name || o.user?.username || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {o.price} Kč
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
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      {o.status === "pending" && (
                        <button
                          onClick={() => confirmPayment(o.id)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: "1px solid rgba(34,197,94,0.4)",
                            background: "rgba(34,197,94,0.1)",
                            color: "#22c55e",
                          }}
                        >
                          ✅ Potvrdit platbu
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orders.length === 0 && (
            <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-dimmer)" }}>
              Žádné objednávky v této kategorii
            </p>
          )}
        </div>
      )}

      {/* ADD / EDIT TAB */}
      {(tab === "add" || tab === "edit") && (
        <div style={{ maxWidth: "700px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>
            {editProduct ? `✏️ Upravit: ${editProduct.title}` : "➕ Přidat produkt"}
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Název *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  setFormData((f) => ({
                    ...f,
                    title: e.target.value,
                    slug: editProduct ? f.slug : slugify(e.target.value),
                  }));
                }}
                style={inputStyle}
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label style={labelStyle}>Slug (URL)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Category + Scale */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Kategorie *</label>
                <select
                  value={categories.some(c => c.slug === formData.category) || formData.category === "__custom__" ? formData.category : "__custom__"}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setFormData((f) => ({ ...f, category: "__custom__" }));
                    } else {
                      setCustomCategory("");
                      setFormData((f) => ({ ...f, category: e.target.value }));
                    }
                  }}
                  style={inputStyle}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.emoji} {c.name}</option>
                  ))}
                  <option value="__custom__">➕ Nová kategorie...</option>
                </select>
                {(formData.category === "__custom__" || (!categories.some(c => c.slug === formData.category) && formData.category !== "__custom__" && formData.category)) && (
                  <input
                    type="text"
                    value={customCategory || (formData.category !== "__custom__" ? formData.category : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomCategory(val);
                      const slug = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                      setFormData((f) => ({ ...f, category: slug }));
                    }}
                    placeholder="Název nové kategorie (např. Lokomotivy TT)"
                    style={{ ...inputStyle, marginTop: "8px" }}
                  />
                )}
              </div>
              <div>
                <label style={labelStyle}>Měřítko</label>
                <select
                  value={formData.scale}
                  onChange={(e) => setFormData((f) => ({ ...f, scale: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  <option value="TT">TT</option>
                  <option value="H0">H0</option>
                  <option value="N">N</option>
                  <option value="universal">Univerzální</option>
                </select>
              </div>
            </div>

            {/* Price + Original price */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Cena (Kč) — 0 = zdarma</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData((f) => ({ ...f, price: parseInt(e.target.value) || 0 }))}
                  style={inputStyle}
                  min={0}
                />
              </div>
              <div>
                <label style={labelStyle}>Původní cena (pro slevu)</label>
                <input
                  type="number"
                  value={formData.original_price}
                  onChange={(e) => setFormData((f) => ({ ...f, original_price: e.target.value }))}
                  style={inputStyle}
                  min={0}
                  placeholder="Prázdné = bez slevy"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Krátký popis (pro kartu)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                rows={3}
              />
            </div>

            {/* Long description */}
            <div>
              <label style={labelStyle}>Podrobný popis (HTML)</label>
              <textarea
                value={formData.long_description}
                onChange={(e) => setFormData((f) => ({ ...f, long_description: e.target.value }))}
                style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                rows={6}
              />
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tagy (čárkou oddělené)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData((f) => ({ ...f, tags: e.target.value }))}
                style={inputStyle}
                placeholder="TT, Tillig, kolejový plán"
              />
            </div>

            {/* Status + Featured */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Stav</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="active">Aktivní</option>
                  <option value="draft">Koncept</option>
                  <option value="archived">Archivováno</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "4px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: "var(--text-body)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData((f) => ({ ...f, featured: e.target.checked }))}
                  />
                  ⭐ Zvýrazněný produkt
                </label>
              </div>
            </div>

            {/* File uploads */}
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Náhledový obrázek</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  style={{ fontSize: "13px", color: "var(--text-body)" }}
                />
                {editProduct?.cover_image_url && !coverFile && (
                  <span style={{ fontSize: "12px", color: "var(--text-dimmer)", marginLeft: "8px" }}>
                    (aktuální obrázek zachován)
                  </span>
                )}
              </div>
              <div>
                <label style={labelStyle}>Galerie náhledů (více souborů)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPreviewFiles(Array.from(e.target.files || []))}
                  style={{ fontSize: "13px", color: "var(--text-body)" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Soubor ke stažení (PDF, ZIP, STL...)</label>
                <input
                  type="file"
                  onChange={(e) => setProductFile(e.target.files?.[0] || null)}
                  style={{ fontSize: "13px", color: "var(--text-body)" }}
                />
                {editProduct?.file_name && !productFile && (
                  <span style={{ fontSize: "12px", color: "var(--text-dimmer)", marginLeft: "8px" }}>
                    (aktuální: {editProduct.file_name})
                  </span>
                )}
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#ef4444", fontSize: "13px" }}>
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                onClick={() => { resetForm(); setTab("products"); }}
                style={{
                  padding: "12px 24px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.title}
                style={{
                  padding: "12px 24px",
                  background: saving ? "var(--border)" : "var(--accent)",
                  border: "none",
                  borderRadius: "10px",
                  color: "var(--accent-text-on)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Ukládám..." : editProduct ? "💾 Uložit změny" : "➕ Přidat produkt"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: "48px" }} />
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
