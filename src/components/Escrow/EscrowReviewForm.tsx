"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface EscrowReviewFormProps {
  escrowId: string;
  onSubmitted: () => void;
}

export default function EscrowReviewForm({ escrowId, onSubmitted }: EscrowReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (rating < 1 || rating > 5) {
      setError("Vyberte hodnocení (1-5 hvězdiček)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/escrow/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escrow_id: escrowId, rating, text: text.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba");

      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "16px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>⭐ Napsat recenzi</h4>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {/* Star rating */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>Hodnocení</label>
        <div style={{ display: "flex", gap: "4px" }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                fontSize: "28px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                filter: (hoverRating || rating) >= star ? "none" : "grayscale(1) opacity(0.3)",
                transition: "filter 0.15s, transform 0.15s",
                transform: (hoverRating || rating) >= star ? "scale(1.1)" : "scale(1)",
              }}
            >
              ⭐
            </button>
          ))}
          {rating > 0 && (
            <span style={{ alignSelf: "center", marginLeft: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
              {rating}/5
            </span>
          )}
        </div>
      </div>

      {/* Text */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>Komentář (nepovinný)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Jak probíhala transakce? Doporučili byste protistranu?"
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--bg-input, var(--bg-card))",
            color: "var(--text-primary)",
            fontSize: "14px",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: loading || rating === 0 ? "not-allowed" : "pointer",
          opacity: loading || rating === 0 ? 0.5 : 1,
          border: "1px solid rgba(240,160,48,0.3)",
          background: "rgba(240,160,48,0.15)",
          color: "#f0a030",
          transition: "opacity 0.2s",
        }}
      >
        {loading ? "Odesílám…" : "⭐ Odeslat recenzi"}
      </button>
    </div>
  );
}
