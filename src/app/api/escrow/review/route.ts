import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient } from "@/lib/escrow-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { escrow_id, rating, text } = body;

    if (!escrow_id || !rating) {
      return NextResponse.json({ error: "Chybí escrow_id nebo rating" }, { status: 400 });
    }

    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return NextResponse.json({ error: "Rating musí být celé číslo 1-5" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: transaction, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", escrow_id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    // Only buyer or seller can review
    const isBuyer = transaction.buyer_id === user.id;
    const isSeller = transaction.seller_id === user.id;
    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: "Recenzi může napsat pouze kupující nebo prodávající" }, { status: 403 });
    }

    // Only after payout_confirmed, completed, or auto_completed
    if (!["payout_confirmed", "completed", "auto_completed", "payout_sent"].includes(transaction.status)) {
      return NextResponse.json({ error: "Recenzi lze napsat až po dokončení transakce" }, { status: 400 });
    }

    // Reviewer reviews the other party
    const reviewed_id = isBuyer ? transaction.seller_id : transaction.buyer_id;

    // Check if already reviewed
    const { data: existingReview } = await supabase
      .from("escrow_reviews")
      .select("id")
      .eq("escrow_id", escrow_id)
      .eq("reviewer_id", user.id)
      .single();

    if (existingReview) {
      return NextResponse.json({ error: "Už jste napsal/a recenzi k této transakci" }, { status: 400 });
    }

    const { error: insertError } = await supabase
      .from("escrow_reviews")
      .insert({
        escrow_id,
        reviewer_id: user.id,
        reviewed_id,
        rating: ratingNum,
        text: text?.trim() || null,
      });

    if (insertError) {
      console.error("Insert review error:", insertError);
      return NextResponse.json({ error: "Nepodařilo se uložit recenzi" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow review error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
