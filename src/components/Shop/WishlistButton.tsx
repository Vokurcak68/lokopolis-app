"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth/AuthProvider";
import { useWishlist } from "./WishlistProvider";

interface WishlistButtonProps {
  productId: string;
  size?: "small" | "large";
}

export default function WishlistButton({ productId, size = "small" }: WishlistButtonProps) {
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const router = useRouter();
  const [animating, setAnimating] = useState(false);
  const inList = isInWishlist(productId);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/prihlaseni");
      return;
    }
    setAnimating(true);
    await toggleWishlist(productId);
    setTimeout(() => setAnimating(false), 300);
  }

  if (size === "large") {
    return (
      <button
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          borderRadius: "10px",
          border: inList ? "1px solid #ef444460" : "1px solid var(--border)",
          background: inList ? "rgba(239,68,68,0.1)" : "var(--bg-card)",
          color: inList ? "#ef4444" : "var(--text-muted)",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
          transform: animating ? "scale(1.05)" : "scale(1)",
        }}
      >
        <span style={{ fontSize: "18px" }}>{inList ? "♥" : "♡"}</span>
        {inList ? "V oblíbených" : "Přidat do oblíbených"}
      </button>
    );
  }

  // Small version for ProductCard
  return (
    <button
      onClick={handleClick}
      style={{
        position: "absolute",
        bottom: "8px",
        right: "8px",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "none",
        background: inList ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.5)",
        color: "#fff",
        fontSize: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        transform: animating ? "scale(1.2)" : "scale(1)",
        zIndex: 2,
        lineHeight: 1,
      }}
      title={inList ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
    >
      {inList ? "♥" : "♡"}
    </button>
  );
}
