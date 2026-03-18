"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface MenuItemConfig {
  key: string;
  label: string;
  description: string;
  href: string;
  group?: string;
}

const MENU_ITEMS: MenuItemConfig[] = [
  { key: "home", label: "Domů", description: "Odkaz na hlavní stránku", href: "/" },
  { key: "articles", label: "Články", description: "Sekce článků", href: "/clanky" },
  { key: "forum", label: "Fórum", description: "Komunitní diskuzní fórum", href: "/forum", group: "Komunita" },
  { key: "gallery", label: "Galerie", description: "Fotogalerie a videa", href: "/galerie", group: "Komunita" },
  { key: "events", label: "Akce", description: "Kalendář akcí a srazů", href: "/akce", group: "Komunita" },
  { key: "competition", label: "Soutěž", description: "Kolejiště měsíce", href: "/soutez", group: "Komunita" },
  { key: "shop", label: "Shop", description: "E-shop s digitálními produkty", href: "/shop", group: "Obchod" },
  { key: "bazar", label: "Bazar", description: "C2C tržiště pro modeláře", href: "/bazar", group: "Obchod" },
  { key: "downloads", label: "Ke stažení", description: "Soubory ke stažení", href: "/ke-stazeni", group: "Obchod" },
];

export default function AdminMenuPage() {
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

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      try {
        const res = await fetch("/api/admin/menu-sections", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSections(data);
        }
      } catch {
        const defaults: Record<string, boolean> = {};
        MENU_ITEMS.forEach(s => { defaults[s.key] = true; });
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
      const res = await fetch("/api/admin/menu-sections", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sections),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Nastavení menu uloženo! Změny se projeví po refreshi stránky." });
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
    MENU_ITEMS.forEach(s => { updated[s.key] = value; });
    setSections(updated);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Načítám...</p>
      </div>
    );
  }

  // Group items for display
  const ungrouped = MENU_ITEMS.filter(i => !i.group);
  const groups = [...new Set(MENU_ITEMS.filter(i => i.group).map(i => i.group!))];

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
          📋 Položky menu
        </h1>
      </div>

      <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" }}>
        Zaškrtněte položky, které chcete zobrazit v navigačním menu. Nezaškrtnuté položky budou skryté pro všechny uživatele.
      </p>

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

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {/* Ungrouped items */}
        {ungrouped.map((item, i) => (
          <MenuRow
            key={item.key}
            item={item}
            checked={sections[item.key] ?? true}
            onToggle={() => toggleSection(item.key)}
            showBorder={i < ungrouped.length - 1 || groups.length > 0}
          />
        ))}

        {/* Grouped items */}
        {groups.map((group, gi) => {
          const items = MENU_ITEMS.filter(i => i.group === group);
          return (
            <div key={group}>
              <div style={{
                padding: "12px 20px 6px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                borderTop: "1px solid var(--border)",
                background: "var(--bg-page)",
              }}>
                {group}
              </div>
              {items.map((item, ii) => (
                <MenuRow
                  key={item.key}
                  item={item}
                  checked={sections[item.key] ?? true}
                  onToggle={() => toggleSection(item.key)}
                  showBorder={ii < items.length - 1 || gi < groups.length - 1}
                />
              ))}
            </div>
          );
        })}
      </div>

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

function MenuRow({ item, checked, onToggle, showBorder }: {
  item: MenuItemConfig;
  checked: boolean;
  onToggle: () => void;
  showBorder: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 20px",
        borderBottom: showBorder ? "1px solid var(--border)" : "none",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-page)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
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
          {item.label}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
          {item.description} — <code style={{ fontSize: "11px", opacity: 0.7 }}>{item.href}</code>
        </div>
      </div>
      <div style={{
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 600,
        background: checked ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        color: checked ? "#22c55e" : "#ef4444",
      }}>
        {checked ? "Zobrazeno" : "Skryto"}
      </div>
    </label>
  );
}
