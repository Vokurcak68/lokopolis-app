import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: NextRequest) {
  try {
    const productId = req.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "Chybí productId" }, { status: 400 });
    }

    // Get auth token from cookie (Supabase stores it there) or Authorization header
    const authHeader = req.headers.get("authorization");
    let token = authHeader?.replace("Bearer ", "") || "";

    if (!token) {
      // Read from Supabase auth cookies
      const accessCookie = req.cookies.get("sb-access-token")?.value
        || req.cookies.get(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`)?.value;

      if (accessCookie) {
        // Supabase stores JSON-encoded array [access_token, refresh_token] or just access_token
        try {
          const parsed = JSON.parse(accessCookie);
          token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed);
        } catch {
          token = accessCookie;
        }
      }
    }

    // Try getting user from token or from cookie-based session
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });

    const { data: { user } } = await userClient.auth.getUser(token || undefined);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get product
    const { data: product, error: productError } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", productId)
      .eq("status", "active")
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
    }

    const isFree = product.price === 0;

    // Check if user has purchase or product is free
    if (!isFree) {
      const { data: purchase } = await supabase
        .from("user_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (!purchase) {
        return NextResponse.json({ error: "Nemáte zakoupen tento produkt" }, { status: 403 });
      }
    }

    if (!product.file_url) {
      return NextResponse.json({ error: "Soubor není k dispozici" }, { status: 404 });
    }

    // Extract path from file_url (remove bucket prefix if needed)
    const filePath = product.file_url.startsWith("shop/")
      ? product.file_url.replace("shop/", "")
      : product.file_url;

    // Create signed URL (60 min expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("shop")
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json({ error: "Nepodařilo se vytvořit odkaz ke stažení" }, { status: 500 });
    }

    // Increment download count
    try {
      await supabase
        .from("shop_products")
        .update({ download_count: (product.download_count || 0) + 1 })
        .eq("id", productId);
    } catch {
      // ignore increment errors
    }

    return NextResponse.json({ url: signedData.signedUrl });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
