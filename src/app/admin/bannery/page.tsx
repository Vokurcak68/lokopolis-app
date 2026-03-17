"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { HomepageBanner, BannerPosition } from "@/types/database";
import { optimizeImageUrl } from "@/lib/image-variants";

const POSITIONS: { value: BannerPosition; label: string }[] = [
  { value: "hero_leaderboard", label: "🏠 Leaderboard (pod hero)" },
  { value: "article_native", label: "📰 Nativní karta v článcích" },
  { value: "bazar_native", label: "🛒 Nativní karta v bazaru" },
  { value: "sidebar_native", label: "📌 Sidebar (vedle článků)" },
];

const EMPTY_FORM = {
  position: "hero_leaderboard" as BannerPosition,
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  badge_text: "Sponzorováno",
  starts_at: "",
  ends_at: "",
  priority: 0,
  is_active: true,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchBanners = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const res = await fetch("/api/banners?all=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBanners(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  async function apiCall(method: string, body?: Record<string, unknown>, params?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const url = `/api/banners${params ? `?${params}` : ""}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res;
  }

  async function handleSave() {
    if (!form.title.trim() || !form.link_url.trim()) {
      setError("Název a odkaz jsou povinné");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        subtitle: form.subtitle || null,
        image_url: form.image_url || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      };

      if (editId) {
        const res = await apiCall("PUT", { id: editId, ...payload });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await apiCall("POST", payload);
        if (!res.ok) throw new Error((await res.json()).error);
      }
      setEditId(null);
      setForm({ ...EMPTY_FORM });
      await fetchBanners();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Opravdu smazat banner?")) return;
    await apiCall("DELETE", undefined, `id=${id}`);
    await fetchBanners();
  }

  async function handleToggle(banner: HomepageBanner) {
    await apiCall("PUT", { id: banner.id, is_active: !banner.is_active });
    await fetchBanners();
  }

  function startEdit(b: HomepageBanner) {
    setEditId(b.id);
    setForm({
      position: b.position as BannerPosition,
      title: b.title,
      subtitle: b.subtitle || "",
      image_url: b.image_url || "",
      link_url: b.link_url,
      badge_text: b.badge_text || "Sponzorováno",
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : "",
      ends_at: b.ends_at ? b.ends_at.slice(0, 16) : "",
      priority: b.priority,
      is_active: b.is_active,
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `banners/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("images").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path);
      setForm(f => ({ ...f, image_url: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba uploadu");
    } finally {
      setUploading(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "14px" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--text-secondary)" };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítám...</div>;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "32px" }}>🖼️ Správa bannerů</h1>

      {/* Form */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px" }}>
          {editId ? "✏️ Upravit banner" : "➕ Nový banner"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Pozice</label>
            <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value as BannerPosition }))} style={inputStyle}>
              {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priorita (vyšší = víc nahoře)</label>
            <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} style={inputStyle} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Název *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Např. Tillig TT — novinky 2026" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Podnázev</label>
            <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} style={inputStyle} placeholder="Volitelný popis" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Odkaz *</label>
            <input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} style={inputStyle} placeholder="https://..." />
          </div>
          <div>
            <label style={labelStyle}>Badge text</label>
            <input value={form.badge_text} onChange={e => setForm(f => ({ ...f, badge_text: e.target.value }))} style={inputStyle} placeholder="Sponzorováno" />
          </div>
          <div>
            <label style={labelStyle}>Obrázek</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ fontSize: "13px" }} />
              {uploading && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>⏳</span>}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              {form.position === "hero_leaderboard"
                ? "Doporučená velikost: 1200 × 150 px (leaderboard)"
                : form.position === "sidebar_native"
                ? "Doporučená velikost: 340 × 255 px (4:3)"
                : "Doporučená velikost: 600 × 450 px (4:3)"}
            </p>
            {form.image_url && (
              <div style={{ marginTop: "8px", width: "200px", height: "60px", position: "relative", borderRadius: "6px", overflow: "hidden", background: "var(--bg-page)" }}>
                <Image src={optimizeImageUrl(form.image_url, 400)} alt="Preview" fill style={{ objectFit: "contain" }} sizes="200px" unoptimized />
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Zobrazit od</label>
            <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Zobrazit do</label>
            <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="is_active" style={{ fontSize: "14px", cursor: "pointer" }}>Aktivní</label>
          </div>
        </div>

        {error && <p style={{ color: "#ef4444", marginTop: "12px", fontSize: "13px" }}>{error}</p>}

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={handleSave} disabled={saving} style={{ padding: "10px 24px", borderRadius: "8px", background: "var(--accent)", color: "#000", fontWeight: 600, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Ukládám..." : editId ? "💾 Uložit" : "➕ Vytvořit"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); }} style={{ padding: "10px 24px", borderRadius: "8px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
              Zrušit
            </button>
          )}
        </div>
      </div>

      {/* Banner list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {banners.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>Žádné bannery. Vytvořte první ☝️</p>
        )}
        {banners.map(b => (
          <div key={b.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px", display: "flex", gap: "16px", alignItems: "center", opacity: b.is_active ? 1 : 0.5 }}>
            {b.image_url && (
              <div style={{ width: "120px", height: "80px", position: "relative", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "var(--bg-page)" }}>
                <Image src={optimizeImageUrl(b.image_url || "", 240)} alt="" fill style={{ objectFit: "contain" }} sizes="120px" unoptimized />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "var(--accent)", color: "#000", fontWeight: 600 }}>
                  {POSITIONS.find(p => p.value === b.position)?.label || b.position}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>P:{b.priority}</span>
                {!b.is_active && <span style={{ fontSize: "11px", color: "#ef4444" }}>⛔ neaktivní</span>}
              </div>
              <strong style={{ fontSize: "14px" }}>{b.title}</strong>
              {b.subtitle && <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>{b.subtitle}</p>}
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                👁 {b.impressions} | 🖱 {b.clicks} | CTR: {b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(1) : "0.0"}%
                {b.starts_at && <> | Od: {new Date(b.starts_at).toLocaleDateString("cs-CZ")}</>}
                {b.ends_at && <> | Do: {new Date(b.ends_at).toLocaleDateString("cs-CZ")}</>}
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button onClick={() => handleToggle(b)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: "13px" }}>
                {b.is_active ? "⛔" : "✅"}
              </button>
              <button onClick={() => startEdit(b)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: "13px" }}>
                ✏️
              </button>
              <button onClick={() => handleDelete(b.id)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#ef4444" }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
