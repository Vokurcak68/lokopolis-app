import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient } from "@/lib/escrow-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const url = new URL(req.url);
    const role = url.searchParams.get("role") || "all"; // all | buyer | seller
    const status = url.searchParams.get("status") || "";

    const supabase = getServiceClient();

    // Fetch transactions (service client = bypass RLS)
    let query = supabase
      .from("escrow_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (role === "buyer") {
      query = query.eq("buyer_id", user.id);
    } else if (role === "seller") {
      query = query.eq("seller_id", user.id);
    } else {
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Chyba při načítání transakcí" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ transactions: [] });
    }

    // Fetch listing data (service client = bypass RLS, vidí i sold/reserved)
    const listingIds = [...new Set(transactions.map(t => t.listing_id))];
    const otherIds = [...new Set(transactions.map(t =>
      t.buyer_id === user.id ? t.seller_id : t.buyer_id
    ))];

    const [listingsRes, profilesRes] = await Promise.all([
      supabase.from("listings").select("id, title, images").in("id", listingIds),
      supabase.from("profiles").select("id, display_name, username").in("id", otherIds),
    ]);

    const listingsMap = new Map(
      (listingsRes.data || []).map((l: { id: string; title: string; images?: string[] | null }) => [l.id, l])
    );
    const profilesMap = new Map(
      (profilesRes.data || []).map((p: { id: string; display_name: string | null; username: string }) => [
        p.id,
        p.display_name || p.username,
      ])
    );

    const enriched = transactions.map(t => ({
      ...t,
      listing_title: listingsMap.get(t.listing_id)?.title || "Neznámý inzerát",
      listing_image: listingsMap.get(t.listing_id)?.images?.[0] || null,
      other_name: profilesMap.get(
        t.buyer_id === user.id ? t.seller_id : t.buyer_id
      ) || "Anonym",
    }));

    return NextResponse.json({ transactions: enriched });
  } catch (error) {
    console.error("My transactions error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
