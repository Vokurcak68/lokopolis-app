"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { ShopProduct, CartItemData } from "@/types/database";

interface CartContextType {
  items: CartItemData[];
  cartCount: number;
  cartTotal: number;
  loading: boolean;
  addToCart: (product: ShopProduct, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const LS_KEY = "lokopolis_cart";
const DEFAULT_CART_TIMEOUT_MS = 72 * 60 * 60 * 1000; // 72 hours

interface LocalCartData {
  items: { productId: string; quantity: number }[];
  updatedAt: number;
}

function getLocalCartRaw(): LocalCartData {
  if (typeof window === "undefined") return { items: [], updatedAt: Date.now() };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { items: [], updatedAt: Date.now() };
    const parsed = JSON.parse(raw);
    // Support legacy format (plain array)
    if (Array.isArray(parsed)) {
      return { items: parsed, updatedAt: Date.now() };
    }
    return { items: parsed.items || [], updatedAt: parsed.updatedAt || Date.now() };
  } catch {
    return { items: [], updatedAt: Date.now() };
  }
}

function getLocalCart(timeoutMs: number): { productId: string; quantity: number }[] {
  const data = getLocalCartRaw();
  if (Date.now() - data.updatedAt > timeoutMs) {
    // Cart expired — clear it
    if (typeof window !== "undefined") localStorage.removeItem(LS_KEY);
    return [];
  }
  return data.items;
}

function setLocalCart(items: { productId: string; quantity: number }[]) {
  if (typeof window === "undefined") return;
  const data: LocalCartData = { items, updatedAt: Date.now() };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartTimeoutMs, setCartTimeoutMs] = useState(DEFAULT_CART_TIMEOUT_MS);

  // Fetch cart timeout setting
  useEffect(() => {
    fetch("/api/shop/settings")
      .then((res) => res.json())
      .then((settings) => {
        const hours = typeof settings.cart_timeout_hours === "number" ? settings.cart_timeout_hours : 72;
        setCartTimeoutMs(hours * 60 * 60 * 1000);
      })
      .catch(() => {});
  }, []);

