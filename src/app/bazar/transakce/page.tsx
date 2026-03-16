"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { getImageVariant } from "@/lib/image-variants";
import EscrowBadge from "@/components/Escrow/EscrowBadge";
import type { EscrowTransaction } from "@/types/database";

const STATUS_LABELS: Record<string, string> = {
  created: "Čeká na platbu",
  paid: "Zaplaceno",
  shipped: "Odesláno",
  delivered: "Doručeno",
  completed: "Dokončeno",
  auto_completed: "Automaticky dokončeno",
  disputed: "Spor",
  refunded: "Vráceno",
  cancelled: "Zrušeno",
};

const STATUS_COLORS: Record<string, string> = {
  created: "#f0a030",
  paid: "#22c55e",
  shipped: "#8b5cf6",
  delivered: "#3b82f6",
  completed: "#10b981",
  auto_completed: "#10b981",
  disputed: "#ef4444",
  refunded: "#f97316",
  cancelled: "#6b7280",
};

type RoleFilter = "all" | "buyer" | "seller";

export default function TransactionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<(EscrowTransaction & { listing_title?: string; listing_image?: string | null; other_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    async function fetchTransactions() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/prihlaseni"); return; }

      // Fetch all escrow transactions where user is buyer or seller
      let query = supabase
        .from("escrow_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (roleFilter === "buyer") {
        query = query.eq("buyer_id", userId);
      } else if (roleFilter === "seller") {
        query = query.eq("seller_id", userId);
      } else {
        query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
      }

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;

      if (data && data.length > 0) {
        // Fetch listing titles and other party names
        const listingIds = [...new Set(data.map(t => t.listing_id))];
        const otherIds = [...new Set(data.map(t => t.buyer_id === userId ? t.seller_id : t.buyer_id))];

        const [listingsRes, profilesRes] = await Promise.all([
          supabase.from("listings").select("id, title, images").in("id", listingIds),
          supabase.from("profiles").select("id, display_name, username").in("id", otherIds),
        ]);

        const listingsMap = new Map((listingsRes.data || []).map((l: { id: string; title: string; images?: string[] | null }) => [l.id, l]));
        const profilesMap = new Map((profilesRes.data || []).map((p: { id: string; display_name: string | null; username: string }) => [p.id, p.display_name || p.username]));

        setTransactions(data.map(t => ({
          ...t,
          listing_title: listingsMap.get(t.listing_id)?.title || "Neznámý inzerát",
          listing_image: listingsMap.get(t.listing_id)?.images?.[0] || null,
          other_name: profilesMap.get(t.buyer_id === userId ? t.seller_id : t.buyer_id) || "Anonym",
        })));
      } else {
        setTransactions([]);
      }
      setLoading(false);
    }

    fetchTransactions();
  }, [user, router, roleFilter, statusFilter]);

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>Pro zobrazení transakcí se přihlaste.</p>
        <Link href="/prihlaseni" style={{ color: "var(--accent)", textDecoration: "none" }}>Přihlásit se →</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <Link href="/bazar" style={{ color: "var(--text-dimmer)", textDecoration: "none", fontSize: "13px" }}>Bazar</Link>
        <span style={{ color: "var(--text-dimmer)", fontSize: "13px" }}>/</span>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>🛡️ Moje transakce</h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        {(["all", "buyer", "seller"] as RoleFilter[]).map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${roleFilter === r ? "var(--accent)" : "var(--border)"}`,
              background: roleFilter === r ? "var(--accent)" : "var(--bg-card)",
              color: roleFilter === r ? "var(--accent-text-on)" : "var(--text-muted)",
            }}
          >
            {r === "all" ? "Vše" : r === "buyer" ? "Kupující" : "Prodávající"}
          </button>
        ))}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "13px",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          <option value="">Všechny stavy</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám transakce...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🛡️</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Zatím nemáte žádné transakce</p>
          <Link href="/bazar" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "14px" }}>Prohlédnout bazar →</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {transactions.map(t => {
            const isBuyer = t.buyer_id === user?.id;
            return (
              <Link
                key={t.id}
                href={`/bazar/transakce/${t.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ width: "110px", flexShrink: 0 }}>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "75%", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-soft)" }}>
                      {t.listing_image ? (
                        <Image src={getImageVariant(t.listing_image, "thumb")} alt={t.listing_title || "Inzerát"} fill style={{ objectFit: "contain" }} sizes="110px" />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dimmer)", fontSize: "22px" }}>📦</div>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {t.listing_title}
                      </span>
                      <EscrowBadge size="sm" />
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-dimmer)" }}>
                      {isBuyer ? "Prodejce" : "Kupující"}: {t.other_name} · {t.payment_reference}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
                      {Number(t.amount).toLocaleString("cs-CZ")} Kč
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: `${STATUS_COLORS[t.status]}15`,
                        color: STATUS_COLORS[t.status],
                        border: `1px solid ${STATUS_COLORS[t.status]}30`,
                      }}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
