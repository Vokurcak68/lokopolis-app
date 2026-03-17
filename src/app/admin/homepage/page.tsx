"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface SectionConfig {
  key: string;
  label: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { key: "leaderboard_banner", label: "Horní banner", description: "Reklamní banner pod hero sekcí" },
  { key: "latest_articles", label: "Nejnovější z komunity", description: "Nejnovější články + postranní panel s fórem a bazarem" },
  { key: "forum_bar", label: "Aktivní diskuze", description: "Lišta se statistikami fóra a odkazem" },
  { key: "categories", label: "Kategorie", description: "Mřížka kategorií článků" },
  { key: "cta_strip", label: "CTA proužek", description: "Rotující reklamní proužek (bazar, články, shop)" },
  { key: "stats_bar", label: "Statistiky", description: "Počty článků, členů, souborů, fotek, diskuzí" },
  { key: "inline_banner", label: "Inline banner (soutěž)", description: "Banner pro aktivní soutěž" },
  { key: "bazar", label: "Nejnovější v bazaru", description: "Nejnovější inzeráty z bazaru" },
  { key: "competition", label: "Soutěž", description: "Kolejiště měsíce — soutěžní sekce" },
  { key: "shop_products", label: "Doporučené produkty", description: "Doporučené produkty z eshopu" },
  { key: "downloads", label: "Ke stažení", description: "Poslední soubory ke stažení" },
  { key: "popular_articles", label: "Populární tento měsíc", description: "Nejčtenější články za posledních 30 dní" },
  { key: "events", label: "Nadcházející akce", description: "Kalendář akcí v postranním panelu" },
  { key: "active_authors", label: "Aktivní autoři", description: "Top autoři v postranním panelu" },
  { key: "forum_widget", label: "Fórum widget", description: "Widget fóra v postranním panelu" },
  { key: "tags", label: "Štítky", description: "Populární štítky v postranním panelu" },
];

export default function AdminHomepagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

      // Fetch current settings
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      try {
        const res = await fetch("/api/admin/homepage-sections", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSections(data);
        }
      } catch {
        // Use defaults
        const defaults: Record<string, boolean> = {};
        SECTIONS.forEach(s => { defaults[s.key] = true; });
        setSections(defaults);
      }
      setLoading(false);
    })();
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("/api/admin/homepage-sections", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sections),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Nastavení uloženo!" });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Chyba při ukládání" });
      }
    } catch {
      setMessage({ type: "error", text: "Chyba při ukládání" });
    } finally {
      setSaving(false);
    }
  }

  function toggleSection(key: string) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll(value: boolean) {
    const updated: Record<string, boolean> = {};
    SECTIONS.forEach(s => { updated[s.key] = value; });
    setSections(updated);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
        <Link
          href="/admin"
          style={{
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: "13px",
          }}
        >
          ← Zpět
        </Link>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
          🏠 Sekce na homepage
        </h1>
      </div>

      <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" }}>
        Zaškrtněte sekce, které chcete zobrazit na hlavní stránce. Nezaškrtnuté sekce budou skryté.
      </p>

      {/* Hromadné akce */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => toggleAll(true)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          ✅ Vše zapnout
        </button>
        <button
          onClick={() => toggleAll(false)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          ⛔ Vše vypnout
        </button>
      </div>

      {/* Seznam sekcí */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {SECTIONS.map((section, i) => (
          <label
            key={section.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px 20px",
              borderBottom: i < SECTIONS.length - 1 ? "1px solid var(--border)" : "none",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-page)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <input
              type="checkbox"
              checked={sections[section.key] ?? true}
              onChange={() => toggleSection(section.key)}
              style={{
                width: "20px",
                height: "20px",
                accentColor: "var(--accent)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                {section.label}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                {section.description}
              </div>
            </div>
            <div style={{
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              background: sections[section.key] ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: sections[section.key] ? "#22c55e" : "#ef4444",
            }}>
              {sections[section.key] ? "Zobrazeno" : "Skryto"}
            </div>
          </label>
        ))}
      </div>

      {/* Uložit */}
      <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "12px 32px",
            borderRadius: "10px",
            background: "var(--accent)",
            color: "var(--accent-text-on, #000)",
            fontWeight: 700,
            fontSize: "15px",
            border: "none",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Ukládám..." : "💾 Uložit"}
        </button>
        {message && (
          <span style={{
            fontSize: "14px",
            fontWeight: 600,
            color: message.type === "success" ? "#22c55e" : "#ef4444",
          }}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
