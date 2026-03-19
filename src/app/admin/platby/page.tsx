"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────

type MainTab = "received" | "payouts";

type BankPayment = {
  id: string;
  bank_tx_id: string;
  escrow_id: string | null;
  payment_reference: string | null;
  variable_symbol: string | null;
  amount: number | string;
  currency: string | null;
  paid_at: string | null;
  matched: boolean;
  processing_status: string;
  error_message: string | null;
  created_at: string;
};

type EscrowRow = {
  id: string;
  amount: number;
  partial_amount: number | null;
  status: string;
  payment_reference: string;
  commission_rate: number;
  commission_amount: number;
  seller_payout: number;
  seller_id: string;
  buyer_id: string;
  listing_id: string;
  admin_note: string | null;
  completed_at: string | null;
  created_at: string;
};

type PayoutFilter = "pending" | "sent" | "confirmed" | "all";
type ReceivedFilter = "matched" | "unresolved" | "all";

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(v: number | string): string {
  return `${Number(v).toLocaleString("cs-CZ")} Kč`;
}

function processingLabel(s: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    new: { text: "Nová", color: "#f59e0b" },
    paid: { text: "Přiřazena", color: "#22c55e" },
    partial: { text: "Částečná", color: "#f97316" },
    overpaid: { text: "Přeplatek", color: "#ef4444" },
    ignored: { text: "Ignorovaná", color: "#6b7280" },
    unidentified: { text: "Neidentifikovaná", color: "#ef4444" },
    duplicate: { text: "Duplicitní", color: "#8b5cf6" },
    other: { text: "Jiné", color: "#6b7280" },
  };
  return map[s] || { text: s, color: "var(--text-muted)" };
}

function payoutStatusLabel(s: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    completed: { text: "Čeká na výplatu", color: "#f59e0b" },
    auto_completed: { text: "Čeká na výplatu (auto)", color: "#f59e0b" },
    payout_sent: { text: "Výplata odeslána", color: "#3b82f6" },
    payout_confirmed: { text: "Výplata potvrzena", color: "#22c55e" },
  };
  return map[s] || { text: s, color: "var(--text-muted)" };
}

function getMonthOptions(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
    months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

// ── Styles ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "16px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-dim)",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  verticalAlign: "top",
};

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 600,
    border: `1px solid ${color}`,
    borderRadius: "6px",
    background: "transparent",
    color,
    cursor: "pointer",
    marginRight: "4px",
    marginBottom: "4px",
  };
}

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 20px",
  fontSize: "14px",
  fontWeight: active ? 700 : 500,
  border: "none",
  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
  background: "transparent",
  color: active ? "var(--accent)" : "var(--text-dim)",
  cursor: "pointer",
});

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 12px",
  fontSize: "12px",
  fontWeight: active ? 700 : 500,
  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
  borderRadius: "6px",
  background: active ? "rgba(0,212,170,0.1)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-dim)",
  cursor: "pointer",
  marginRight: "4px",
});

const miniStatStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "12px 16px",
  textAlign: "center",
};

// ── Component ──────────────────────────────────────────────────────

