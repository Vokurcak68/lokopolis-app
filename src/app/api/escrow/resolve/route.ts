import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowResolved } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const body = await req.json();
    const { dispute_id, resolution_status, resolution_text } = body;
    if (!dispute_id || !resolution_status) {
      return NextResponse.json({ error: "Chybí dispute_id nebo resolution_status" }, { status: 400 });
    }

    const validStatuses = ["resolved_buyer", "resolved_seller", "resolved_split"];
    if (!validStatuses.includes(resolution_status)) {
      return NextResponse.json({ error: "Neplatný status rozhodnutí" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Fetch dispute
    const { data: dispute, error: disputeError } = await supabase
      .from("escrow_disputes")
      .select("*")
      .eq("id", dispute_id)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json({ error: "Spor nenalezen" }, { status: 404 });
    }

    if (dispute.status !== "open") {
      return NextResponse.json({ error: "Spor je již vyřešen" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update dispute
    await supabase
      .from("escrow_disputes")
      .update({
        status: resolution_status,
        resolution: resolution_text || null,
        resolved_by: user.id,
        resolved_at: now,
      })
      .eq("id", dispute_id);

    // Update escrow transaction based on resolution
    let newEscrowStatus: string;
    if (resolution_status === "resolved_buyer") {
      newEscrowStatus = "refunded";
    } else if (resolution_status === "resolved_seller") {
      newEscrowStatus = "completed";
    } else {
      newEscrowStatus = "completed"; // split — admin handles manually
    }

    await supabase
      .from("escrow_transactions")
      .update({
        status: newEscrowStatus,
        completed_at: now,
      })
      .eq("id", dispute.escrow_id);

    // Fetch transaction + profiles for email
    const { data: transaction } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", dispute.escrow_id)
      .single();

    if (transaction) {
      const [buyerRes, sellerRes, listingRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
        supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
        supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
      ]);

      const buyer = buyerRes.data;
      const seller = sellerRes.data;
      const listing = listingRes.data;
      const updatedDispute = { ...dispute, status: resolution_status };
      const html = escrowResolved(buyer, seller, updatedDispute, resolution_text || "", transaction, listing || undefined);

      const emailPromises = [];
      if (buyer?.email) emailPromises.push(sendEmail(buyer.email, `⚖️ Spor vyřešen (${transaction.payment_reference})`, html));
      if (seller?.email) emailPromises.push(sendEmail(seller.email, `⚖️ Spor vyřešen (${transaction.payment_reference})`, html));

      try {
        await Promise.all(emailPromises);
      } catch (e) {
        console.error("Escrow resolve email error:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow resolve error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
