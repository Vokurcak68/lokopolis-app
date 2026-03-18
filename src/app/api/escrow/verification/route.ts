import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin, getEscrowSettings } from "@/lib/escrow-helpers";
import { getShipmentVerification } from "@/lib/shieldtrack";
import { sendEmail } from "@/lib/email";
import { escrowVerificationAlert, escrowDelivered, escrowDeliveredSeller } from "@/lib/email-templates";

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
      .select("id, buyer_id, seller_id, shieldtrack_shipment_id, listing_id, payment_reference, amount, st_alert_sent, status, delivered_at")
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

      const verification = shipment.verification;

      // Sync st_score a st_status do escrow_transactions (cache)
      if (verification) {
        const score = typeof verification.score === "number" ? verification.score : null;
        const stStatus = verification.status || null;

        await supabase
          .from("escrow_transactions")
          .update({ st_score: score, st_status: stStatus })
          .eq("id", escrowId);

        // Alert admin při nízkém skóre (< 40) — pokud ještě nebyl poslán
        if (score !== null && score < 40 && !transaction.st_alert_sent) {
          // Auto-trigger photo verification when ST score < 40 and shipping proofs exist
          try {
            const { data: fullTx } = await supabase
              .from("escrow_transactions")
              .select("shipping_proof_urls, photo_verification")
              .eq("id", escrowId)
              .single();

            if (fullTx?.shipping_proof_urls?.length > 0 && !fullTx?.photo_verification) {
              const { runPhotoVerification } = await import("@/lib/photo-verification");
              await runPhotoVerification(escrowId, supabase);
              console.log(`Auto photo verification triggered for escrow ${escrowId} (ST score < 40)`);
            }
          } catch (pvErr) {
            console.warn("Auto photo verification failed:", pvErr);
          }

          try {
            const settings = await getEscrowSettings();

            // Načíst listing pro email
            const { data: listing } = await supabase
              .from("listings")
              .select("id, title")
              .eq("id", transaction.listing_id)
              .single();

            // Získat admin email
            let adminEmail = settings.admin_email;
            if (!adminEmail) {
              const { data: adminProfile } = await supabase
                .from("profiles")
                .select("email")
                .eq("role", "admin")
                .limit(1)
                .single();
              adminEmail = adminProfile?.email || "";
            }

            if (adminEmail) {
              const checks = Array.isArray(verification.checks) ? verification.checks : [];
              const html = escrowVerificationAlert(
                transaction,
                listing || { title: "Neznámý inzerát" },
                score,
                checks,
                settings,
              );

              await sendEmail(
                adminEmail,
                `🚨 ShieldTrack alert — skóre ${score}/100 — ${transaction.payment_reference}`,
                html,
              );

              // Označit alert jako poslaný
              await supabase
                .from("escrow_transactions")
                .update({ st_alert_sent: true })
                .eq("id", escrowId);
            }
          } catch (alertErr) {
            console.warn("Nepodařilo se odeslat ShieldTrack alert:", alertErr);
          }
        }

        // Auto-delivered: pokud ShieldTrack ukazuje delivery_confirmed=pass a status je "shipped"
        const deliveryCheck = Array.isArray(verification.checks)
          ? verification.checks.find((c: { name: string; status: string }) => c.name === "delivery_confirmed")
          : null;

        if (
          deliveryCheck &&
          deliveryCheck.status === "passed" &&
          transaction.status === "shipped"
        ) {
          try {
            const now = new Date().toISOString();
            await supabase
              .from("escrow_transactions")
              .update({
                status: "delivered",
                delivered_at: now,
              })
              .eq("id", escrowId)
              .eq("status", "shipped"); // Optimistic lock

            // Send delivery notification emails
            const [buyerRes, sellerRes, listingRes] = await Promise.all([
              supabase.from("profiles").select("*").eq("id", transaction.buyer_id).single(),
              supabase.from("profiles").select("*").eq("id", transaction.seller_id).single(),
              supabase.from("listings").select("*").eq("id", transaction.listing_id).single(),
            ]);

            const buyer = buyerRes.data;
            const seller = sellerRes.data;
            const listing = listingRes.data || { title: "Neznámý inzerát", id: transaction.listing_id };
            const emailSettings = await getEscrowSettings();

            if (buyer?.email) {
              const html = escrowDelivered(buyer, listing, transaction, emailSettings);
              await sendEmail(
                buyer.email,
                `📬 Zásilka doručena — potvrďte přijetí (${transaction.payment_reference})`,
                html,
              );
            }
            if (seller?.email) {
              const html = escrowDeliveredSeller(seller, listing, transaction, emailSettings);
              await sendEmail(
                seller.email,
                `📬 Zásilka doručena — čekáme na potvrzení kupujícího (${transaction.payment_reference})`,
                html,
              );
            }

            console.log(`Auto-delivered escrow ${escrowId} (delivery_confirmed=pass)`);
          } catch (deliveryErr) {
            console.warn("Auto-delivery update failed:", deliveryErr);
          }
        }
      }

      return NextResponse.json({
        available: true,
        verification,
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
