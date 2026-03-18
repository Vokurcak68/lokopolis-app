"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { EscrowDispute, EscrowTransaction, Listing } from "@/types/database";

type MainTab = "overview" | "disputes" | "settings";
type TxGroup = "action" | "active" | "done" | "all";
type SortKey = "date" | "score" | "amount";
type SortDir = "asc" | "desc";

// Stavy vyžadující akci admina
const ACTION_STATUSES = ["created", "partial_paid", "hold", "completed", "auto_completed", "payout_sent"];
// Aktivní (v procesu) — admin nemusí nic dělat
const ACTIVE_STATUSES = ["paid", "shipped", "delivered"];
// Ukončené
const DONE_STATUSES = ["payout_confirmed", "refunded", "cancelled"];

function getGroup(t: EscrowTransaction): TxGroup {
  // Problémové zásilky (ShieldTrack) → vždy "action"
  if (t.st_score !== null && t.st_score !== undefined && t.st_score < 40) return "action";
  if (t.st_status === "failed") return "action";
  // Otevřené spory → action
  if (t.status === "disputed") return "action";
  if (ACTION_STATUSES.includes(t.status)) return "action";
  if (ACTIVE_STATUSES.includes(t.status)) return "active";
  if (DONE_STATUSES.includes(t.status)) return "done";
  return "active";
}

function scoreIndicator(score: number | null): string {
  if (score === null || score === undefined) return "⚪";
  if (score >= 80) return "🟢";
  if (score >= 40) return "🟡";
  return "🔴";
}

function statusLabel(status: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    created: { text: "Čeká na platbu", color: "#f59e0b" },
    partial_paid: { text: "Částečně zaplaceno", color: "#f97316" },
    paid: { text: "Zaplaceno", color: "#3b82f6" },
    shipped: { text: "Odesláno", color: "#8b5cf6" },
    delivered: { text: "Doručeno", color: "#06b6d4" },
    completed: { text: "Dokončeno — čeká výplata", color: "#22c55e" },
    auto_completed: { text: "Auto-dokončeno — čeká výplata", color: "#22c55e" },
    payout_sent: { text: "Výplata odeslána", color: "#10b981" },
    payout_confirmed: { text: "Výplata potvrzena ✅", color: "#6b7280" },
    hold: { text: "⚠️ Pozastaveno", color: "#ef4444" },
    disputed: { text: "🔥 Spor", color: "#ef4444" },
    refunded: { text: "Vráceno", color: "#6b7280" },
    cancelled: { text: "Zrušeno", color: "#6b7280" },
  };
  return map[status] || { text: status, color: "var(--text-muted)" };
}

