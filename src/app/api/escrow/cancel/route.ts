import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { escrow_id } = body;
    if (!escrow_id) {
      return NextResponse.json({ error: "Chybí escrow_id" }, { status: 400 });
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

    // Buyer can cancel before shipping, admin can cancel anytime before completion
    const isUserAdmin = await isAdmin(user.id);
    const isBuyer = transaction.buyer_id === user.id;

    if (!isBuyer && !isUserAdmin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const cancellableStatuses = isBuyer
      ? ["created", "paid"]
      : ["created", "paid", "shipped", "delivered", "disputed"];

    if (!cancellableStatuses.includes(transaction.status)) {
      return NextResponse.json({ error: `Nelze zrušit ve stavu "${transaction.status}"` }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", escrow_id);

    if (updateError) {
      return NextResponse.json({ error: "Nepodařilo se zrušit transakci" }, { status: 500 });
    }

    // Restore listing to active
    await supabase
      .from("listings")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", transaction.listing_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow cancel error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
