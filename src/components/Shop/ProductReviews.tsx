"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { ProductReview } from "@/types/database";

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  size?: number;
  interactive?: boolean;
}

function StarRating({ value, onChange, size = 20, interactive = false }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          style={{
            fontSize: `${size}px`,
            cursor: interactive ? "pointer" : "default",
            color: (hover || value) >= star ? "#f59e0b" : "var(--text-dimmer)",
            transition: "color 0.15s",
            userSelect: "none",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

interface ProductReviewsProps {
  productId: string;
  avgRating: number;
  reviewCount: number;
  onStatsUpdate?: (avg: number, count: number) => void;
}

export default function ProductReviews({ productId, avgRating, reviewCount, onStatsUpdate }: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("product_reviews")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      const all = (data || []) as ProductReview[];
      // Approved reviews for display
      const approved = all.filter((r) => r.is_approved);
      setReviews(approved);

      // Find user's own review (could be unapproved)
      if (user) {
        const mine = all.find((r) => r.user_id === user.id);
        setMyReview(mine || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [productId, user]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || rating === 0) return;
    setSubmitting(true);
    setSubmitMsg("");

    try {
      // Check if user has a purchase (for verified badge)
      const { data: purchase } = await supabase
        .from("user_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        is_verified_purchase: !!purchase,
        is_approved: false,
      });

      if (error) {
        if (error.code === "23505") {
          setSubmitMsg("Již jste přidali recenzi k tomuto produktu.");
        } else {
          setSubmitMsg("Chyba při odesílání recenze.");
        }
        return;
      }

      setSubmitMsg("Recenze odeslána! Čeká na schválení adminem.");
      setShowForm(false);
      setRating(0);
      setTitle("");
      setBody("");
      fetchReviews();
    } catch {
      setSubmitMsg("Chyba při odesílání recenze.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayAvg = avgRating || 0;

  return (
    <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
        ⭐ Hodnocení a recenze
      </h2>

      {/* Summary */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "36px", fontWeight: 800, color: "var(--text-primary)" }}>
            {displayAvg > 0 ? displayAvg.toFixed(1) : "—"}
          </span>
          <div>
            <StarRating value={Math.round(displayAvg)} size={22} />
            <div style={{ fontSize: "13px", color: "var(--text-dimmer)", marginTop: "2px" }}>
              {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? "recenze" : reviewCount < 5 ? "recenze" : "recenzí"}` : "Zatím žádné recenze"}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews list */}
      {reviews.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
          {reviews.map((review) => {
            const authorName = review.profiles?.display_name || review.profiles?.username || "Anonym";
            return (
              <div
                key={review.id}
                style={{
                  padding: "16px 20px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {review.profiles?.avatar_url ? (
                    <Image
                      src={review.profiles.avatar_url}
                      alt={authorName}
                      width={28}
                      height={28}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "var(--accent-bg)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{authorName}</span>
                  <StarRating value={review.rating} size={14} />
                  {review.is_verified_purchase && (
                    <span style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>✓ Ověřený nákup</span>
                  )}
                  <span style={{ fontSize: "12px", color: "var(--text-dimmer)", marginLeft: "auto" }}>
                    {new Date(review.created_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                {review.title && (
                  <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", marginBottom: "4px" }}>
                    {review.title}
                  </div>
                )}
                {review.body && (
                  <p style={{ fontSize: "14px", color: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>
                    {review.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submit message */}
      {submitMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            background: submitMsg.includes("Chyba") || submitMsg.includes("Již") ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
            color: submitMsg.includes("Chyba") || submitMsg.includes("Již") ? "#ef4444" : "#22c55e",
            border: `1px solid ${submitMsg.includes("Chyba") || submitMsg.includes("Již") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
          }}
        >
          {submitMsg}
        </div>
      )}

      {/* Review form or button */}
      {user && !myReview && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "1px solid var(--accent)",
            background: "transparent",
            color: "var(--accent)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✍️ Napsat recenzi
        </button>
      )}

      {user && myReview && !myReview.is_approved && (
        <div style={{ fontSize: "14px", color: "var(--text-dimmer)", fontStyle: "italic" }}>
          Vaše recenze čeká na schválení.
        </div>
      )}

      {!user && (
        <p style={{ fontSize: "14px", color: "var(--text-dimmer)" }}>
          Pro napsání recenze se{" "}
          <a href="/prihlaseni" style={{ color: "var(--accent)" }}>přihlaste</a>.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginTop: "16px", maxWidth: "600px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Hodnocení *
            </label>
            <StarRating value={rating} onChange={setRating} size={28} interactive />
            {rating === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "4px" }}>
                Klikněte na hvězdičku
              </div>
            )}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Titulek (nepovinný)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Stručné shrnutí..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Recenze
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Váš názor na produkt..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: rating === 0 ? "var(--border)" : "var(--accent)",
                color: "var(--accent-text-on)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: rating === 0 ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Odesílám..." : "Odeslat recenzi"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Zrušit
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