export default function AdminEscrowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [txGroup, setTxGroup] = useState<TxGroup>("action");
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [listingMap, setListingMap] = useState<Record<string, Listing>>({});
  const [buyerMap, setBuyerMap] = useState<Record<string, string>>({});
  const [sellerMap, setSellerMap] = useState<Record<string, string>>({});
  const [disputes, setDisputes] = useState<EscrowDispute[]>([]);
  const [partialFormId, setPartialFormId] = useState<string | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [holdFormId, setHoldFormId] = useState<string | null>(null);
  const [holdReasonInput, setHoldReasonInput] = useState("");
  const [holdLoading, setHoldLoading] = useState(false);

  async function authAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/prihlaseni"); return null; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") { router.push("/"); return null; }
    return user;
  }

  async function fetchAll() {
    const admin = await authAdmin();
    if (!admin) return;

    const [{ data: tx }, { data: dsp }] = await Promise.all([
      supabase.from("escrow_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("escrow_disputes").select("*").order("created_at", { ascending: false }),
    ]);
    const txList = (tx || []) as EscrowTransaction[];
    setTransactions(txList);
    setDisputes((dsp || []) as EscrowDispute[]);

    // Fetch listing titles
    const listingIds = [...new Set(txList.map(t => t.listing_id))];
    if (listingIds.length > 0) {
      const { data: listings } = await supabase.from("listings").select("id, title").in("id", listingIds);
      if (listings) {
        const map: Record<string, Listing> = {};
        for (const l of listings) map[l.id] = l as Listing;
        setListingMap(map);
      }
    }

    // Fetch buyer + seller names
    const buyerIds = [...new Set(txList.map(t => t.buyer_id))];
    const sellerIds = [...new Set(txList.map(t => t.seller_id))];
    const allUserIds = [...new Set([...buyerIds, ...sellerIds])];
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, username").in("id", allUserIds);
      if (profiles) {
        const bMap: Record<string, string> = {};
        const sMap: Record<string, string> = {};
        for (const p of profiles) {
          const name = p.display_name || p.username || p.id.slice(0, 8);
          bMap[p.id] = name;
          sMap[p.id] = name;
        }
        setBuyerMap(bMap);
        setSellerMap(sMap);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const settingsRes = await fetch("/api/escrow/settings", { headers: { Authorization: `Bearer ${token}` } });
    const settingsJson = await settingsRes.json();
    setSettings(settingsJson.settings || {});

    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  // Počty skupin
  const groupCounts = useMemo(() => {
    const counts = { action: 0, active: 0, done: 0, all: 0 };
    for (const t of transactions) {
      const g = getGroup(t);
      if (g === "action") counts.action++;
      else if (g === "active") counts.active++;
      else counts.done++;
    }
    counts.all = transactions.length;
    return counts;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;

    // Filtr podle skupiny
    if (txGroup !== "all") {
      list = list.filter(t => getGroup(t) === txGroup);
    }

    // Řazení
    list = [...list].sort((a, b) => {
      if (sortKey === "score") {
        const sa = a.st_score ?? -1;
        const sb = b.st_score ?? -1;
        return sortDir === "asc" ? sa - sb : sb - sa;
      }
      if (sortKey === "amount") {
        return sortDir === "asc" ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount);
      }
      return sortDir === "asc"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [transactions, txGroup, sortKey, sortDir]);

  const stats = useMemo(() => {
    const totalVolume = transactions.reduce((a, t) => a + Number(t.amount || 0), 0);
    const totalCommission = transactions.reduce((a, t) => a + Number(t.commission_amount || 0), 0);
    const openDisputes = disputes.filter(d => d.status === "open").length;
    const problematic = transactions.filter(t => (t.st_score !== null && t.st_score !== undefined && t.st_score < 40) || t.st_status === "failed").length;
    return { total: transactions.length, totalVolume, totalCommission, openDisputes, disputes: disputes.length, problematic };
  }, [transactions, disputes]);

  async function callApi(path: string, body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const res = await fetch(`/api/escrow/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Chyba");
  }

  async function handleHold(escrowId: string) {
    if (!holdReasonInput.trim()) { alert("Zadejte důvod pozastavení"); return; }
    setHoldLoading(true);
    try {
      await callApi("hold", { escrow_id: escrowId, reason: holdReasonInput.trim() });
      setHoldFormId(null);
      setHoldReasonInput("");
      await fetchAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Chyba při pozastavení";
      alert(message);
    } finally {
      setHoldLoading(false);
    }
  }

  async function saveSettings() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const res = await fetch("/api/escrow/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Chyba");
    alert("Nastavení uloženo");
    setSettings(data.settings || settings);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (loading) return <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px", color: "var(--text-muted)" }}>Načítám…</div>;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: "12px", fontSize: "13px" }}>
        <Link href="/admin" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>Admin</Link>
        <span style={{ color: "var(--text-dimmer)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--text-muted)" }}>Escrow</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>🛡️ Escrow</h1>

      {/* Rychlý přehled čísel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "20px" }}>
        <MiniStat label="Celkem" value={stats.total} />
        <MiniStat label="Objem" value={`${stats.totalVolume.toLocaleString("cs-CZ")} Kč`} />
        <MiniStat label="Provize" value={`${stats.totalCommission.toLocaleString("cs-CZ")} Kč`} />
        <MiniStat label="Otevřené spory" value={stats.openDisputes} color={stats.openDisputes > 0 ? "#ef4444" : undefined} />
        <MiniStat label="Problémové" value={stats.problematic} color={stats.problematic > 0 ? "#ef4444" : undefined} />
      </div>

      {/* Hlavní záložky */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        {([
          ["overview", "📋 Transakce"],
          ["disputes", `🔥 Spory${stats.openDisputes > 0 ? ` (${stats.openDisputes})` : ""}`],
          ["settings", "⚙️ Nastavení"],
        ] as [MainTab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setMainTab(k)} style={{
            padding: "10px 16px", borderRadius: "8px 8px 0 0", border: "none",
            borderBottom: mainTab === k ? "3px solid var(--accent)" : "3px solid transparent",
            background: mainTab === k ? "var(--bg-card)" : "transparent",
            color: mainTab === k ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer", fontWeight: 700, fontSize: "14px",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ===== TRANSAKCE ===== */}
      {mainTab === "overview" && (
        <>
          {/* Skupiny: K řešení / V procesu / Ukončeno / Vše */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
            {([
              ["action", "🔔 K řešení", groupCounts.action, "#ef4444"],
              ["active", "🔄 V procesu", groupCounts.active, "#3b82f6"],
              ["done", "✅ Ukončeno", groupCounts.done, "#6b7280"],
              ["all", "📊 Vše", groupCounts.all, "var(--text-muted)"],
            ] as [TxGroup, string, number, string][]).map(([k, label, count, color]) => (
              <button
                key={k}
                onClick={() => setTxGroup(k)}
                style={{
                  padding: "8px 14px", borderRadius: "20px",
                  border: txGroup === k ? `2px solid ${color}` : "1px solid var(--border)",
                  background: txGroup === k ? `${typeof color === "string" && color.startsWith("#") ? color + "18" : "var(--bg-card)"}` : "var(--bg-card)",
                  color: txGroup === k ? color : "var(--text-muted)",
                  cursor: "pointer", fontWeight: 700, fontSize: "13px",
                  display: "flex", alignItems: "center", gap: "6px",
                }}
              >
                {label}
                <span style={{
                  background: count > 0 && k === "action" ? "#ef4444" : "var(--border)",
                  color: count > 0 && k === "action" ? "#fff" : "var(--text-muted)",
                  borderRadius: "10px", padding: "1px 7px", fontSize: "11px", fontWeight: 700,
                }}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Řazení */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ color: "var(--text-dimmer)", fontSize: "12px" }}>Řadit:</span>
            {([["date", "Datum"], ["score", "Skóre"], ["amount", "Částka"]] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                style={{
                  padding: "5px 10px", borderRadius: "6px",
                  border: `1px solid ${sortKey === key ? "var(--accent)" : "var(--border)"}`,
                  background: sortKey === key ? "var(--accent)" : "transparent",
                  color: sortKey === key ? "var(--accent-text-on)" : "var(--text-muted)",
                  cursor: "pointer", fontWeight: 600, fontSize: "12px",
                }}
              >
                {label} {sortKey === key && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            ))}
          </div>

          {/* Seznam transakcí */}
          {filteredTransactions.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-dimmer)", fontSize: "14px" }}>
              {txGroup === "action" ? "🎉 Žádné transakce k řešení" : "Žádné transakce v této kategorii"}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {filteredTransactions.map(t => {
                const listing = listingMap[t.listing_id];
                const sl = statusLabel(t.status);
                const canHold = ["paid", "shipped", "delivered", "auto_completed"].includes(t.status);
                const canPayout = ["completed", "auto_completed"].includes(t.status);
                return (
                  <div
                    key={t.id}
                    style={{
                      border: `1px solid ${t.status === "hold" || t.status === "disputed" ? "#ef444455" : "var(--border)"}`,
                      borderRadius: "10px", padding: "14px",
                      background: t.status === "hold" || t.status === "disputed" ? "#ef444408" : "var(--bg-card)",
                    }}
                  >
                    {/* Hlavička: ref + název + datum */}
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                      <div>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "14px" }}>
                          {t.payment_reference}
                        </span>
                        {listing && (
                          <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: "8px", fontSize: "13px" }}>
                            — {listing.title}
                          </span>
                        )}
                      </div>
                      <span style={{ color: "var(--text-dimmer)", fontSize: "12px" }}>
                        {new Date(t.created_at).toLocaleDateString("cs-CZ")}
                      </span>
                    </div>

                    {/* Info řádek: stav, částka, kupující/prodávající, ST skóre */}
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", fontSize: "13px", marginBottom: "6px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "12px", fontWeight: 700, fontSize: "12px",
                        background: sl.color + "20", color: sl.color, border: `1px solid ${sl.color}40`,
                      }}>
                        {sl.text}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                        {Number(t.amount).toLocaleString("cs-CZ")} Kč
                      </span>
                      {t.status === "partial_paid" && t.partial_amount != null && (
                        <span style={{ color: "#f97316", fontSize: "12px" }}>
                          (přijato {Number(t.partial_amount).toLocaleString("cs-CZ")} Kč)
                        </span>
                      )}
                      <span style={{ color: "var(--text-dimmer)", fontSize: "12px" }}>
                        👤 {buyerMap[t.buyer_id] || t.buyer_id.slice(0, 8)} → {sellerMap[t.seller_id] || t.seller_id.slice(0, 8)}
                      </span>
                      {/* ShieldTrack */}
                      {t.tracking_number && (
                        <span style={{ fontSize: "12px" }}>
                          {scoreIndicator(t.st_score)}{" "}
                          {t.st_score !== null && t.st_score !== undefined ? (
                            <span style={{ color: t.st_score < 40 ? "#ef4444" : t.st_score < 80 ? "#f59e0b" : "#22c55e", fontWeight: 600 }}>
                              ST: {t.st_score}/100
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-dimmer)" }}>ST: čeká</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Hold důvod */}
                    {t.status === "hold" && t.hold_reason && (
                      <div style={{ marginBottom: "6px", fontSize: "12px", color: "#ef4444", background: "#ef444410", padding: "6px 10px", borderRadius: "6px" }}>
                        ⚠️ {t.hold_reason}
                      </div>
                    )}

                    {/* Tracking číslo */}
                    {t.tracking_number && (
                      <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "6px" }}>
                        📦 {t.tracking_number} {t.carrier && `(${t.carrier})`}
                      </div>
                    )}

                    {/* Akce */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      {t.status === "created" && (
                        <>
                          <button onClick={async () => { if (!window.confirm(`Potvrdit úhradu ${Number(t.amount).toLocaleString("cs-CZ")} Kč (${t.payment_reference})?`)) return; await callApi("confirm-payment", { escrow_id: t.id }); await fetchAll(); }} style={btnAction("#22c55e")}>💰 Potvrdit platbu</button>
                          <button onClick={() => { setPartialFormId(partialFormId === t.id ? null : t.id); setPartialAmountInput(""); }} style={btnAction("#f97316")}>⚠️ Neúplná platba</button>
                        </>
                      )}
                      {t.status === "partial_paid" && (
                        <button onClick={async () => { if (!window.confirm(`Potvrdit doplacení? ${t.payment_reference} přejde do stavu "zaplaceno".`)) return; await callApi("confirm-payment", { escrow_id: t.id }); await fetchAll(); }} style={btnAction("#22c55e")}>💰 Potvrdit doplatek</button>
                      )}
                      {canPayout && (
                        <button onClick={async () => { if (!window.confirm(`Odeslat výplatu ${Number(t.seller_payout).toLocaleString("cs-CZ")} Kč prodávajícímu?`)) return; await callApi("send-payout", { escrow_id: t.id }); await fetchAll(); }} style={btnAction("#8b5cf6")}>💸 Odeslat výplatu</button>
                      )}
                      {t.status === "payout_sent" && (
                        <button onClick={async () => { if (!window.confirm(`Potvrdit odeslání výplaty pro ${t.payment_reference}?`)) return; await callApi("confirm-payout", { escrow_id: t.id }); await fetchAll(); }} style={btnAction("#22c55e")}>✅ Potvrdit výplatu</button>
                      )}
                      {canHold && (
                        <button onClick={() => { setHoldFormId(holdFormId === t.id ? null : t.id); setHoldReasonInput(""); }} style={btnAction("#ef4444")}>⏸️ Pozastavit</button>
                      )}
                      <Link href={`/bazar/transakce/${t.id}`} style={{ ...btnAction("var(--accent)"), textDecoration: "none", display: "inline-block" }}>🔍 Detail</Link>
                    </div>

                    {/* Hold formulář */}
                    {holdFormId === t.id && (
                      <div style={{ marginTop: "10px", padding: "12px", borderRadius: "8px", border: "1px solid #ef444455", background: "#ef444410" }}>
                        <div style={{ fontSize: "13px", color: "#ef4444", fontWeight: 600, marginBottom: "8px" }}>⚠️ Pozastavit výplatu</div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="text"
                            value={holdReasonInput}
                            onChange={(e) => setHoldReasonInput(e.target.value)}
                            placeholder="Důvod pozastavení..."
                            style={{ flex: 1, minWidth: "200px", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "13px" }}
                          />
                          <button onClick={() => handleHold(t.id)} disabled={holdLoading} style={btnAction("#ef4444")}>
                            {holdLoading ? "Ukládám…" : "Pozastavit"}
                          </button>
                          <button onClick={() => { setHoldFormId(null); setHoldReasonInput(""); }} style={btnAction("#6b7280")}>Zrušit</button>
                        </div>
                      </div>
                    )}

                    {/* Neúplná platba formulář */}
                    {partialFormId === t.id && (
                      <div style={{ marginTop: "10px", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Přijatá částka (z {Number(t.amount).toLocaleString("cs-CZ")} Kč):</span>
                          <input
                            type="number"
                            value={partialAmountInput}
                            onChange={(e) => setPartialAmountInput(e.target.value)}
                            placeholder="Kč"
                            min="1"
                            style={{ width: "120px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "13px" }}
                          />
                          <button
                            onClick={async () => {
                              const amt = Number(partialAmountInput);
                              if (!amt || amt <= 0 || amt >= Number(t.amount)) { alert("Zadejte platnou částku menší než celková cena"); return; }
                              if (!window.confirm(`Oznámit neúplnou platbu ${amt.toLocaleString("cs-CZ")} Kč z ${Number(t.amount).toLocaleString("cs-CZ")} Kč?`)) return;
                              await callApi("partial-payment", { escrow_id: t.id, partial_amount: amt });
                              setPartialFormId(null);
                              setPartialAmountInput("");
                              await fetchAll();
                            }}
                            style={btnAction("#f97316")}
                          >
                            Potvrdit
                          </button>
                          <button onClick={() => { setPartialFormId(null); setPartialAmountInput(""); }} style={btnAction("#6b7280")}>Zrušit</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== SPORY ===== */}
      {mainTab === "disputes" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
          {disputes.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-dimmer)" }}>Žádné spory 🎉</div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {disputes.map(d => {
                const tx = transactions.find(t => t.id === d.escrow_id);
                return (
                  <div key={d.id} style={{
                    border: `1px solid ${d.status === "open" ? "#ef444455" : "var(--border)"}`,
                    borderRadius: "10px", padding: "12px",
                    background: d.status === "open" ? "#ef444408" : undefined,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "14px" }}>
                        Spor #{d.id.slice(0, 8)}
                        {tx && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "8px" }}>({tx.payment_reference})</span>}
                      </span>
                      <span style={{
                        padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700,
                        background: d.status === "open" ? "#ef444420" : "#6b728020",
                        color: d.status === "open" ? "#ef4444" : "#6b7280",
                      }}>
                        {d.status === "open" ? "Otevřený" : "Uzavřený"}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "8px" }}>{d.reason}</div>
                    {d.evidence_images?.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                        {d.evidence_images.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontSize: "12px" }}>📎 důkaz {i + 1}</a>)}
                      </div>
                    )}
                    {d.status === "open" && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={async () => { if (!window.confirm("Rozhodnout ve prospěch kupujícího?")) return; await callApi("resolve", { dispute_id: d.id, resolution_status: "resolved_buyer", resolution_text: "Rozhodnuto ve prospěch kupujícího." }); await fetchAll(); }} style={btnAction("#f97316")}>👤 Kupující</button>
                        <button onClick={async () => { if (!window.confirm("Rozhodnout ve prospěch prodávajícího?")) return; await callApi("resolve", { dispute_id: d.id, resolution_status: "resolved_seller", resolution_text: "Rozhodnuto ve prospěch prodávajícího." }); await fetchAll(); }} style={btnAction("#22c55e")}>🏪 Prodávající</button>
                        <button onClick={async () => { if (!window.confirm("Kompromisní rozdělení?")) return; await callApi("resolve", { dispute_id: d.id, resolution_status: "resolved_split", resolution_text: "Kompromisní rozdělení částky." }); await fetchAll(); }} style={btnAction("#3b82f6")}>🤝 Kompromis</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== NASTAVENÍ ===== */}
      {mainTab === "settings" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "14px" }}>Nastavení escrow</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px" }}>
            {[
              ["commission_rate", "Provize %"],
              ["min_commission", "Min. provize (Kč)"],
              ["payment_deadline_hours", "Lhůta platby (h)"],
              ["shipping_deadline_days", "Lhůta odeslání (dny)"],
              ["confirmation_deadline_days", "Lhůta potvrzení (dny)"],
              ["auto_complete_days", "Auto-complete (dny)"],
              ["bank_account", "Bankovní účet"],
              ["bank_iban", "IBAN"],
              ["escrow_enabled", "Escrow zapnuto (true/false)"],
              ["admin_email", "Admin email (ShieldTrack alerty)"],
            ].map(([key, label]) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "5px" }}>{label}</label>
                <input value={settings[key] || ""} onChange={(e) => setSettings(s => ({ ...s, [key]: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }} />
              </div>
            ))}
          </div>
          <button onClick={saveSettings} style={{ marginTop: "14px", padding: "10px 20px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "var(--accent-text-on)", cursor: "pointer", fontWeight: 700, fontSize: "14px" }}>💾 Uložit nastavení</button>
        </div>
      )}
    </div>
  );
}

function btnAction(color: string): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: "6px",
    border: `1px solid ${color}50`,
    background: `${typeof color === "string" && color.startsWith("#") ? color + "15" : "transparent"}`,
    color, cursor: "pointer", fontWeight: 600, fontSize: "12px",
  };
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: `1px solid ${color ? color + "40" : "var(--border)"}`,
      borderRadius: "10px", padding: "10px 14px",
    }}>
      <div style={{ color: "var(--text-dimmer)", fontSize: "11px", marginBottom: "2px" }}>{label}</div>
      <div style={{ color: color || "var(--text-primary)", fontWeight: 700, fontSize: "16px" }}>{value}</div>
    </div>
  );
}