export default function AdminPlatbyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("received");

  // Data
  const [bankPayments, setBankPayments] = useState<BankPayment[]>([]);
  const [escrowTransactions, setEscrowTransactions] = useState<EscrowRow[]>([]);
  const [listingMap, setListingMap] = useState<Record<string, string>>({});
  const [sellerMap, setSellerMap] = useState<Record<string, string>>({});

  // Filters - received
  const [receivedFilter, setReceivedFilter] = useState<ReceivedFilter>("all");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [dayFilter, setDayFilter] = useState<string>("");

  // Filters - payouts
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>("pending");

  // Modals/actions
  const [assignModalId, setAssignModalId] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [markDropdownId, setMarkDropdownId] = useState<string | null>(null);
  const [otherNoteInput, setOtherNoteInput] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Auth & fetch ───────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/prihlaseni"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      await fetchAll();
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetchAll() {
    const [bpRes, txRes] = await Promise.all([
      supabase.from("escrow_bank_payments")
        .select("id, bank_tx_id, escrow_id, payment_reference, variable_symbol, amount, currency, paid_at, matched, processing_status, error_message, created_at")
        .order("paid_at", { ascending: false }),
      supabase.from("escrow_transactions")
        .select("id, amount, partial_amount, status, payment_reference, commission_rate, commission_amount, seller_payout, seller_id, buyer_id, listing_id, admin_note, completed_at, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const payments = (bpRes.data || []) as BankPayment[];
    const transactions = (txRes.data || []) as EscrowRow[];

    setBankPayments(payments);
    setEscrowTransactions(transactions);

    // Fetch listing titles
    const listingIds = [...new Set(transactions.map(t => t.listing_id).filter(Boolean))];
    if (listingIds.length > 0) {
      const { data: listings } = await supabase
        .from("listings")
        .select("id, title")
        .in("id", listingIds);
      const map: Record<string, string> = {};
      listings?.forEach(l => { map[l.id] = l.title; });
      setListingMap(map);
    }

    // Fetch seller usernames
    const sellerIds = [...new Set(transactions.map(t => t.seller_id).filter(Boolean))];
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", sellerIds);
      const map: Record<string, string> = {};
      sellers?.forEach(s => { map[s.id] = s.username || s.id; });
      setSellerMap(map);
    }
  }

  // ── API calls ──────────────────────────────────────────────────

  async function getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function assignPayment(bankPaymentId: string, escrowId: string) {
    setActionLoading(bankPaymentId);
    try {
      const token = await getToken();
      const res = await fetch("/api/escrow/bank-payment-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "assign", bank_payment_id: bankPaymentId, escrow_id: escrowId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Chyba: ${data.error || "Neznámá chyba"}`);
        return;
      }
      setAssignModalId(null);
      setAssignSearch("");
      await fetchAll();
    } finally {
      setActionLoading(null);
    }
  }

  async function markPayment(bankPaymentId: string, status: string, note?: string) {
    setActionLoading(bankPaymentId);
    try {
      const token = await getToken();
      const res = await fetch("/api/escrow/bank-payment-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "mark",
          bank_payment_id: bankPaymentId,
          processing_status: status,
          error_message: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Chyba: ${data.error || "Neznámá chyba"}`);
        return;
      }
      setMarkDropdownId(null);
      setOtherNoteInput("");
      await fetchAll();
    } finally {
      setActionLoading(null);
    }
  }

  async function changeEscrowStatus(escrowId: string, apiPath: string) {
    setActionLoading(escrowId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/escrow/${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ escrow_id: escrowId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Chyba: ${data.error || "Neznámá chyba"}`);
        return;
      }
      await fetchAll();
    } finally {
      setActionLoading(null);
    }
  }

  // ── Filtered data ──────────────────────────────────────────────

  const escrowMap = useMemo(() => {
    const map: Record<string, EscrowRow> = {};
    escrowTransactions.forEach(t => { map[t.id] = t; });
    return map;
  }, [escrowTransactions]);

  const filteredBankPayments = useMemo(() => {
    let result = [...bankPayments];

    // Status filter
    if (receivedFilter === "matched") {
      result = result.filter(p => p.matched);
    } else if (receivedFilter === "unresolved") {
      result = result.filter(p => !p.matched || ["ignored", "new"].includes(p.processing_status));
    }

    // Month filter
    if (monthFilter) {
      result = result.filter(p => {
        if (!p.paid_at) return false;
        const d = new Date(p.paid_at);
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return m === monthFilter;
      });
    }

    // Day filter
    if (dayFilter) {
      result = result.filter(p => {
        if (!p.paid_at) return false;
        return p.paid_at.startsWith(dayFilter);
      });
    }

    return result;
  }, [bankPayments, receivedFilter, monthFilter, dayFilter]);

  const receivedStats = useMemo(() => {
    const total = filteredBankPayments.length;
    const totalSum = filteredBankPayments.reduce((s, p) => s + Number(p.amount), 0);
    const matched = filteredBankPayments.filter(p => p.matched);
    const matchedSum = matched.reduce((s, p) => s + Number(p.amount), 0);
    const unresolved = filteredBankPayments.filter(p => !p.matched || ["ignored", "new"].includes(p.processing_status));
    const unresolvedSum = unresolved.reduce((s, p) => s + Number(p.amount), 0);
    return { total, totalSum, matchedCount: matched.length, matchedSum, unresolvedCount: unresolved.length, unresolvedSum };
  }, [filteredBankPayments]);

  const payoutStatuses = useMemo(() => {
    const map: Record<PayoutFilter, string[]> = {
      pending: ["completed", "auto_completed"],
      sent: ["payout_sent"],
      confirmed: ["payout_confirmed"],
      all: ["completed", "auto_completed", "payout_sent", "payout_confirmed"],
    };
    return map;
  }, []);

  const filteredPayouts = useMemo(() => {
    const statuses = payoutStatuses[payoutFilter];
    return escrowTransactions.filter(t => statuses.includes(t.status));
  }, [escrowTransactions, payoutFilter, payoutStatuses]);

  const payoutStats = useMemo(() => {
    const pending = escrowTransactions.filter(t => ["completed", "auto_completed"].includes(t.status));
    return {
      count: pending.length,
      totalPayout: pending.reduce((s, t) => s + t.seller_payout, 0),
      totalCommission: pending.reduce((s, t) => s + t.commission_amount, 0),
    };
  }, [escrowTransactions]);

  // Assign modal: search escrow transactions
  const assignResults = useMemo(() => {
    if (!assignSearch.trim()) return escrowTransactions.slice(0, 10);
    const q = assignSearch.toLowerCase();
    return escrowTransactions.filter(t => {
      const ref = t.payment_reference?.toLowerCase() || "";
      const title = listingMap[t.listing_id]?.toLowerCase() || "";
      return ref.includes(q) || title.includes(q);
    }).slice(0, 10);
  }, [assignSearch, escrowTransactions, listingMap]);

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px", color: "var(--text-dim)" }}>
        Načítám…
      </div>
    );
  }

  const isUnresolved = (p: BankPayment) =>
    !p.matched || ["new", "ignored"].includes(p.processing_status);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "12px", fontSize: "13px" }}>
        <Link href="/admin" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Admin</Link>
        <span style={{ color: "var(--text-dim)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--text-primary)" }}>Platby</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "20px" }}>
        💳 Správa plateb
      </h1>

      {/* Main tabs */}
      <div style={{ borderBottom: "1px solid var(--border)", marginBottom: "20px", display: "flex", gap: "4px" }}>
        <button style={tabBtnStyle(mainTab === "received")} onClick={() => setMainTab("received")}>
          Přijaté platby
        </button>
        <button style={tabBtnStyle(mainTab === "payouts")} onClick={() => setMainTab("payouts")}>
          Platby k odeslání
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 1: Přijaté platby                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mainTab === "received" && (
        <>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            <div style={miniStatStyle}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>Celkem přijato</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{receivedStats.total}</div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{fmtMoney(receivedStats.totalSum)}</div>
            </div>
            <div style={miniStatStyle}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>Přiřazeno</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#22c55e" }}>{receivedStats.matchedCount}</div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{fmtMoney(receivedStats.matchedSum)}</div>
            </div>
            <div style={miniStatStyle}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>K řešení</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: receivedStats.unresolvedCount > 0 ? "#ef4444" : "var(--text-primary)" }}>{receivedStats.unresolvedCount}</div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{fmtMoney(receivedStats.unresolvedSum)}</div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim)", marginRight: "6px" }}>Stav:</span>
              {(["all", "matched", "unresolved"] as ReceivedFilter[]).map(f => (
                <button key={f} style={filterBtnStyle(receivedFilter === f)} onClick={() => setReceivedFilter(f)}>
                  {{ all: "Všechny", matched: "Přiřazené", unresolved: "K řešení" }[f]}
                </button>
              ))}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim)", marginRight: "6px" }}>Měsíc:</span>
              <select
                value={monthFilter}
                onChange={e => { setMonthFilter(e.target.value); setDayFilter(""); }}
                style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
              >
                <option value="">Všechny</option>
                {getMonthOptions().map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim)", marginRight: "6px" }}>Den:</span>
              <input
                type="date"
                value={dayFilter}
                onChange={e => { setDayFilter(e.target.value); setMonthFilter(""); }}
                style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
              />
              {dayFilter && (
                <button
                  onClick={() => setDayFilter("")}
                  style={{ ...btnStyle("var(--text-dim)"), marginLeft: "4px" }}
                >✕</button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Částka</th>
                  <th style={thStyle}>VS</th>
                  <th style={thStyle}>Stav</th>
                  <th style={thStyle}>Escrow transakce</th>
                  <th style={thStyle}>Poznámka</th>
                  <th style={thStyle}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredBankPayments.length === 0 && (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--text-dim)" }}>Žádné platby</td></tr>
                )}
                {filteredBankPayments.map(p => {
                  const pLabel = processingLabel(p.processing_status);
                  const escrow = p.escrow_id ? escrowMap[p.escrow_id] : null;
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}>{fmtDate(p.paid_at)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtMoney(p.amount)}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{p.variable_symbol || "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ color: pLabel.color, fontWeight: 600, fontSize: "12px" }}>{pLabel.text}</span>
                      </td>
                      <td style={tdStyle}>
                        {escrow ? (
                          <Link href="/admin/escrow" style={{ color: "var(--accent)", fontSize: "12px", textDecoration: "none" }}>
                            {escrow.payment_reference}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "12px", color: "var(--text-dim)", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.error_message || "—"}
                      </td>
                      <td style={tdStyle}>
                        {isUnresolved(p) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                            <button
                              style={btnStyle("var(--accent)")}
                              onClick={() => { setAssignModalId(p.id); setAssignSearch(""); }}
                              disabled={actionLoading === p.id}
                            >
                              Přiřadit k inzerátu
                            </button>
                            <button
                              style={btnStyle("#8b5cf6")}
                              onClick={() => setMarkDropdownId(markDropdownId === p.id ? null : p.id)}
                              disabled={actionLoading === p.id}
                            >
                              Označit jako…
                            </button>

                            {/* Mark dropdown */}
                            {markDropdownId === p.id && (
                              <div style={{
                                position: "absolute",
                                zIndex: 50,
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                                borderRadius: "8px",
                                padding: "8px",
                                marginTop: "28px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                                minWidth: "200px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                              }}>
                                <button style={btnStyle("#ef4444")} onClick={() => markPayment(p.id, "unidentified")}>
                                  Neidentifikovaná platba
                                </button>
                                <button style={btnStyle("#8b5cf6")} onClick={() => markPayment(p.id, "duplicate")}>
                                  Duplicitní platba
                                </button>
                                <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
                                  <input
                                    type="text"
                                    placeholder="Popis…"
                                    value={otherNoteInput}
                                    onChange={e => setOtherNoteInput(e.target.value)}
                                    style={{
                                      flex: 1,
                                      minWidth: "100px",
                                      padding: "4px 8px",
                                      fontSize: "12px",
                                      borderRadius: "6px",
                                      border: "1px solid var(--border)",
                                      background: "var(--bg-card)",
                                      color: "var(--text-primary)",
                                    }}
                                  />
                                  <button style={btnStyle("#6b7280")} onClick={() => markPayment(p.id, "other", otherNoteInput)}>
                                    Jiné
                                  </button>
                                </div>
                                <button
                                  style={{ ...btnStyle("var(--text-dim)"), marginTop: "4px" }}
                                  onClick={() => setMarkDropdownId(null)}
                                >
                                  Zavřít
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 2: Platby k odeslání                                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mainTab === "payouts" && (
        <>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            <div style={miniStatStyle}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>Čeká na výplatu</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{payoutStats.count}</div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{fmtMoney(payoutStats.totalPayout)}</div>
            </div>
            <div style={miniStatStyle}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>Celkem provize</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)" }}>{fmtMoney(payoutStats.totalCommission)}</div>
            </div>
            <div style={miniStatStyle}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>Transakcí k vyplacení</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{payoutStats.count}</div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ ...cardStyle, display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Filtr:</span>
            {(["pending", "sent", "confirmed", "all"] as PayoutFilter[]).map(f => (
              <button key={f} style={filterBtnStyle(payoutFilter === f)} onClick={() => setPayoutFilter(f)}>
                {{ pending: "Čeká na výplatu", sent: "Odesláno", confirmed: "Potvrzeno", all: "Všechny" }[f]}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Inzerát</th>
                  <th style={thStyle}>Prodávající</th>
                  <th style={thStyle}>Celkem</th>
                  <th style={thStyle}>Provize</th>
                  <th style={thStyle}>K odeslání</th>
                  <th style={thStyle}>Stav</th>
                  <th style={thStyle}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.length === 0 && (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "var(--text-dim)" }}>Žádné transakce</td></tr>
                )}
                {filteredPayouts.map(t => {
                  const sLabel = payoutStatusLabel(t.status);
                  return (
                    <tr key={t.id}>
                      <td style={tdStyle}>{fmtDate(t.completed_at || t.created_at)}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px", color: "var(--accent)" }}>
                        {t.payment_reference || "—"}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {listingMap[t.listing_id] || t.listing_id}
                      </td>
                      <td style={tdStyle}>{sellerMap[t.seller_id] || t.seller_id.slice(0, 8)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtMoney(t.amount)}</td>
                      <td style={{ ...tdStyle, color: "var(--accent)" }}>{fmtMoney(t.commission_amount)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtMoney(t.seller_payout)}</td>
                      <td style={tdStyle}>
                        <span style={{ color: sLabel.color, fontWeight: 600, fontSize: "12px" }}>{sLabel.text}</span>
                      </td>
                      <td style={tdStyle}>
                        {["completed", "auto_completed"].includes(t.status) && (
                          <button
                            style={btnStyle("#3b82f6")}
                            onClick={() => {
                              if (!window.confirm(`Odeslat výplatu ${fmtMoney(t.seller_payout)} prodávajícímu?`)) return;
                              changeEscrowStatus(t.id, "send-payout");
                            }}
                            disabled={actionLoading === t.id}
                          >
                            💸 Výplata odeslána
                          </button>
                        )}
                        {t.status === "payout_sent" && (
                          <button
                            style={btnStyle("#22c55e")}
                            onClick={() => {
                              if (!window.confirm(`Potvrdit výplatu pro ${t.payment_reference}?`)) return;
                              changeEscrowStatus(t.id, "confirm-payout");
                            }}
                            disabled={actionLoading === t.id}
                          >
                            ✅ Výplata potvrzena
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Assign Modal                                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {assignModalId && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }} onClick={() => setAssignModalId(null)}>
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            maxWidth: "500px",
            width: "100%",
            maxHeight: "80vh",
            overflowY: "auto",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              Přiřadit platbu k escrow transakci
            </h3>
            <input
              type="text"
              placeholder="Hledat podle reference nebo názvu inzerátu…"
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                marginBottom: "12px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {assignResults.length === 0 && (
                <div style={{ color: "var(--text-dim)", fontSize: "13px", textAlign: "center", padding: "12px" }}>
                  Žádné výsledky
                </div>
              )}
              {assignResults.map(t => (
                <button
                  key={t.id}
                  onClick={() => assignPayment(assignModalId, t.id)}
                  disabled={actionLoading === assignModalId}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t.payment_reference}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    {listingMap[t.listing_id] || "?"} · {fmtMoney(t.amount)} · {t.status}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setAssignModalId(null)}
              style={{ ...btnStyle("var(--text-dim)"), marginTop: "12px", width: "100%", textAlign: "center" }}
            >
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
