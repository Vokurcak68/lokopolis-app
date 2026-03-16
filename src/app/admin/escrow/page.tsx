"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { EscrowDispute, EscrowTransaction, Listing } from "@/types/database";

type Tab = "transactions" | "disputes" | "settings" | "stats";

export default function AdminEscrowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("transactions");
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [listingMap, setListingMap] = useState<Record<string, Listing>>({});
  const [disputes, setDisputes] = useState<EscrowDispute[]>([]);
  const [partialFormId, setPartialFormId] = useState<string | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("");

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

    // Fetch listing titles for all transactions
    const listingIds = [...new Set(txList.map(t => t.listing_id))];
    if (listingIds.length > 0) {
      const { data: listings } = await supabase
        .from("listings")
        .select("id, title")
        .in("id", listingIds);
      if (listings) {
        const map: Record<string, Listing> = {};
        for (const l of listings) map[l.id] = l as Listing;
        setListingMap(map);
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

  const stats = useMemo(() => {
    const totalVolume = transactions.reduce((a, t) => a + Number(t.amount || 0), 0);
    const totalCommission = transactions.reduce((a, t) => a + Number(t.commission_amount || 0), 0);
    const openDisputes = disputes.filter(d => d.status === "open").length;
    return { total: transactions.length, totalVolume, totalCommission, openDisputes, disputes: disputes.length };
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

  if (loading) return <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px", color: "var(--text-muted)" }}>Načítám…</div>;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: "12px", fontSize: "13px" }}>
        <Link href="/admin" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>Admin</Link>
        <span style={{ color: "var(--text-dimmer)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--text-muted)" }}>Escrow</span>
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "20px" }}>🛡️ Escrow</h1>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
        {([
          ["transactions", "Transakce"],
          ["disputes", "Spory"],
          ["settings", "Nastavení"],
          ["stats", "Statistiky"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${tab === k ? "var(--accent)" : "var(--border)"}`, background: tab === k ? "var(--accent)" : "var(--bg-card)", color: tab === k ? "var(--accent-text-on)" : "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
          <div style={{ marginBottom: "12px" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}>
              <option value="">Všechny stavy</option>
              {["created", "partial_paid", "paid", "shipped", "delivered", "completed", "auto_completed", "payout_sent", "payout_confirmed", "disputed", "refunded", "cancelled"].filter(s => transactions.some(t => t.status === s)).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {transactions.filter(t => !statusFilter || t.status === statusFilter).map(t => {
              const listing = listingMap[t.listing_id];
              return (
                <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "14px" }}>
                        {t.payment_reference}
                        {listing && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "8px" }}>— {listing.title}</span>}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {t.status} · {Number(t.amount).toLocaleString("cs-CZ")} Kč
                        {t.status === "partial_paid" && t.partial_amount != null && (
                          <span style={{ color: "#f97316", marginLeft: "8px" }}>
                            (přijato {Number(t.partial_amount).toLocaleString("cs-CZ")} Kč, chybí {(Number(t.amount) - Number(t.partial_amount)).toLocaleString("cs-CZ")} Kč)
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      {t.status === "created" && (
                        <>
                          <button onClick={async () => { if (!window.confirm(`Opravdu potvrdit úhradu ${Number(t.amount).toLocaleString("cs-CZ")} Kč pro ${t.payment_reference}?`)) return; await callApi("confirm-payment", { escrow_id: t.id }); await fetchAll(); }} style={btnSmall("#22c55e")}>💰 Potvrdit platbu</button>
                          <button onClick={() => { setPartialFormId(partialFormId === t.id ? null : t.id); setPartialAmountInput(""); }} style={btnSmall("#f97316")}>⚠️ Neúplná platba</button>
                        </>
                      )}
                      {t.status === "partial_paid" && (
                        <button onClick={async () => { if (!window.confirm(`Potvrdit doplacení? Transakce ${t.payment_reference} přejde do stavu "zaplaceno".`)) return; await callApi("confirm-payment", { escrow_id: t.id }); await fetchAll(); }} style={btnSmall("#22c55e")}>💰 Potvrdit doplatek</button>
                      )}
                      {(t.status === "completed" || t.status === "auto_completed") && (
                        <button onClick={async () => { if (!window.confirm(`Odeslat výplatu ${Number(t.seller_payout).toLocaleString("cs-CZ")} Kč prodávajícímu?`)) return; await callApi("send-payout", { escrow_id: t.id }); await fetchAll(); }} style={btnSmall("#8b5cf6")}>💸 Odeslat výplatu</button>
                      )}
                      <Link href={`/bazar/transakce/${t.id}`} style={{ ...btnLinkSmall(), textDecoration: "none" }}>Detail</Link>
                    </div>
                  </div>
                  {partialFormId === t.id && (
                    <div style={{ marginTop: "10px", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-soft, var(--bg-card))" }}>
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
                            await callApi("partial-payment", { escrow_id: t.id, partial_amount: amt });
                            setPartialFormId(null);
                            setPartialAmountInput("");
                            await fetchAll();
                          }}
                          style={btnSmall("#f97316")}
                        >
                          Potvrdit
                        </button>
                        <button onClick={() => { setPartialFormId(null); setPartialAmountInput(""); }} style={btnSmall("#6b7280")}>Zrušit</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "disputes" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
          <div style={{ display: "grid", gap: "10px" }}>
            {disputes.map(d => (
              <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "14px", marginBottom: "6px" }}>Spor #{d.id.slice(0, 8)} · {d.status}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "8px" }}>{d.reason}</div>
                {d.evidence_images?.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {d.evidence_images.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontSize: "12px" }}>důkaz {i + 1}</a>)}
                  </div>
                )}
                {d.status === "open" && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={async () => { if (!window.confirm("Rozhodnout ve prospěch kupujícího? Peníze se vrátí kupujícímu.")) return; await callApi("resolve", { dispute_id: d.id, resolution_status: "resolved_buyer", resolution_text: "Rozhodnuto ve prospěch kupujícího." }); await fetchAll(); }} style={btnSmall("#f97316")}>Ve prospěch kupujícího</button>
                    <button onClick={async () => { if (!window.confirm("Rozhodnout ve prospěch prodávajícího? Peníze se uvolní prodejci.")) return; await callApi("resolve", { dispute_id: d.id, resolution_status: "resolved_seller", resolution_text: "Rozhodnuto ve prospěch prodávajícího." }); await fetchAll(); }} style={btnSmall("#22c55e")}>Ve prospěch prodávajícího</button>
                    <button onClick={async () => { if (!window.confirm("Kompromisní rozdělení částky?")) return; await callApi("resolve", { dispute_id: d.id, resolution_status: "resolved_split", resolution_text: "Kompromisní rozdělení částky." }); await fetchAll(); }} style={btnSmall("#3b82f6")}>Kompromis</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
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
            ].map(([key, label]) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "5px" }}>{label}</label>
                <input value={settings[key] || ""} onChange={(e) => setSettings(s => ({ ...s, [key]: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }} />
              </div>
            ))}
          </div>
          <button onClick={saveSettings} style={{ marginTop: "12px", ...btnSmall("#22c55e") }}>Uložit nastavení</button>
        </div>
      )}

      {tab === "stats" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "10px" }}>
          <StatCard label="Transakcí" value={String(stats.total)} />
          <StatCard label="Objem" value={`${stats.totalVolume.toLocaleString("cs-CZ")} Kč`} />
          <StatCard label="Provize" value={`${stats.totalCommission.toLocaleString("cs-CZ")} Kč`} />
          <StatCard label="Spory" value={`${stats.disputes} (${stats.openDisputes} otevřených)`} />
        </div>
      )}
    </div>
  );
}

function btnSmall(color: string): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: "8px", border: `1px solid ${color}55`, background: `${color}22`, color, cursor: "pointer", fontWeight: 600, fontSize: "12px" };
}
function btnLinkSmall(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-muted)", fontWeight: 600, fontSize: "12px" };
}
function StatCard({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}><div style={{ color: "var(--text-dimmer)", fontSize: "12px", marginBottom: "5px" }}>{label}</div><div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{value}</div></div>;
}