  // Load cart
  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        // DB cart for logged-in users
        const { data: cart } = await supabase
          .from("carts")
          .select("id, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        // Check if DB cart is expired
        if (cart && cart.updated_at) {
          const updatedAt = new Date(cart.updated_at).getTime();
          if (Date.now() - updatedAt > cartTimeoutMs) {
            // Cart expired — clear it
            await supabase.from("cart_items").delete().eq("cart_id", cart.id);
            await supabase.from("carts").delete().eq("id", cart.id);
            setItems([]);
            setLoading(false);
            return;
          }
        }

        if (cart) {
          const { data: cartItems } = await supabase
            .from("cart_items")
            .select("product_id, quantity")
            .eq("cart_id", cart.id);

          if (cartItems && cartItems.length > 0) {
            const productIds = cartItems.map((ci) => ci.product_id);
            const { data: products } = await supabase
              .from("shop_products")
              .select("*")
              .in("id", productIds)
              .eq("status", "active");

            const loaded: CartItemData[] = [];
            for (const ci of cartItems) {
              const product = products?.find((p) => p.id === ci.product_id);
              if (product) {
                loaded.push({ product: product as ShopProduct, quantity: ci.quantity });
              }
            }
            setItems(loaded);
          } else {
            setItems([]);
          }
        } else {
          // Merge localStorage cart into DB on first login
          const local = getLocalCart(cartTimeoutMs);
          if (local.length > 0) {
            const { data: newCart } = await supabase
              .from("carts")
              .insert({ user_id: user.id })
              .select("id")
              .single();

            if (newCart) {
              for (const item of local) {
                await supabase.from("cart_items").insert({
                  cart_id: newCart.id,
                  product_id: item.productId,
                  quantity: item.quantity,
                });
              }
              setLocalCart([]);
              // Reload with merged data
              const productIds = local.map((l) => l.productId);
              const { data: products } = await supabase
                .from("shop_products")
                .select("*")
                .in("id", productIds)
                .eq("status", "active");

              const loaded: CartItemData[] = [];
              for (const l of local) {
                const product = products?.find((p) => p.id === l.productId);
                if (product) {
                  loaded.push({ product: product as ShopProduct, quantity: l.quantity });
                }
              }
              setItems(loaded);
            }
          } else {
            setItems([]);
          }
        }
      } else {
        // localStorage cart for anonymous
        const local = getLocalCart(cartTimeoutMs);
        if (local.length > 0) {
          const productIds = local.map((l) => l.productId);
          const { data: products } = await supabase
            .from("shop_products")
            .select("*")
            .in("id", productIds)
            .eq("status", "active");

          const loaded: CartItemData[] = [];
          for (const l of local) {
            const product = products?.find((p) => p.id === l.productId);
            if (product) {
              loaded.push({ product: product as ShopProduct, quantity: l.quantity });
            }
          }
          setItems(loaded);
        } else {
          setItems([]);
        }
      }
    } catch (err) {
      console.error("Cart load error:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, cartTimeoutMs]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = useCallback(
    async (product: ShopProduct, qty = 1) => {
      const existing = items.find((i) => i.product.id === product.id);
      // Digital products: max 1
      const isDigital = !!product.file_url;
      if (existing && isDigital) return;

      const newQty = existing ? existing.quantity + qty : qty;
      const finalQty = isDigital ? 1 : newQty;

      if (user) {
        let { data: cart } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cart) {
          const { data: newCart } = await supabase
            .from("carts")
            .insert({ user_id: user.id })
            .select("id")
            .single();
          cart = newCart;
        }

        if (cart) {
          await supabase.from("cart_items").upsert(
            { cart_id: cart.id, product_id: product.id, quantity: finalQty },
            { onConflict: "cart_id,product_id" }
          );
          // Touch updated_at
          await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
        }
      } else {
        const local = getLocalCart(cartTimeoutMs);
        const idx = local.findIndex((l) => l.productId === product.id);
        if (idx >= 0) {
          local[idx].quantity = finalQty;
        } else {
          local.push({ productId: product.id, quantity: finalQty });
        }
        setLocalCart(local);
      }

      setItems((prev) => {
        const idx = prev.findIndex((i) => i.product.id === product.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], quantity: finalQty };
          return updated;
        }
        return [...prev, { product, quantity: finalQty }];
      });
    },
    [items, user]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (user) {
        const { data: cart } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cart) {
          await supabase
            .from("cart_items")
            .delete()
            .eq("cart_id", cart.id)
            .eq("product_id", productId);
          await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
        }
      } else {
        const local = getLocalCart(cartTimeoutMs).filter((l) => l.productId !== productId);
        setLocalCart(local);
      }

      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    },
    [user, cartTimeoutMs]
  );

  const updateQuantity = useCallback(
    async (productId: string, qty: number) => {
      if (qty <= 0) {
        removeFromCart(productId);
        return;
      }

      if (user) {
        const { data: cart } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cart) {
          await supabase
            .from("cart_items")
            .update({ quantity: qty })
            .eq("cart_id", cart.id)
            .eq("product_id", productId);
          await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cart.id);
        }
      } else {
        const local = getLocalCart(cartTimeoutMs);
        const idx = local.findIndex((l) => l.productId === productId);
        if (idx >= 0) {
          local[idx].quantity = qty;
          setLocalCart(local);
        }
      }

      setItems((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
      );
    },
    [user, removeFromCart, cartTimeoutMs]
  );

  const clearCart = useCallback(async () => {
    if (user) {
      const { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cart) {
        await supabase.from("cart_items").delete().eq("cart_id", cart.id);
      }
    } else {
      setLocalCart([]);
    }
    setItems([]);
  }, [user]);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, cartCount, cartTotal, loading, addToCart, removeFromCart, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
