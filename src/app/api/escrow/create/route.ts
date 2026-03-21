import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, getEscrowSettings, generatePaymentReference } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowCreated } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { listing_id, delivery_address } = body;
    if (!listing_id) {
      return NextResponse.json({ error: "Chybí listing_id" }, { status: 400 });
    }
    if (!delivery_address || !delivery_address.name || !delivery_address.street || !delivery_address.city || !delivery_address.zip) {
      return NextResponse.json({ error: "Vyplňte dodací adresu (jméno, ulice, město, PSČ)" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const settings = await getEscrowSettings();

    if (settings.escrow_enabled !== "true") {
      return NextResponse.json({ error: "Bezpečná platba je momentálně vypnuta" }, { status: 400 });
    }

    // Fetch listing
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Inzerát nenalezen" }, { status: 404 });
    }

    if (listing.status !== "active") {
      return NextResponse.json({ error: "Inzerát není aktivní" }, { status: 400 });
    }

    if (!listing.shipping) {
      return NextResponse.json({ error: "Inzerát nemá možnost zaslání" }, { status: 400 });
    }

    if (!Array.isArray(listing.payment_methods) || !listing.payment_methods.includes("escrow")) {
      return NextResponse.json({ error: "Prodejce nepovolil Bezpečnou platbu" }, { status: 400 });
    }

    if (user.id === listing.seller_id) {
      return NextResponse.json({ error: "Nemůžete koupit vlastní inzerát" }, { status: 400 });
    }

    // Check if there's already an active escrow for this listing
    const { data: existingEscrow } = await supabase
      .from("escrow_transactions")
      .select("id, status")
      .eq("listing_id", listing_id)
      .in("status", ["created", "paid", "shipped", "delivered"])
      .limit(1);

    if (existingEscrow && existingEscrow.length > 0) {
      return NextResponse.json({ error: "Pro tento inzerát již existuje aktivní escrow transakce" }, { status: 400 });
    }

    // Calculate commission
    const amount = Number(listing.price);
    const commissionRate = Number(settings.commission_rate || 5);
    const minCommission = Number(settings.min_commission || 15);
    let commissionAmount = Math.round(amount * commissionRate / 100);
    if (commissionAmount < minCommission) commissionAmount = minCommission;
    const sellerPayout = amount - commissionAmount;

    const paymentReference = generatePaymentReference();

    // Create escrow transaction
    const { data: transaction, error: createError } = await supabase
      .from("escrow_transactions")
      .insert({
        listing_id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        seller_payout: sellerPayout,
        status: "created",
        payment_reference: paymentReference,
        delivery_address,
      })
      .select()
      .single();

    if (createError || !transaction) {
      console.error("Escrow create error:", createError);
      return NextResponse.json({ error: "Nepodařilo se vytvořit transakci" }, { status: 500 });
    }

    // Mark listing as reserved
    await supabase
      .from("listings")
      .update({ status: "reserved", updated_at: new Date().toISOString() })
      .eq("id", listing_id);

    // Fetch buyer & seller profiles for email
    const [buyerRes, sellerRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("profiles").select("*").eq("id", listing.seller_id).single(),
    ]);

    const buyer = buyerRes.data;
    const seller = sellerRes.data;

    // Send email to buyer
    if (buyer?.email) {
      try {
        const html = escrowCreated(
          buyer, seller, listing, transaction,
          settings.bank_account || "",
          settings.bank_iban || "",
          undefined,
          Number(settings.payment_deadline_hours) || 24,
        );
        await sendEmail(buyer.email, `🛡️ Bezpečná platba vytvořena — ${paymentReference}`, html);
      } catch (e) {
        console.error("Escrow email error:", e);
      }
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Escrow create error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
