import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";
import { getShipmentVerification } from "@/lib/shieldtrack";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const escrowId = req.nextUrl.searchParams.get("escrow_id");
    if (!escrowId) {
      return NextResponse.json({ error: "Chybí escrow_id" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: transaction, error } = await supabase
      .from("escrow_transactions")
      .select("id, buyer_id, seller_id, shieldtrack_shipment_id")
      .eq("id", escrowId)
      .single();

    if (error || !transaction) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    // Ověřit přístup — buyer, seller nebo admin
    const isBuyer = transaction.buyer_id === user.id;
    const isSeller = transaction.seller_id === user.id;
    const userIsAdmin = await isAdmin(user.id);

    if (!isBuyer && !isSeller && !userIsAdmin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    // Pokud nemáme ShieldTrack ID, verifikace není dostupná
    if (!transaction.shieldtrack_shipment_id) {
      return NextResponse.json({ available: false });
    }

    try {
      const shipment = await getShipmentVerification(
        transaction.shieldtrack_shipment_id
      );

      return NextResponse.json({
        available: true,
        verification: shipment.verification,
      });
    } catch (stError) {
      console.warn("ShieldTrack verification fetch failed:", stError);
      return NextResponse.json({
        available: false,
        error: "Nepodařilo se načíst verifikaci",
      });
    }
  } catch (error) {
    console.error("Escrow verification error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
