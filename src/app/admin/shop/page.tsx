"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { ShopProduct, ShopOrder, ShippingMethod, PaymentMethod, Coupon, LoyaltyLevel, ProductAttachment } from "@/types/database";
import { type ShopCategory, buildCategoryTree, type ShopCategoryTreeNode } from "@/lib/shop-categories";
import { getImageVariant } from "@/lib/image-variants";

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

interface CatFormState {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  active: boolean;
  parent_id: string | null;
}

type AdminTab = "products" | "orders" | "categories" | "shipping" | "payments" | "coupons" | "loyalty" | "add" | "edit";

export default function AdminShopPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AdminTab>("products");

  // Categories from DB (flat + all including inactive)
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [catForm, setCatForm] = useState<CatFormState>({
    slug: "", name: "", emoji: "📦", color: "#6b7280", sort_order: 0, active: true, parent_id: null,
  });
  const [editingCat, setEditingCat] = useState<ShopCategory | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  // Category tree (built from categories)
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Product counts per category slug
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  // Helper: get label for a category slug
  function catLabel(slug: string): string {
    const cat = categories.find((c) => c.slug === slug);
    return cat ? `${cat.emoji} ${cat.name}` : slug;
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
    category: "" as string,
    scale: "",
    tags: "",
    featured: false,
    status: "active" as string,
    stock_mode: "unlimited" as string,
    stock_quantity: null as number | null,
    stock_reserved: 0,
    stock_alert_threshold: 5,
    max_per_order: null as number | null,
  });
  // Attachments
  const [attachments, setAttachments] = useState<ProductAttachment[]>([]);
  const [attachTitle, setAttachTitle] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachSaving, setAttachSaving] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Fetch categories from DB table (all, including inactive)
  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("shop_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setCategories(data as ShopCategory[]);
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from("shop_products").select("*").order("created_at", { ascending: false });
    const prods = (data as ShopProduct[]) || [];
    setProducts(prods);

    // Count products per category
    const counts: Record<string, number> = {};
    for (const p of prods) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    setProductCounts(counts);
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from("shop_orders")
      .select("*, product:shop_products(title), user:profiles!shop_orders_user_id_fkey(username, display_name)")
      .order("created_at", { ascending: false });
    if (orderFilter) query = query.eq("status", orderFilter);
    const { data } = await query;
    setOrders((data as unknown as OrderWithDetails[]) || []);
  }, [orderFilter]);

  useEffect(() => {
    if (isAdmin) { fetchCategories(); fetchProducts(); fetchOrders(); }
  }, [isAdmin, fetchCategories, fetchProducts, fetchOrders]);

  // Upload file
  // Resize image with different modes
  async function resizeImage(
    file: File,
    targetWidth: number,
    targetHeight: number,
    mode: "contain" | "cover"
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      img.onload = () => {
        let { width, height } = img;
        let sx = 0, sy = 0, sw = width, sh = height;

        if (mode === "cover") {
          // Cover: fill target dimensions, crop excess
          const targetRatio = targetWidth / targetHeight;
          const imgRatio = width / height;

          if (imgRatio > targetRatio) {
            // Image is wider → crop sides
            sw = height * targetRatio;
            sx = (width - sw) / 2;
          } else {
            // Image is taller → crop top/bottom
            sh = width / targetRatio;
            sy = (height - sh) / 2;
          }
        } else {
          // Contain: fit inside, preserve aspect
          const ratio = Math.min(targetWidth / width, targetHeight / height);
          targetWidth = Math.round(width * ratio);
          targetHeight = Math.round(height * ratio);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/jpeg", 0.85);
      };

      img.onerror = () => reject(new Error("Image load failed"));
      img.src = URL.createObjectURL(file);
    });
  }

  // Upload cover image → create 3 variants (thumb, card, full)
  async function uploadCoverImage(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) return null;

    try {
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2);

      // 1. Thumbnail (200×200, cover crop)
      const thumbBlob = await resizeImage(file, 200, 200, "cover");
      const thumbPath = `covers/thumb_${timestamp}_${rand}.jpg`;
      const { error: thumbErr } = await supabase.storage.from("shop").upload(thumbPath, thumbBlob);
      if (thumbErr) throw thumbErr;

      // 2. Card (600×450, contain - full image visible)
      const cardBlob = await resizeImage(file, 600, 450, "contain");
      const cardPath = `covers/card_${timestamp}_${rand}.jpg`;
      const { error: cardErr } = await supabase.storage.from("shop").upload(cardPath, cardBlob);
      if (cardErr) throw cardErr;

      // 3. Full (1200×800, contain)
      const fullBlob = await resizeImage(file, 1200, 800, "contain");
      const fullPath = `covers/full_${timestamp}_${rand}.jpg`;
      const { error: fullErr } = await supabase.storage.from("shop").upload(fullPath, fullBlob);
      if (fullErr) throw fullErr;

      // Return card_ path (default for display)
      return cardPath;
    } catch (err) {
      console.error("Cover upload error:", err);
      return null;
    }
  }

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    // For cover images, use multi-variant upload
    if (folder === "covers" && file.type.startsWith("image/")) {
      return uploadCoverImage(file);
    }

    // For previews/downloads, keep simple resize
    let fileToUpload: Blob = file;
    if (file.type.startsWith("image/")) {
      fileToUpload = await resizeImage(file, 800, 600, "contain");
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("shop").upload(path, fileToUpload);
    if (error) { console.error("Upload error:", error); return null; }
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

      if (coverFile) {
        const path = await uploadFile(coverFile, "covers");
        if (path) {
          const { data: { publicUrl } } = supabase.storage.from("shop").getPublicUrl(path);
          console.log("📸 Cover upload:", { path, publicUrl });
          cover_image_url = publicUrl;
        }
      }
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
        stock_mode: formData.stock_mode,
        stock_quantity: formData.stock_quantity,
        stock_reserved: formData.stock_reserved || 0,
        stock_alert_threshold: formData.stock_alert_threshold || 5,
        max_per_order: formData.max_per_order,
        cover_image_url, preview_images, file_url, file_name, file_size, file_type,
      };

      console.log("💾 Product data before save:", { cover_image_url, preview_images });

      if (editProduct) {
        const { error } = await supabase.from("shop_products").update(productData).eq("id", editProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shop_products").insert(productData);
        if (error) throw error;
      }

      resetForm();
      setTab("products");
      fetchProducts();
      fetchCategories();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEditProduct(null);
    setAttachments([]);
    setAttachTitle("");
    setAttachFile(null);
    setFormData({
      title: "", slug: "", description: "", long_description: "",
      price: 0, original_price: "",
      category: categories[0]?.slug || "",
      scale: "", tags: "", featured: false, status: "active",
      stock_mode: "unlimited",
      stock_quantity: null,
      stock_reserved: 0,
      stock_alert_threshold: 5,
      max_per_order: null,
    });
    setCoverFile(null);
    setPreviewFiles([]);
    setProductFile(null);
    setSaveError(null);
  }

  function startEdit(product: ShopProduct) {
    setEditProduct(product);
    setFormData({
      title: product.title, slug: product.slug,
      description: product.description || "", long_description: product.long_description || "",
      price: product.price, original_price: product.original_price?.toString() || "",
      category: product.category, scale: product.scale || "",
      tags: product.tags?.join(", ") || "", featured: product.featured, status: product.status,
      stock_mode: product.stock_mode || "unlimited",
      stock_quantity: product.stock_quantity,
      stock_reserved: product.stock_reserved || 0,
      stock_alert_threshold: product.stock_alert_threshold || 5,
      max_per_order: product.max_per_order,
    });
    setTab("edit");
    fetchAttachments(product.id);
  }

  async function confirmPayment(orderId: string) {
    await updateOrderStatus(orderId, "paid");
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();
    if (newStatus === "shipped") updates.shipped_at = new Date().toISOString();
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();

    await supabase.from("shop_orders").update(updates).eq("id", orderId);

    // Auto-grant purchases + confirm stock sale when marking as paid
    if (newStatus === "paid") {
      const { data: order } = await supabase.from("shop_orders").select("*").eq("id", orderId).single();
      if (order?.user_id) {
        // Grant from order_items (new multi-product flow)
        const { data: items } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId);
        if (items && items.length > 0) {
          for (const item of items) {
            await supabase.from("user_purchases").upsert({ user_id: order.user_id, product_id: item.product_id, order_id: orderId }, { onConflict: "user_id,product_id" }).select();
            
            // Confirm stock sale (deduct quantity + reserved)
            await supabase.rpc("confirm_sale", {
              p_product_id: item.product_id,
              p_quantity: item.quantity,
              p_order_id: orderId,
            });
          }
        } else if (order.product_id) {
          // Legacy single-product order
          await supabase.from("user_purchases").upsert({ user_id: order.user_id, product_id: order.product_id, order_id: orderId }, { onConflict: "user_id,product_id" }).select();
          
          // Confirm stock sale for legacy
          await supabase.rpc("confirm_sale", {
            p_product_id: order.product_id,
            p_quantity: 1,
            p_order_id: orderId,
          });
        }
      }
    }

    // Release stock if order is cancelled
    if (newStatus === "cancelled" || newStatus === "refunded") {
      const { data: items } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId);
      if (items) {
        for (const item of items) {
          await supabase.rpc("release_stock", {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
            p_order_id: orderId,
          });
        }
      }
    }

    fetchOrders();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Opravdu smazat tento produkt?")) return;
    await supabase.from("shop_products").delete().eq("id", id);
    fetchProducts();
  }

  // === ATTACHMENTS ===
  async function fetchAttachments(productId: string) {
    const { data } = await supabase
      .from("product_attachments")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    setAttachments((data as ProductAttachment[]) || []);
  }

  async function addAttachment() {
    if (!editProduct || !attachFile || !attachTitle.trim()) return;
    setAttachSaving(true);
    try {
      const ext = attachFile.name.split(".").pop() || "bin";
      const path = `attachments/${editProduct.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("shop").upload(path, attachFile);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("shop").getPublicUrl(path);
      await supabase.from("product_attachments").insert({
        product_id: editProduct.id,
        title: attachTitle.trim(),
        file_url: publicUrl,
        file_name: attachFile.name,
        file_size: attachFile.size,
        file_type: ext,
        sort_order: attachments.length,
      });
      setAttachTitle("");
      setAttachFile(null);
      fetchAttachments(editProduct.id);
    } catch (e: unknown) {
      alert("Chyba při nahrávání: " + (e instanceof Error ? e.message : String(e)));
    }
    setAttachSaving(false);
  }

  async function deleteAttachment(att: ProductAttachment) {
    if (!confirm(`Smazat "${att.title}"?`)) return;
    // Delete file from storage
    const match = att.file_url.match(/\/shop\/(.+)$/);
    if (match) await supabase.storage.from("shop").remove([match[1]]);
    await supabase.from("product_attachments").delete().eq("id", att.id);
    if (editProduct) fetchAttachments(editProduct.id);
  }

  async function toggleFeatured(id: string, current: boolean) {
    await supabase.from("shop_products").update({ featured: !current }).eq("id", id);
    fetchProducts();
  }

  // === CATEGORY CRUD ===
  function resetCatForm() {
    setEditingCat(null);
    setCatForm({ slug: "", name: "", emoji: "📦", color: "#6b7280", sort_order: 0, active: true, parent_id: null });
  }

  async function handleSaveCategory() {
    setCatSaving(true);
    try {
      const payload = {
        name: catForm.name,
        slug: catForm.slug,
        emoji: catForm.emoji,
        color: catForm.color,
        sort_order: catForm.sort_order,
        active: catForm.active,
        parent_id: catForm.parent_id || null,
      };
      if (editingCat) {
        const { error } = await supabase.from("shop_categories").update(payload).eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shop_categories").insert(payload);
        if (error) throw error;
      }
      resetCatForm();
      fetchCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba při ukládání kategorie");
    } finally {
      setCatSaving(false);
    }
  }

  async function deleteCategory(cat: ShopCategory) {
    const count = productCounts[cat.slug] || 0;
    if (count > 0) {
      alert(`Nelze smazat — obsahuje ${count} produktů`);
      return;
    }
    // Also check children product counts
    const childSlugs = categories.filter((c) => c.parent_id === cat.id).map((c) => c.slug);
    const childCount = childSlugs.reduce((sum, s) => sum + (productCounts[s] || 0), 0);
    if (childCount > 0) {
      alert(`Nelze smazat — podkategorie obsahují ${childCount} produktů`);
      return;
    }
    if (!confirm(`Smazat kategorii "${cat.name}"?`)) return;
    await supabase.from("shop_categories").delete().eq("id", cat.id);
    fetchCategories();
  }

  // Start adding subcategory with prefilled parent
  function startAddSubcategory(parentCat: ShopCategoryTreeNode) {
    resetCatForm();
    setCatForm((f) => ({
      ...f,
      parent_id: parentCat.id,
      color: parentCat.color,
      emoji: parentCat.emoji,
      sort_order: (parentCat.children.length + 1) * 10 + parentCat.sort_order * 10,
    }));
  }

  // Root-level parents only (for parent select in cat form)
  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  // Hierarchical category select for product form
  const productCategorySelect = useMemo(() => {
    const tree = buildCategoryTree(categories.filter((c) => c.active));
    return tree;
  }, [categories]);

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
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}>🛒 Admin — Shop</h1>
        <Link href="/admin" style={{ padding: "8px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "13px", textDecoration: "none" }}>
          ← Admin panel
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", flexWrap: "wrap" }}>
        {(["products", "orders", "categories", "shipping", "payments", "coupons", "loyalty", "add"] as AdminTab[]).map((t) => {
          const labels: Record<string, string> = {
            products: "📦 Produkty", orders: "📋 Objednávky", categories: "🏷️ Kategorie",
            shipping: "🚚 Doprava", payments: "💳 Platby", coupons: "🎟️ Kupóny", loyalty: "⭐ Věrnost", add: "➕ Přidat",
          };
          return (
            <button
              key={t}
              onClick={() => { if (t === "add") resetForm(); if (t === "categories") resetCatForm(); setTab(t); }}
              style={{
                padding: "8px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none",
                background: tab === t || (tab === "edit" && t === "add") ? "var(--accent)" : "var(--bg-card)",
                color: tab === t || (tab === "edit" && t === "add") ? "var(--accent-text-on)" : "var(--text-muted)",
              }}
            >
              {labels[t] || t}
            </button>
          );
        })}
      </div>

      {/* ==================== PRODUCTS TAB ==================== */}
      {tab === "products" && (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["", "Název", "Kategorie", "Cena", "Stav", "Stažení", "Akce"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      {p.cover_image_url ? (
                        <div style={{ width: "64px", height: "48px", borderRadius: "4px", overflow: "hidden", position: "relative", background: "var(--bg-page)" }}>
                          <Image src={getImageVariant(p.cover_image_url, "card")} alt="" fill style={{ objectFit: "contain" }} sizes="64px" />
                        </div>
                      ) : (
                        <div style={{ width: "48px", height: "36px", borderRadius: "4px", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>📦</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{p.slug}</div>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>
                      {catLabel(p.category)}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: p.price === 0 ? "#22c55e" : "var(--accent)" }}>
                      {p.price === 0 ? "Zdarma" : `${p.price} Kč`}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status] }}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-dimmer)" }}>{p.download_count}×</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => toggleFeatured(p.id, p.featured)} title={p.featured ? "Odebrat z doporučených" : "Přidat do doporučených"} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", border: `1px solid ${p.featured ? "rgba(234,179,8,0.5)" : "var(--border)"}`, background: p.featured ? "rgba(234,179,8,0.15)" : "var(--bg-card)", color: p.featured ? "#eab308" : "var(--text-dimmer)" }}>{p.featured ? "⭐" : "☆"}</button>
                        <button onClick={() => startEdit(p)} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)" }}>✏️ Upravit</button>
                        <button onClick={() => deleteProduct(p.id)} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length === 0 && <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-dimmer)" }}>Zatím žádné produkty. Přidejte první!</p>}
        </div>
      )}

      {/* ==================== ORDERS TAB ==================== */}
      {tab === "orders" && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {["pending", "paid", "processing", "shipped", "delivered", "cancelled", ""].map((s) => (
              <button key={s} onClick={() => setOrderFilter(s)} style={{
                padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                border: `1px solid ${orderFilter === s ? "var(--accent)" : "var(--border)"}`,
                background: orderFilter === s ? "var(--accent)" : "transparent",
                color: orderFilter === s ? "var(--accent-text-on)" : "var(--text-muted)",
              }}>
                {s ? ORDER_STATUS_LABELS[s] : "Všechny"}
              </button>
            ))}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Číslo", "Produkt", "Uživatel", "Cena", "Stav", "Datum", "Akce"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--accent)" }}>{o.order_number}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>{o.product?.title || "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-body)" }}>{o.user?.display_name || o.user?.username || "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{o.total_price || o.price} Kč</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: `${ORDER_STATUS_COLORS[o.status] || "#6b7280"}20`, color: ORDER_STATUS_COLORS[o.status] || "#6b7280" }}>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-dimmer)" }}>
                      {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                      {o.billing_email && <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>{o.billing_email}</div>}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {o.status === "pending" && (
                          <button onClick={() => updateOrderStatus(o.id, "paid")} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>✅ Zaplaceno</button>
                        )}
                        {o.status === "paid" && (
                          <button onClick={() => updateOrderStatus(o.id, "processing")} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>📦 Zpracovat</button>
                        )}
                        {o.status === "processing" && (
                          <button onClick={() => updateOrderStatus(o.id, "shipped")} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>🚚 Odesláno</button>
                        )}
                        {o.status === "shipped" && (
                          <button onClick={() => updateOrderStatus(o.id, "delivered")} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>✓ Doručeno</button>
                        )}
                        {(o.status === "pending" || o.status === "paid") && (
                          <button onClick={() => updateOrderStatus(o.id, "cancelled")} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>✕ Zrušit</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-dimmer)" }}>Žádné objednávky v této kategorii</p>}
        </div>
      )}

      {/* ==================== CATEGORIES TAB ==================== */}
      {tab === "categories" && (
        <div style={{ maxWidth: "700px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>🏷️ Správa kategorií</h2>

          {/* Category form */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
              {editingCat ? `✏️ Upravit: ${editingCat.name}` : "➕ Přidat kategorii"}
            </h3>

            {/* Parent category select */}
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Nadřazená kategorie</label>
              <select
                value={catForm.parent_id || ""}
                onChange={(e) => setCatForm((f) => ({ ...f, parent_id: e.target.value || null }))}
                style={inputStyle}
              >
                <option value="">— Hlavní kategorie —</option>
                {rootCategories
                  .filter((c) => !editingCat || c.id !== editingCat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Name + Slug */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Název *</label>
                <input
                  value={catForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCatForm((f) => ({
                      ...f, name,
                      slug: editingCat ? f.slug : slugify(name),
                    }));
                  }}
                  style={inputStyle}
                  placeholder="Lokomotivy TT"
                />
              </div>
              <div>
                <label style={labelStyle}>Slug *</label>
                <input
                  value={catForm.slug}
                  onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
                  style={inputStyle}
                  placeholder="lokomotivy-tt"
                />
              </div>
            </div>

            {/* Emoji + Color + Sort + Active */}
            <div style={{ display: "grid", gridTemplateColumns: "100px 160px 100px auto", gap: "12px", marginBottom: "16px", alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Emoji</label>
                <input
                  value={catForm.emoji}
                  onChange={(e) => setCatForm((f) => ({ ...f, emoji: e.target.value }))}
                  style={{ ...inputStyle, fontSize: "20px", textAlign: "center" }}
                  placeholder="🚂"
                />
              </div>
              <div>
                <label style={labelStyle}>Barva</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={catForm.color}
                    onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                    style={{ width: "40px", height: "40px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent", padding: 0 }}
                  />
                  <input
                    value={catForm.color}
                    onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                    style={{ ...inputStyle, width: "90px", fontSize: "12px", fontFamily: "monospace" }}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Pořadí</label>
                <input
                  type="number"
                  value={catForm.sort_order}
                  onChange={(e) => setCatForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Aktivní</label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "10px 0" }}>
                  <input type="checkbox" checked={catForm.active} onChange={(e) => setCatForm((f) => ({ ...f, active: e.target.checked }))} style={{ width: "18px", height: "18px" }} />
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{catForm.active ? "Ano" : "Ne"}</span>
                </label>
              </div>
            </div>

            {/* Preview */}
            {catForm.name && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "var(--bg-page)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>Náhled:</span>
                <span style={{ fontSize: "20px" }}>{catForm.emoji}</span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: catForm.color }}>{catForm.name}</span>
                <span style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>({catForm.slug})</span>
                {catForm.parent_id && (
                  <span style={{ fontSize: "11px", color: "var(--text-dimmer)", background: "var(--bg-card)", padding: "2px 6px", borderRadius: "4px" }}>
                    podkat. {rootCategories.find((c) => c.id === catForm.parent_id)?.name || "?"}
                  </span>
                )}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                disabled={catSaving || !catForm.name.trim() || !catForm.slug.trim()}
                onClick={handleSaveCategory}
                style={{
                  padding: "10px 24px", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
                  background: catSaving || !catForm.name.trim() ? "var(--border-hover)" : "var(--accent)",
                  color: catSaving || !catForm.name.trim() ? "var(--text-dimmer)" : "var(--accent-text-on)",
                  cursor: catSaving || !catForm.name.trim() ? "not-allowed" : "pointer",
                }}
              >
                {catSaving ? "Ukládám..." : editingCat ? "💾 Uložit" : "➕ Přidat"}
              </button>
              {editingCat && (
                <button onClick={resetCatForm} style={{ padding: "10px 24px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "14px", cursor: "pointer" }}>
                  ✕ Zrušit
                </button>
              )}
            </div>
          </div>

          {/* Category tree list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {categories.length === 0 ? (
              <p style={{ color: "var(--text-dimmer)", textAlign: "center", padding: "24px" }}>
                Zatím žádné kategorie. Přidejte první, nebo spusťte migraci <code>013_shop_categories_hierarchy.sql</code>.
              </p>
            ) : (
              categoryTree.map((parent) => (
                <div key={parent.id}>
                  {/* Parent category row */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
                    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px",
                    opacity: parent.active ? 1 : 0.5,
                  }}>
                    <span style={{ fontSize: "24px" }}>{parent.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {parent.name}
                        {(productCounts[parent.slug] || 0) > 0 && (
                          <span style={{
                            marginLeft: "8px", padding: "1px 7px", borderRadius: "10px", fontSize: "11px",
                            fontWeight: 600, background: `${parent.color}20`, color: parent.color,
                          }}>
                            {productCounts[parent.slug]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>
                        {parent.slug} · pořadí {parent.sort_order}{!parent.active && " · neaktivní"}
                        {parent.children.length > 0 && ` · ${parent.children.length} podkat.`}
                      </div>
                    </div>
                    <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: parent.color, border: "1px solid var(--border)", flexShrink: 0 }} title={parent.color} />
                    <button
                      onClick={() => startAddSubcategory(parent)}
                      title="Přidat podkategorii"
                      style={{ padding: "6px 10px", background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "6px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
                    >+</button>
                    <button
                      onClick={() => {
                        setEditingCat(parent);
                        setCatForm({
                          slug: parent.slug, name: parent.name, emoji: parent.emoji,
                          color: parent.color, sort_order: parent.sort_order, active: parent.active,
                          parent_id: parent.parent_id,
                        });
                      }}
                      style={{ padding: "6px 14px", background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >✏️</button>
                    <button
                      onClick={() => deleteCategory(parent)}
                      style={{ padding: "6px 14px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >🗑️</button>
                  </div>

                  {/* Children rows */}
                  {parent.children.map((child) => (
                    <div key={child.id} style={{
                      display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px 10px 48px",
                      background: "var(--bg-card)", border: "1px solid var(--border)", borderTop: "none",
                      borderRadius: "0 0 10px 10px", opacity: child.active ? 1 : 0.5,
                      marginTop: "-1px",
                    }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>└</span>
                      <span style={{ fontSize: "18px" }}>{child.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {child.name}
                          {(productCounts[child.slug] || 0) > 0 && (
                            <span style={{
                              marginLeft: "8px", padding: "1px 7px", borderRadius: "10px", fontSize: "11px",
                              fontWeight: 600, background: `${child.color}20`, color: child.color,
                            }}>
                              {productCounts[child.slug]}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>
                          {child.slug} · pořadí {child.sort_order}{!child.active && " · neaktivní"}
                        </div>
                      </div>
                      <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: child.color, border: "1px solid var(--border)", flexShrink: 0 }} title={child.color} />
                      <button
                        onClick={() => {
                          setEditingCat(child);
                          setCatForm({
                            slug: child.slug, name: child.name, emoji: child.emoji,
                            color: child.color, sort_order: child.sort_order, active: child.active,
                            parent_id: child.parent_id,
                          });
                        }}
                        style={{ padding: "4px 10px", background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >✏️</button>
                      <button
                        onClick={() => deleteCategory(child)}
                        style={{ padding: "4px 10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >🗑️</button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== ADD / EDIT PRODUCT TAB ==================== */}
      {(tab === "add" || tab === "edit") && (
        <div style={{ maxWidth: "700px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>
            {editProduct ? `✏️ Upravit: ${editProduct.title}` : "➕ Přidat produkt"}
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Název *</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value, slug: editProduct ? f.slug : slugify(e.target.value) }))} style={inputStyle} required />
            </div>

            {/* Slug */}
            <div>
              <label style={labelStyle}>Slug (URL)</label>
              <input type="text" value={formData.slug} onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value }))} style={inputStyle} />
            </div>

            {/* Category + Scale */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Kategorie *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Vyberte —</option>
                  {productCategorySelect.map((parent) => {
                    if (parent.children.length === 0) {
                      return (
                        <option key={parent.slug} value={parent.slug}>
                          {parent.emoji} {parent.name}
                        </option>
                      );
                    }
                    return (
                      <optgroup key={parent.slug} label={`${parent.emoji} ${parent.name}`}>
                        {parent.children.map((child) => (
                          <option key={child.slug} value={child.slug}>
                            &nbsp;&nbsp;{child.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {categories.length === 0 && (
                  <p style={{ fontSize: "11px", color: "#f59e0b", marginTop: "4px" }}>
                    ⚠️ Nejsou žádné kategorie. Přidejte je v záložce &quot;Kategorie&quot;.
                  </p>
                )}
                {formData.category && !categories.some(c => c.slug === formData.category) && (
                  <p style={{ fontSize: "11px", color: "#f59e0b", marginTop: "4px" }}>
                    ⚠️ Kategorie &quot;{formData.category}&quot; není v DB. Přidejte ji v záložce &quot;Kategorie&quot;.
                  </p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Měřítko</label>
                <select value={formData.scale} onChange={(e) => setFormData((f) => ({ ...f, scale: e.target.value }))} style={inputStyle}>
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
                <input type="number" value={formData.price} onChange={(e) => setFormData((f) => ({ ...f, price: parseInt(e.target.value) || 0 }))} style={inputStyle} min={0} />
              </div>
              <div>
                <label style={labelStyle}>Původní cena (pro slevu)</label>
                <input type="number" value={formData.original_price} onChange={(e) => setFormData((f) => ({ ...f, original_price: e.target.value }))} style={inputStyle} min={0} placeholder="Prázdné = bez slevy" />
              </div>
            </div>

            {/* Stock management */}
            <div style={{ padding: "16px", background: "var(--bg-page)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>📦 Skladové zásoby</h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Režim zásob</label>
                  <select 
                    value={formData.stock_mode || "unlimited"} 
                    onChange={(e) => setFormData((f) => ({ ...f, stock_mode: e.target.value }))} 
                    style={inputStyle}
                  >
                    <option value="unlimited">Neomezené (digitální)</option>
                    <option value="tracked">Sledované (fyzické)</option>
                    <option value="preorder">Předobjednávka</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Počet kusů skladem</label>
                  <input 
                    type="number" 
                    value={formData.stock_quantity ?? ""} 
                    onChange={(e) => setFormData((f) => ({ ...f, stock_quantity: e.target.value === "" ? null : parseInt(e.target.value) }))} 
                    style={inputStyle} 
                    min={0}
                    disabled={formData.stock_mode === "unlimited"}
                    placeholder={formData.stock_mode === "unlimited" ? "N/A" : "0"}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Rezervováno (readonly)</label>
                  <input 
                    type="number" 
                    value={formData.stock_reserved ?? 0} 
                    style={{ ...inputStyle, background: "var(--bg-page)", cursor: "not-allowed" }} 
                    disabled
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                <div>
                  <label style={labelStyle}>Upozornění při zásobě ≤</label>
                  <input 
                    type="number" 
                    value={formData.stock_alert_threshold ?? 5} 
                    onChange={(e) => setFormData((f) => ({ ...f, stock_alert_threshold: parseInt(e.target.value) || 5 }))} 
                    style={inputStyle} 
                    min={0}
                    disabled={formData.stock_mode === "unlimited"}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Max kusů na objednávku</label>
                  <input 
                    type="number" 
                    value={formData.max_per_order ?? ""} 
                    onChange={(e) => setFormData((f) => ({ ...f, max_per_order: e.target.value === "" ? null : parseInt(e.target.value) }))} 
                    style={inputStyle} 
                    min={1}
                    placeholder="Neomezeno"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Krátký popis (pro kartu)</label>
              <textarea value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} rows={3} />
            </div>

            {/* Long description */}
            <div>
              <label style={labelStyle}>Podrobný popis (HTML)</label>
              <textarea value={formData.long_description} onChange={(e) => setFormData((f) => ({ ...f, long_description: e.target.value }))} style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} rows={6} />
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tagy (čárkou oddělené)</label>
              <input type="text" value={formData.tags} onChange={(e) => setFormData((f) => ({ ...f, tags: e.target.value }))} style={inputStyle} placeholder="TT, Tillig, kolejový plán" />
            </div>

            {/* Status + Featured */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Stav</label>
                <select value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">Aktivní</option>
                  <option value="draft">Koncept</option>
                  <option value="archived">Archivováno</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-body)", cursor: "pointer" }}>
                  <input type="checkbox" checked={formData.featured} onChange={(e) => setFormData((f) => ({ ...f, featured: e.target.checked }))} />
                  ⭐ Zvýrazněný produkt
                </label>
              </div>
            </div>

            {/* File uploads */}
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Náhledový obrázek</label>
                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} style={{ fontSize: "13px", color: "var(--text-body)" }} />
                {editProduct?.cover_image_url && !coverFile && <span style={{ fontSize: "12px", color: "var(--text-dimmer)", marginLeft: "8px" }}>(aktuální obrázek zachován)</span>}
              </div>
              <div>
                <label style={labelStyle}>Galerie náhledů (více souborů)</label>
                <input type="file" accept="image/*" multiple onChange={(e) => setPreviewFiles(Array.from(e.target.files || []))} style={{ fontSize: "13px", color: "var(--text-body)" }} />
              </div>
              <div>
                <label style={labelStyle}>Soubor ke stažení (PDF, ZIP, STL...)</label>
                <input type="file" onChange={(e) => setProductFile(e.target.files?.[0] || null)} style={{ fontSize: "13px", color: "var(--text-body)" }} />
                {editProduct?.file_name && !productFile && <span style={{ fontSize: "12px", color: "var(--text-dimmer)", marginLeft: "8px" }}>(aktuální: {editProduct.file_name})</span>}
              </div>
            </div>

            {/* Ke stažení (attachments) — only for existing products */}
            {editProduct && (
              <div style={{ background: "var(--bg-page)", borderRadius: "10px", padding: "16px", border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>📎 Ke stažení (přílohy)</h4>
                
                {/* Existing attachments */}
                {attachments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    {attachments.map((att) => (
                      <div key={att.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "16px" }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{att.title}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>
                            {att.file_name} {att.file_size ? `(${(att.file_size / 1024).toFixed(0)} KB)` : ""}
                          </div>
                        </div>
                        <a href={att.file_url} target="_blank" rel="noopener" style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", textDecoration: "none", cursor: "pointer" }}>👁️</a>
                        <button onClick={() => deleteAttachment(att)} style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer" }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new attachment */}
                <div style={{ display: "flex", gap: "8px", alignItems: "end", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "4px" }}>Název</label>
                    <input
                      type="text"
                      value={attachTitle}
                      onChange={(e) => setAttachTitle(e.target.value)}
                      placeholder="např. Návod k použití"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "13px" }}
                    />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "4px" }}>Soubor</label>
                    <input
                      type="file"
                      onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                      style={{ fontSize: "13px", color: "var(--text-muted)" }}
                    />
                  </div>
                  <button
                    onClick={addAttachment}
                    disabled={attachSaving || !attachTitle.trim() || !attachFile}
                    style={{
                      padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: attachSaving || !attachTitle.trim() || !attachFile ? "not-allowed" : "pointer",
                      border: "none", background: attachSaving ? "var(--border)" : "var(--accent)", color: "var(--accent-text-on)",
                    }}
                  >
                    {attachSaving ? "Nahrávám..." : "➕ Přidat"}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {saveError && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#ef4444", fontSize: "13px" }}>{saveError}</div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button onClick={() => { resetForm(); setTab("products"); }} style={{ padding: "12px 24px", background: "transparent", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Zrušit</button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.title || !formData.category}
                style={{
                  padding: "12px 24px", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600,
                  background: saving ? "var(--border)" : "var(--accent)",
                  color: "var(--accent-text-on)",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Ukládám..." : editProduct ? "💾 Uložit změny" : "➕ Přidat produkt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SHIPPING TAB ==================== */}
      {tab === "shipping" && <ShippingAdmin />}

      {/* ==================== PAYMENTS TAB ==================== */}
      {tab === "payments" && <PaymentsAdmin />}

      {/* ==================== COUPONS TAB ==================== */}
      {tab === "coupons" && <CouponsAdmin />}

      {/* ==================== LOYALTY TAB ==================== */}
      {tab === "loyalty" && <LoyaltyAdmin />}

      <div style={{ height: "48px" }} />
    </div>
  );
}

/* ==================== SHIPPING ADMIN COMPONENT ==================== */
function ShippingAdmin() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", price: 0, free_from: "" as string, delivery_days: "", digital_only: false, physical_only: false, active: true, sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("shipping_methods").select("*").order("sort_order");
    setMethods((data as ShippingMethod[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ name: "", slug: "", description: "", price: 0, free_from: "", delivery_days: "", digital_only: false, physical_only: false, active: true, sort_order: 0 });
    setEditing(null);
  }

  function startEdit(m: ShippingMethod) {
    setEditing(m);
    setForm({
      name: m.name, slug: m.slug, description: m.description || "", price: m.price,
      free_from: m.free_from?.toString() || "", delivery_days: m.delivery_days || "",
      digital_only: m.digital_only, physical_only: m.physical_only, active: m.active, sort_order: m.sort_order,
    });
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const slug = form.slug.trim() || slugify(form.name);
    const payload = {
      name: form.name, slug, description: form.description || null, price: form.price,
      free_from: form.free_from ? parseFloat(form.free_from) : null,
      delivery_days: form.delivery_days || null, digital_only: form.digital_only,
      physical_only: form.physical_only, active: form.active, sort_order: form.sort_order,
    };
    if (editing) {
      await supabase.from("shipping_methods").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("shipping_methods").insert(payload);
    }
    resetForm();
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Smazat způsob dopravy?")) return;
    await supabase.from("shipping_methods").delete().eq("id", id);
    load();
  }

  const fStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "14px" };

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Načítám...</p>;

  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>🚚 Způsoby dopravy</h2>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
        {methods.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", opacity: m.active ? 1 : 0.5 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{m.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {m.price} Kč · {m.delivery_days || "—"} {m.digital_only ? " · Jen digitální" : ""}{m.physical_only ? " · Jen fyzické" : ""}
                {m.free_from ? ` · Zdarma od ${m.free_from} Kč` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => startEdit(m)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>✏️</button>
              <button onClick={() => remove(m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ padding: "16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
          {editing ? "Upravit dopravní metodu" : "Přidat novou"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Název *</label>
            <input style={fStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Slug</label>
            <input style={fStyle} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Cena (Kč)</label>
            <input style={fStyle} type="number" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Zdarma od (Kč)</label>
            <input style={fStyle} type="number" placeholder="Prázdné = nikdy" value={form.free_from} onChange={(e) => setForm({ ...form, free_from: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Doba doručení</label>
            <input style={fStyle} placeholder="2-3 pracovní dny" value={form.delivery_days} onChange={(e) => setForm({ ...form, delivery_days: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Popis</label>
            <input style={fStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Pořadí</label>
            <input style={fStyle} type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.digital_only} onChange={(e) => setForm({ ...form, digital_only: e.target.checked, physical_only: false })} /> Jen digitální
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.physical_only} onChange={(e) => setForm({ ...form, physical_only: e.target.checked, digital_only: false })} /> Jen fyzické
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktivní
          </label>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button onClick={save} disabled={saving} style={{ padding: "10px 20px", background: "var(--accent)", color: "var(--accent-text-on)", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
            {saving ? "Ukládám..." : editing ? "💾 Uložit" : "➕ Přidat"}
          </button>
          {editing && (
            <button onClick={resetForm} style={{ padding: "10px 20px", background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "14px", cursor: "pointer" }}>
              Zrušit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== PAYMENTS ADMIN COMPONENT ==================== */
function PaymentsAdmin() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", instructions: "", surcharge: 0, active: true, sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("payment_methods").select("*").order("sort_order");
    setMethods((data as PaymentMethod[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ name: "", slug: "", description: "", instructions: "", surcharge: 0, active: true, sort_order: 0 });
    setEditing(null);
  }

  function startEdit(m: PaymentMethod) {
    setEditing(m);
    setForm({
      name: m.name, slug: m.slug, description: m.description || "",
      instructions: m.instructions || "", surcharge: m.surcharge, active: m.active, sort_order: m.sort_order,
    });
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const slug = form.slug.trim() || slugify(form.name);
    const payload = {
      name: form.name, slug, description: form.description || null,
      instructions: form.instructions || null, surcharge: form.surcharge, active: form.active, sort_order: form.sort_order,
    };
    if (editing) {
      await supabase.from("payment_methods").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("payment_methods").insert(payload);
    }
    resetForm();
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Smazat platební metodu?")) return;
    await supabase.from("payment_methods").delete().eq("id", id);
    load();
  }

  const fStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "14px" };

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Načítám...</p>;

  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>💳 Platební metody</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
        {methods.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", opacity: m.active ? 1 : 0.5 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{m.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {m.surcharge > 0 ? `+${m.surcharge} Kč příplatek` : "Bez příplatku"}
                {m.description ? ` · ${m.description}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => startEdit(m)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>✏️</button>
              <button onClick={() => remove(m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
          {editing ? "Upravit platební metodu" : "Přidat novou"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Název *</label>
            <input style={fStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Slug</label>
            <input style={fStyle} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Příplatek (Kč)</label>
            <input style={fStyle} type="number" step="1" value={form.surcharge} onChange={(e) => setForm({ ...form, surcharge: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Pořadí</label>
            <input style={fStyle} type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Popis</label>
            <input style={fStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Pokyny k platbě (zákazník uvidí po objednávce)</label>
            <textarea style={{ ...fStyle, minHeight: "60px", resize: "vertical" }} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktivní
          </label>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button onClick={save} disabled={saving} style={{ padding: "10px 20px", background: "var(--accent)", color: "var(--accent-text-on)", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
            {saving ? "Ukládám..." : editing ? "💾 Uložit" : "➕ Přidat"}
          </button>
          {editing && (
            <button onClick={resetForm} style={{ padding: "10px 20px", background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "14px", cursor: "pointer" }}>
              Zrušit
            </button>
          )}
        </div>
      </div>
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

// ==================== COUPONS ADMIN ====================
// ==================== LOYALTY ADMIN ====================
function LoyaltyAdmin() {
  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string; display_name: string | null; loyalty_points: number; loyalty_level_id: string | null }[]>([]);
  const [editLevel, setEditLevel] = useState<LoyaltyLevel | null>(null);
  const [levelForm, setLevelForm] = useState({ name: "", slug: "", min_points: "", discount_percent: "", points_multiplier: "1.0", color: "#cd7f32", icon: "⭐", perks: "" });
  const [bonusUserId, setBonusUserId] = useState("");
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusReason, setBonusReason] = useState("");

  useEffect(() => { fetchLevels(); fetchUsers(); }, []);

  async function fetchLevels() {
    const { data } = await supabase.from("loyalty_levels").select("*").order("sort_order", { ascending: true });
    if (data) setLevels(data);
  }

  async function fetchUsers() {
    const { data } = await supabase.from("profiles").select("id, username, display_name, loyalty_points, loyalty_level_id").order("loyalty_points", { ascending: false }).limit(50);
    if (data) setUsers(data);
  }

  function startEditLevel(l: LoyaltyLevel) {
    setEditLevel(l);
    setLevelForm({
      name: l.name, slug: l.slug, min_points: String(l.min_points),
      discount_percent: String(l.discount_percent), points_multiplier: String(l.points_multiplier),
      color: l.color, icon: l.icon, perks: l.perks?.join(", ") || "",
    });
  }

  function resetLevelForm() {
    setEditLevel(null);
    setLevelForm({ name: "", slug: "", min_points: "", discount_percent: "", points_multiplier: "1.0", color: "#cd7f32", icon: "⭐", perks: "" });
  }

  async function saveLevel() {
    if (!levelForm.name.trim() || !levelForm.slug.trim()) return;
    const payload = {
      name: levelForm.name.trim(),
      slug: levelForm.slug.trim(),
      min_points: parseInt(levelForm.min_points) || 0,
      discount_percent: parseFloat(levelForm.discount_percent) || 0,
      points_multiplier: parseFloat(levelForm.points_multiplier) || 1.0,
      color: levelForm.color,
      icon: levelForm.icon,
      perks: levelForm.perks ? levelForm.perks.split(",").map((s) => s.trim()).filter(Boolean) : [],
      sort_order: editLevel ? editLevel.sort_order : levels.length + 1,
    };
    if (editLevel) {
      await supabase.from("loyalty_levels").update(payload).eq("id", editLevel.id);
    } else {
      await supabase.from("loyalty_levels").insert(payload);
    }
    resetLevelForm();
    fetchLevels();
  }

  async function deleteLevel(id: string) {
    if (!confirm("Smazat úroveň?")) return;
    await supabase.from("loyalty_levels").delete().eq("id", id);
    fetchLevels();
  }

  async function grantBonus() {
    if (!bonusUserId || !bonusPoints) return;
    const pts = parseInt(bonusPoints);
    if (!pts) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      alert("Neplatná session. Přihlas se znovu.");
      return;
    }

    const res = await fetch("/api/shop/loyalty/admin-grant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId: bonusUserId, points: pts, reason: bonusReason || "admin" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Nepodařilo se přidělit body");
      return;
    }

    setBonusUserId("");
    setBonusPoints("");
    setBonusReason("");
    fetchUsers();
  }

  const lbl: React.CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "4px", display: "block" };
  const inp: React.CSSProperties = { ...inputStyle };

  return (
    <div style={{ maxWidth: "900px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>⭐ Věrnostní program</h2>

      {/* Level editor */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          {editLevel ? `✏️ Upravit: ${editLevel.name}` : "➕ Nová úroveň"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: "12px", marginBottom: "12px" }}>
          <div><label style={lbl}>Název *</label><input value={levelForm.name} onChange={(e) => setLevelForm((f) => ({ ...f, name: e.target.value }))} style={inp} placeholder="Zlatý" /></div>
          <div><label style={lbl}>Slug *</label><input value={levelForm.slug} onChange={(e) => setLevelForm((f) => ({ ...f, slug: e.target.value }))} style={inp} placeholder="gold" /></div>
          <div><label style={lbl}>Min. bodů</label><input type="number" value={levelForm.min_points} onChange={(e) => setLevelForm((f) => ({ ...f, min_points: e.target.value }))} style={inp} placeholder="0" /></div>
          <div><label style={lbl}>Ikona</label><input value={levelForm.icon} onChange={(e) => setLevelForm((f) => ({ ...f, icon: e.target.value }))} style={inp} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div><label style={lbl}>Sleva (%)</label><input type="number" step="0.5" value={levelForm.discount_percent} onChange={(e) => setLevelForm((f) => ({ ...f, discount_percent: e.target.value }))} style={inp} placeholder="5" /></div>
          <div><label style={lbl}>Násobitel bodů</label><input type="number" step="0.1" value={levelForm.points_multiplier} onChange={(e) => setLevelForm((f) => ({ ...f, points_multiplier: e.target.value }))} style={inp} placeholder="1.5" /></div>
          <div><label style={lbl}>Barva</label><input type="color" value={levelForm.color} onChange={(e) => setLevelForm((f) => ({ ...f, color: e.target.value }))} style={{ ...inp, padding: "4px", height: "38px" }} /></div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label style={lbl}>Výhody (čárkou oddělené)</label>
          <input value={levelForm.perks} onChange={(e) => setLevelForm((f) => ({ ...f, perks: e.target.value }))} style={inp} placeholder="5% sleva na vše, 1.5× body, Přednostní přístup" />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={saveLevel} style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--accent)", color: "var(--accent-text-on)" }}>
            {editLevel ? "💾 Uložit" : "➕ Vytvořit"}
          </button>
          {editLevel && <button onClick={resetLevelForm} style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)" }}>Zrušit</button>}
        </div>
      </div>

      {/* Levels list */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {levels.map((l) => (
          <div key={l.id} style={{ background: "var(--bg-card)", border: `2px solid ${l.color}`, borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "24px", marginBottom: "4px" }}>{l.icon}</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: l.color }}>{l.name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>od {l.min_points} b. · {l.discount_percent}% sleva · {l.points_multiplier}× body</div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={() => startEditLevel(l)} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)" }}>✏️</button>
              <button onClick={() => deleteLevel(l.id)} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Grant bonus points */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>🎁 Přidělit bonus body</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr auto", gap: "12px", alignItems: "end" }}>
          <div>
            <label style={lbl}>Uživatel</label>
            <select value={bonusUserId} onChange={(e) => setBonusUserId(e.target.value)} style={inp}>
              <option value="">— vyberte —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.loyalty_points} b.)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Bodů</label>
            <input type="number" value={bonusPoints} onChange={(e) => setBonusPoints(e.target.value)} style={inp} placeholder="100" />
          </div>
          <div>
            <label style={lbl}>Důvod</label>
            <input value={bonusReason} onChange={(e) => setBonusReason(e.target.value)} style={inp} placeholder="Bonus za recenzi" />
          </div>
          <button onClick={grantBonus} style={{ padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--accent)", color: "var(--accent-text-on)" }}>Přidělit</button>
        </div>
      </div>

      {/* Users leaderboard */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>🏆 Žebříček uživatelů</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["#", "Uživatel", "Body", "Úroveň"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => {
            const level = levels.find((l) => l.id === u.loyalty_level_id) || levels[0];
            return (
              <tr key={u.id}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", color: "var(--text-muted)" }}>{i + 1}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{u.display_name || u.username}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 700, color: "var(--accent)" }}>{u.loyalty_points}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                  {level && <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: `${level.color}20`, color: level.color }}>{level.icon} {level.name}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {users.length === 0 && <p style={{ textAlign: "center", padding: "24px 0", color: "var(--text-dimmer)" }}>Žádní uživatelé</p>}
    </div>
  );
}

function CouponsAdmin() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({
    code: "", description: "", discount_type: "percent" as "percent" | "fixed",
    discount_value: "", min_order_amount: "", max_discount: "", max_uses: "",
    max_uses_per_user: "1", valid_from: "", valid_until: "",
    first_order_only: false, active: true,
  });

  useEffect(() => { fetchCoupons(); }, []);

  async function fetchCoupons() {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (data) setCoupons(data);
  }

  function resetForm() {
    setEditing(null);
    setForm({
      code: "", description: "", discount_type: "percent", discount_value: "",
      min_order_amount: "", max_discount: "", max_uses: "", max_uses_per_user: "1",
      valid_from: "", valid_until: "", first_order_only: false, active: true,
    });
  }

  function editCoupon(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code, description: c.description || "", discount_type: c.discount_type as "percent" | "fixed",
      discount_value: String(c.discount_value), min_order_amount: c.min_order_amount ? String(c.min_order_amount) : "",
      max_discount: c.max_discount ? String(c.max_discount) : "", max_uses: c.max_uses ? String(c.max_uses) : "",
      max_uses_per_user: String(c.max_uses_per_user), valid_from: c.valid_from ? c.valid_from.slice(0, 16) : "",
      valid_until: c.valid_until ? c.valid_until.slice(0, 16) : "", first_order_only: c.first_order_only, active: c.active,
    });
  }

  async function saveCoupon() {
    if (!form.code.trim() || !form.discount_value) return;
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      max_uses_per_user: parseInt(form.max_uses_per_user) || 1,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      first_order_only: form.first_order_only,
      active: form.active,
    };
    if (editing) {
      await supabase.from("coupons").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("coupons").insert(payload);
    }
    resetForm();
    fetchCoupons();
  }

  async function deleteCoupon(id: string) {
    if (!confirm("Smazat tento kupón?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    fetchCoupons();
  }

  const lbl: React.CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", marginBottom: "4px", display: "block" };
  const inp: React.CSSProperties = { ...inputStyle };

  return (
    <div style={{ maxWidth: "900px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>🎟️ Správa kupónů</h2>

      {/* Form */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          {editing ? `✏️ Upravit: ${editing.code}` : "➕ Nový kupón"}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <label style={lbl}>Kód *</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} style={{ ...inp, textTransform: "uppercase", letterSpacing: "1px" }} placeholder="ZIMA2026" />
          </div>
          <div>
            <label style={lbl}>Typ slevy</label>
            <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "percent" | "fixed" }))} style={inp}>
              <option value="percent">Procenta (%)</option>
              <option value="fixed">Pevná částka (Kč)</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Hodnota slevy *</label>
            <input type="number" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} style={inp} placeholder={form.discount_type === "percent" ? "10" : "50"} />
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={lbl}>Popis (interní)</label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={inp} placeholder="Zimní sleva pro nové zákazníky" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <label style={lbl}>Min. objednávka (Kč)</label>
            <input type="number" value={form.min_order_amount} onChange={(e) => setForm((f) => ({ ...f, min_order_amount: e.target.value }))} style={inp} placeholder="—" />
          </div>
          <div>
            <label style={lbl}>Max. sleva (Kč)</label>
            <input type="number" value={form.max_discount} onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))} style={inp} placeholder="—" />
          </div>
          <div>
            <label style={lbl}>Max. použití celkem</label>
            <input type="number" value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))} style={inp} placeholder="∞" />
          </div>
          <div>
            <label style={lbl}>Max. na uživatele</label>
            <input type="number" value={form.max_uses_per_user} onChange={(e) => setForm((f) => ({ ...f, max_uses_per_user: e.target.value }))} style={inp} placeholder="1" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <label style={lbl}>Platný od</label>
            <input type="datetime-local" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Platný do</label>
            <input type="datetime-local" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} style={inp} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.first_order_only} onChange={(e) => setForm((f) => ({ ...f, first_order_only: e.target.checked }))} />
            Jen první objednávka
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Aktivní
          </label>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={saveCoupon} style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--accent)", color: "var(--accent-text-on)" }}>
            {editing ? "💾 Uložit" : "➕ Vytvořit"}
          </button>
          {editing && (
            <button onClick={resetForm} style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)" }}>Zrušit</button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Kód", "Sleva", "Omezení", "Použití", "Platnost", "Stav", "Akce"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "var(--text-dimmer)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 700, color: "var(--accent)", fontFamily: "monospace", letterSpacing: "1px" }}>{c.code}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} Kč`}
                  {c.max_discount && <span style={{ fontSize: "11px", color: "var(--text-dimmer)", marginLeft: "4px" }}>(max {c.max_discount} Kč)</span>}
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-muted)" }}>
                  {c.min_order_amount && <div>Min. {c.min_order_amount} Kč</div>}
                  {c.first_order_only && <div>🆕 Jen 1. objednávka</div>}
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "14px", color: "var(--text-primary)" }}>
                  {c.used_count}{c.max_uses !== null ? `/${c.max_uses}` : ""}×
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-muted)" }}>
                  {c.valid_from ? new Date(c.valid_from).toLocaleDateString("cs-CZ") : "—"}
                  {" → "}
                  {c.valid_until ? new Date(c.valid_until).toLocaleDateString("cs-CZ") : "∞"}
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: c.active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: c.active ? "#22c55e" : "#ef4444" }}>
                    {c.active ? "Aktivní" : "Neaktivní"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button onClick={() => editCoupon(c)} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)" }}>✏️</button>
                    <button onClick={() => deleteCoupon(c.id)} style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-dimmer)" }}>Zatím žádné kupóny</p>}
      </div>
    </div>
  );
}
