"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const adminSections = [
  { href: "/admin/homepage", icon: "🏠", title: "Homepage", desc: "Viditelnost sekcí na hlavní stránce" },
  { href: "/admin/shop", icon: "🛒", title: "Shop", desc: "Produkty, objednávky, kategorie, kupóny" },
  { href: "/admin/clanky", icon: "📝", title: "Články", desc: "Správa a moderování článků" },
  { href: "/admin/zakaznici", icon: "👥", title: "Zákazníci", desc: "Přehled registrovaných uživatelů" },
  { href: "/admin/sablony", icon: "📧", title: "Šablony", desc: "E-mailové šablony" },
  { href: "/admin/escrow", icon: "🛡️", title: "Escrow", desc: "Bezpečná platba, spory, nastavení" },
  { href: "/admin/bannery", icon: "🖼️", title: "Bannery", desc: "Homepage bannery, reklama, pozice, plánování" },
];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "32px" }}>
        ⚙️ Admin panel
      </h1>

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
