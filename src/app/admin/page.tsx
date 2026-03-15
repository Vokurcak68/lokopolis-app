"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const adminSections = [
  { href: "/admin/shop", icon: "🛒", title: "Shop", desc: "Produkty, objednávky, kategorie, kupóny" },
  { href: "/admin/clanky", icon: "📝", title: "Články", desc: "Správa a moderování článků" },
  { href: "/admin/zakaznici", icon: "👥", title: "Zákazníci", desc: "Přehled registrovaných uživatelů" },
  { href: "/admin/sablony", icon: "📧", title: "Šablony", desc: "E-mailové šablony" },
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
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "32px" }}>
        ⚙️ Admin panel
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {adminSections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "block",
              padding: "24px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              textDecoration: "none",
              transition: "border-color 0.2s",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>{s.icon}</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{s.title}</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
