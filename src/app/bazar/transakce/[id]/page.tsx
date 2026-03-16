"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { formatCzechDate } from "@/lib/timeAgo";
import { getImageVariant } from "@/lib/image-variants";
import EscrowTimeline from "@/components/Escrow/EscrowTimeline";
import EscrowActions from "@/components/Escrow/EscrowActions";
import EscrowReviewForm from "@/components/Escrow/EscrowReviewForm";
import type { EscrowTransaction, EscrowDispute, EscrowReview, Profile, Listing } from "@/types/database";

function czechToIBAN(account: string): string {
  const parts = account.replace(/\s/g, "").split("/");
  if (parts.length !== 2) return account;
  const [acc, bankCode] = parts;
  const [prefix, base] = acc.includes("-") ? acc.split("-") : ["", acc];
  const bban = bankCode.padStart(4, "0") + (prefix || "").padStart(6, "0") + base.padStart(10, "0");
  const numStr = bban + "123500";
  let remainder = 0;
  for (const ch of numStr) remainder = (remainder * 10 + parseInt(ch)) % 97;
  const checkDigits = String(98 - remainder).padStart(2, "0");
  return `CZ${checkDigits}${bban}`;
}

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const txId = params.id as string;

  const [transaction, setTransaction] = useState<EscrowTransaction | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [buyer, setBuyer] = useState<Profile | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [dispute, setDispute] = useState<EscrowDispute | null>(null);
  const [reviews, setReviews] = useState<(EscrowReview & { reviewer?: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankAccount, setBankAccount] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: tx, error } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", txId)
      .single();

    if (error || !tx) {
      router.push("/bazar/transakce");
      return;
    }

    setTransaction(tx as EscrowTransaction);

    const [listingRes, buyerRes, sellerRes, disputeRes, reviewsRes] = await Promise.all([
      supabase.from("listings").select("*").eq("id", tx.listing_id).single(),
      supabase.from("profiles").select("*").eq("id", tx.buyer_id).single(),
      supabase.from("profiles").select("*").eq("id", tx.seller_id).single(),
      supabase.from("escrow_disputes").select("*").eq("escrow_id", tx.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("escrow_reviews").select("*, reviewer:profiles!escrow_reviews_reviewer_id_fkey(id, username, display_name, avatar_url)").eq("escrow_id", tx.id),
    ]);

    setListing(listingRes.data as Listing | null);
    setBuyer(buyerRes.data as Profile | null);
    setSeller(sellerRes.data as Profile | null);
    if (disputeRes.data && disputeRes.data.length > 0) {
      setDispute(disputeRes.data[0] as EscrowDispute);
    }
    if (reviewsRes.data) {
      setReviews(reviewsRes.data as (EscrowReview & { reviewer?: Profile | null })[]);
    }

    // Fetch bank account for payment info
    const { data: settings } = await supabase
      .from("escrow_settings")
      .select("key, value")
      .in("key", ["bank_account", "bank_iban"]);
    if (settings) {
      const acc = settings.find(s => s.key === "bank_account")?.value || "";
      const iban = settings.find(s => s.key === "bank_iban")?.value || "";
      setBankAccount(acc);
      setBankIban(iban || (acc ? czechToIBAN(acc) : ""));
    }

    setLoading(false);
  }, [user, txId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate QR code for SPD payment
  useEffect(() => {
    if (!transaction || !bankIban || transaction.status !== "created") {
      setQrDataUrl(null);
      return;
    }
    const vs = transaction.payment_reference.replace(/\D/g, "");
    const amount = Number(transaction.amount).toFixed(2);
    const spd = `SPD*1.0*ACC:${bankIban}*AM:${amount}*CC:CZK*MSG:${transaction.payment_reference}*X-VS:${vs}`;

    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(spd, { width: 200, margin: 2 })
        .then((url: string) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null));
    }).catch(() => setQrDataUrl(null));
  }, [transaction, bankIban]);

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>Pro zobrazení transakce se přihlaste.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>Načítám transakci...</p>
      </div>
    );
  }

  if (!transaction) return null;

  const isBuyer = user.id === transaction.buyer_id;
  const isSeller = user.id === transaction.seller_id;
  const isAdmin = profile?.role === "admin";
  const role: "buyer" | "seller" | "admin" = isAdmin ? "admin" : isBuyer ? "buyer" : "seller";
  // Admin who is also buyer/seller gets dual actions
  const effectiveRoles: ("buyer" | "seller" | "admin")[] = [role];
  if (isAdmin && isBuyer && !effectiveRoles.includes("buyer")) effectiveRoles.push("buyer");
  if (isAdmin && isSeller && !effectiveRoles.includes("seller")) effectiveRoles.push("seller");

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px", fontSize: "13px" }}>
        <Link href="/bazar" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>Bazar</Link>
        <span style={{ color: "var(--text-dimmer)", margin: "0 8px" }}>/</span>
        <Link href="/bazar/transakce" style={{ color: "var(--text-dimmer)", textDecoration: "none" }}>Transakce</Link>
        <span style={{ color: "var(--text-dimmer)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--text-muted)" }}>{transaction.payment_reference}</span>
      </div>

      <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
        🛡️ Bezpečná platba {transaction.payment_reference}
      </h1>

      {listing && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", padding: "12px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div style={{ width: "96px", flexShrink: 0 }}>
            <div style={{ position: "relative", width: "100%", paddingBottom: "75%", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-soft)" }}>
              {listing.images?.[0] ? (
                <Image src={getImageVariant(listing.images[0], "thumb")} alt={listing.title} fill style={{ objectFit: "contain" }} sizes="96px" />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dimmer)", fontSize: "20px" }}>📦</div>
              )}
            </div>
          </div>
          <div>
            <Link href={`/bazar/${listing.id}`} style={{ color: "var(--accent)", textDecoration: "none", fontSize: "15px", fontWeight: 600 }}>
              {listing.title} →
            </Link>
            <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "4px" }}>
              ID inzerátu: {listing.id.slice(0, 8)}… · Ref: {transaction.payment_reference}
            </div>
          </div>
        </div>
      )}

      {/* Partial payment info */}
      {transaction.status === "partial_paid" && transaction.partial_amount != null && (
        <div style={{
          padding: "14px 16px",
          borderRadius: "10px",
          background: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.25)",
          marginBottom: "12px",
          fontSize: "14px",
        }}>
          <span style={{ fontWeight: 600, color: "#f97316" }}>⚠️ Neúplná platba</span>
          <span style={{ color: "var(--text-body)", marginLeft: "8px" }}>
            Přijato: <strong>{Number(transaction.partial_amount).toLocaleString("cs-CZ")} Kč</strong>
            {" · "}
            Chybí: <strong style={{ color: "#ef4444" }}>{(Number(transaction.amount) - Number(transaction.partial_amount)).toLocaleString("cs-CZ")} Kč</strong>
          </span>
        </div>
      )}

      {/* Timeline */}
      <EscrowTimeline status={transaction.status} />

      {/* Actions */}
      <div style={{ marginBottom: "24px" }}>
        <EscrowActions
          transaction={transaction}
          role={role}
          roles={effectiveRoles}
          onUpdate={fetchData}
        />
      </div>

      {/* Details grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <InfoCard label="Celková cena" value={`${Number(transaction.amount).toLocaleString("cs-CZ")} Kč`} />
        {(isSeller || isAdmin) && (
          <InfoCard label="Provize" value={`${Number(transaction.commission_amount).toLocaleString("cs-CZ")} Kč (${transaction.commission_rate}%)`} />
        )}
        {(isSeller || isAdmin) && (
          <InfoCard label="K vyplacení" value={`${Number(transaction.seller_payout).toLocaleString("cs-CZ")} Kč`} />
        )}
        <InfoCard label="Platební reference" value={transaction.payment_reference} />

        {buyer && <InfoCard label="Kupující" value={buyer.display_name || buyer.username} />}
        {seller && <InfoCard label="Prodávající" value={seller.display_name || seller.username} />}

        <InfoCard label="Vytvořeno" value={formatCzechDate(transaction.created_at)} />
        {transaction.shipped_at && <InfoCard label="Odesláno" value={formatCzechDate(transaction.shipped_at)} />}
        {transaction.completed_at && <InfoCard label="Dokončeno" value={formatCzechDate(transaction.completed_at)} />}
        {transaction.auto_complete_at && transaction.status === "shipped" && (
          <InfoCard label="Automatické dokončení" value={formatCzechDate(transaction.auto_complete_at)} />
        )}
      </div>

      {/* Payment info — for buyer when status is "created" */}
      {transaction.status === "created" && isBuyer && bankAccount && (
        <div
          style={{
            padding: "20px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(240,160,48,0.08) 100%)",
            border: "1px solid rgba(34,197,94,0.25)",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
            💳 Platební údaje
          </h3>
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Číslo účtu</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>{bankAccount}</div>
              </div>
              {bankIban && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>IBAN</div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted)", fontFamily: "monospace" }}>{bankIban}</div>
                </div>
              )}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Částka</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#22c55e" }}>{Number(transaction.amount).toLocaleString("cs-CZ")} Kč</div>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginBottom: "2px" }}>Variabilní symbol / zpráva</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>{transaction.payment_reference}</div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "12px", lineHeight: 1.5 }}>
                Po připsání platby na účet admin potvrdí přijetí a prodávající bude vyzván k odeslání zboží.
              </p>
            </div>
            {qrDataUrl && (
              <div style={{ textAlign: "center" }}>
                <img src={qrDataUrl} alt="QR platba" style={{ width: "160px", height: "160px", borderRadius: "8px" }} />
                <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "6px" }}>Naskenujte v bankovní aplikaci</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tracking info */}
      {transaction.tracking_number && (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            📦 Sledování zásilky
          </h3>
          <div style={{ fontSize: "14px", color: "var(--text-body)" }}>
            <strong>Číslo zásilky:</strong> {transaction.tracking_number}
            {transaction.carrier && (
              <span style={{ marginLeft: "16px" }}>
                <strong>Dopravce:</strong> {transaction.carrier}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dispute section */}
      {dispute && (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.2)",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#ef4444", marginBottom: "8px" }}>
            ⚠️ Spor
          </h3>
          <div style={{ fontSize: "14px", color: "var(--text-body)", marginBottom: "8px" }}>
            <strong>Důvod:</strong> {dispute.reason}
          </div>

          {dispute.evidence_images && dispute.evidence_images.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              {dispute.evidence_images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Důkaz ${i + 1}`}
                    style={{ width: "80px", height: "80px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--border)" }}
                  />
                </a>
              ))}
            </div>
          )}

          {dispute.resolution && (
            <div style={{ marginTop: "12px", padding: "12px", borderRadius: "8px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <strong style={{ color: "#22c55e" }}>Rozhodnutí:</strong>
              <span style={{ color: "var(--text-body)", marginLeft: "8px" }}>{dispute.resolution}</span>
            </div>
          )}

          {/* Admin resolve form */}
          {isAdmin && dispute.status === "open" && (
            <AdminResolveForm disputeId={dispute.id} onResolved={fetchData} />
          )}
        </div>
      )}

      {/* Admin notes */}
      {isAdmin && (
        <div style={{ padding: "16px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: "24px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            📝 Admin poznámky
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {transaction.notes || "Žádné poznámky"}
          </p>
        </div>
      )}

      {/* Reviews section */}
      {reviews.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
            ⭐ Recenze
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {reviews.map((review) => (
              <div key={review.id} style={{ padding: "14px 16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                    {(review.reviewer as Profile | null | undefined)?.display_name || (review.reviewer as Profile | null | undefined)?.username || "Uživatel"}
                  </span>
                  <span style={{ fontSize: "16px" }}>
                    {"⭐".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                {review.text && (
                  <p style={{ fontSize: "14px", color: "var(--text-body)", margin: 0, lineHeight: 1.5 }}>
                    {review.text}
                  </p>
                )}
                <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "6px" }}>
                  {formatCzechDate(review.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review form — after transaction is completed */}
      {(isBuyer || isSeller) &&
        ["completed", "auto_completed", "payout_sent", "payout_confirmed"].includes(transaction.status) &&
        !reviews.find((r) => r.reviewer_id === user.id) && (
          <div style={{ marginBottom: "24px" }}>
            <EscrowReviewForm escrowId={transaction.id} onSubmitted={fetchData} />
          </div>
        )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "14px", color: "var(--text-body)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function AdminResolveForm({ disputeId, onResolved }: { disputeId: string; onResolved: () => void }) {
  const [resolutionStatus, setResolutionStatus] = useState("resolved_buyer");
  const [resolutionText, setResolutionText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResolve() {
    if (!confirm("Opravdu chcete rozhodnout tento spor?")) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/escrow/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dispute_id: disputeId,
          resolution_status: resolutionStatus,
          resolution_text: resolutionText || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Chyba");
      }
      onResolved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "16px", padding: "16px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>⚖️ Rozhodnout spor</h4>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Rozhodnutí</label>
        <select
          value={resolutionStatus}
          onChange={(e) => setResolutionStatus(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "14px" }}
        >
          <option value="resolved_buyer">Ve prospěch kupujícího (vrátit peníze)</option>
          <option value="resolved_seller">Ve prospěch prodávajícího (uvolnit peníze)</option>
          <option value="resolved_split">Kompromis (rozdělit)</option>
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Odůvodnění</label>
        <textarea
          value={resolutionText}
          onChange={(e) => setResolutionText(e.target.value)}
          rows={3}
          placeholder="Odůvodnění rozhodnutí..."
          style={{
            width: "100%", padding: "10px 12px", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box",
            fontFamily: "inherit", resize: "vertical",
          }}
        />
      </div>

      <button
        onClick={handleResolve}
        disabled={loading}
        style={{
          padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.15)", color: "#22c55e",
        }}
      >
        ⚖️ Rozhodnout
      </button>
    </div>
  );
}
