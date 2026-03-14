"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";

interface WishlistContextType {
  wishlistIds: string[];
  wishlistCount: number;
  loading: boolean;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWishlist = useCallback(async () => {
    if (!user) {
      setWishlistIds([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("wishlist")
        .select("product_id")
        .eq("user_id", user.id);
      setWishlistIds((data || []).map((w) => w.product_id));
    } catch {
      setWishlistIds([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const isInWishlist = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) return;
      const inList = wishlistIds.includes(productId);
      if (inList) {
        // Remove
        setWishlistIds((prev) => prev.filter((id) => id !== productId));
        await supabase
          .from("wishlist")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
      } else {
        // Add
        setWishlistIds((prev) => [...prev, productId]);
        await supabase
          .from("wishlist")
          .insert({ user_id: user.id, product_id: productId });
      }
    },
    [user, wishlistIds]
  );

  return (
    <WishlistContext.Provider
      value={{ wishlistIds, wishlistCount: wishlistIds.length, loading, isInWishlist, toggleWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
