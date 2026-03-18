import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, getEscrowSettings } from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import { escrowShipped, escrowDelivered, escrowDeliveredSeller } from "@/lib/email-templates";
import { registerShipment, getShipmentVerification } from "@/lib/shieldtrack";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { escrow_id, tracking_number, carrier, shipping_photo, shipping_proof_urls } = body;
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

    if (transaction.seller_id !== user.id) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    if (transaction.status !== "paid") {
      return NextResponse.json({ error: `Nelze odeslat ve stavu "${transaction.status}"` }, { status: 400 });
    }

    const settings = await getEscrowSettings();
    const autoCompleteDays = Number(settings.auto_complete_days || 14);
    const autoCompleteAt = new Date();
    autoCompleteAt.setDate(autoCompleteAt.getDate() + autoCompleteDays);

    const updatePayload: Record<string, unknown> = {
      status: "shipped",
      tracking_number: tracking_number || null,
      carrier: carrier || null,
      shipping_photo: shipping_photo || null,
      shipped_at: new Date().toISOString(),
      auto_complete_at: autoCompleteAt.toISOString(),
    };

    // Save shipping proof URLs if provided
    if (shipping_proof_urls && Array.isArray(shipping_proof_urls) && shipping_proof_urls.length > 0) {
      updatePayload.shipping_proof_urls = shipping_proof_urls;
    }

    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update(updatePayload)
      .eq("id", escrow_id);

    if (updateError) {
      return NextResponse.json({ error: "Nepodařilo se aktualizovat transakci" }, { status: 500 });
    }

    // Fetch buyer + seller + listing data (needed for ShieldTrack + email)
    const [buyerRes, listingRes, sellerRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
      supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
      supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
    ]);

    // ShieldTrack — registrace zásilky (non-blocking)
    if (tracking_number) {
      try {
        const deliveryAddress = transaction.delivery_address as { name?: string; street?: string; city?: string; zip?: string } | null;
        const sellerProfile = sellerRes.data;

        const stResult = await registerShipment({
          tracking_number,
          recipient_name: deliveryAddress?.name || "",
          recipient_city: deliveryAddress?.city || "",
          recipient_zip: deliveryAddress?.zip || "",
          recipient_address: deliveryAddress?.street || "",
          external_order_id: transaction.payment_reference,
          sender_name: sellerProfile?.display_name || sellerProfile?.username || "",
        });

        // Uložit shieldtrack_shipment_id
        if (stResult?.id) {
          await supabase
            .from("escrow_transactions")
            .update({ shieldtrack_shipment_id: stResult.id })
            .eq("id", escrow_id);

          // Check if package is already delivered (old tracking numbers)
          try {
            const shipment = await getShipmentVerification(stResult.id);
            const deliveryCheck = shipment.verification?.checks?.find(
              (c: { name: string; status: string }) => c.name === "delivery_confirmed" && c.status === "passed"
            );

            if (deliveryCheck) {
              const now = new Date().toISOString();
              await supabase
                .from("escrow_transactions")
                .update({
                  status: "delivered",
                  delivered_at: now,
                  st_score: shipment.verification?.score ?? null,
                  st_status: shipment.verification?.status ?? null,
                })
                .eq("id", escrow_id)
                .eq("status", "shipped");

              console.log(`ShieldTrack: package already delivered for escrow ${escrow_id}`);

              // Send delivered emails instead of shipped email
              const buyer = buyerRes?.data;
              const listing = listingRes?.data;
              const seller = sellerRes?.data;

              if (buyer?.email && listing) {
                try {
                  const html = escrowDelivered(buyer, listing, { ...transaction, tracking_number, carrier }, settings);
                  await sendEmail(buyer.email, `📬 Zásilka doručena — potvrďte přijetí (${transaction.payment_reference})`, html);
                } catch (e) { console.error("Delivered email to buyer error:", e); }
              }
              if (seller?.email && listing) {
                try {
                  const html = escrowDeliveredSeller(seller, listing, { ...transaction, tracking_number, carrier }, settings);
                  await sendEmail(seller.email, `📬 Zásilka doručena — čekáme na potvrzení kupujícího (${transaction.payment_reference})`, html);
                } catch (e) { console.error("Delivered email to seller error:", e); }
              }

              return NextResponse.json({ success: true, delivered: true });
            }
          } catch (verifyErr) {
            console.warn("ShieldTrack immediate delivery check failed (non-blocking):", verifyErr);
          }
        }
      } catch (stError) {
        console.warn("ShieldTrack registration failed (non-blocking):", stError);
      }
    }

    const buyer = buyerRes?.data;
    const listing = listingRes?.data;

    if (buyer?.email && listing) {
      try {
        const updatedTransaction = { ...transaction, tracking_number: tracking_number || null, carrier: carrier || null };
        const html = escrowShipped(buyer, listing, updatedTransaction);
        await sendEmail(buyer.email, `📦 Zboží odesláno (${transaction.payment_reference})`, html);
      } catch (e) {
        console.error("Escrow email error:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Escrow ship error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
