import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  getEscrowSettings,
  getServiceClient,
  isAdmin,
} from "@/lib/escrow-helpers";

function splitBankAccount(account: string): { accountNumber: string; bankCode: string } | null {
  const trimmed = account.trim();
  const match = trimmed.match(/^(\d[\d-]*)\/(\d{4})$/);
  if (!match) return null;
  return { accountNumber: match[1], bankCode: match[2] };
}

function buildFioXml(
  accountFrom: string,
  orders: {
    accountTo: string;
    bankCode: string;
    amount: number;
    vs: string;
    message: string;
    comment: string;
    date: string;
  }[]
): string {
  const orderXml = orders
    .map(
      (o) => `    <DomesticTransaction>
      <accountFrom>${escapeXml(accountFrom)}</accountFrom>
      <currency>CZK</currency>
      <amount>${o.amount.toFixed(2)}</amount>
      <accountTo>${escapeXml(o.accountTo)}</accountTo>
      <bankCode>${escapeXml(o.bankCode)}</bankCode>
      <vs>${escapeXml(o.vs)}</vs>
      <date>${escapeXml(o.date)}</date>
      <messageForRecipient>${escapeXml(o.message)}</messageForRecipient>
      <comment>${escapeXml(o.comment)}</comment>
      <paymentType>431001</paymentType>
    </DomesticTransaction>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Import xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.fio.cz/schema/importIB.xsd">
  <Orders>
${orderXml}
  </Orders>
</Import>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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
    const escrowIds: string[] = body.escrow_ids;

    if (!escrowIds || !Array.isArray(escrowIds) || escrowIds.length === 0) {
      return NextResponse.json({ error: "Chybí escrow_ids" }, { status: 400 });
    }

    const fioToken = process.env.FIO_API_TOKEN;
    if (!fioToken) {
      return NextResponse.json({ error: "Chybí FIO_API_TOKEN" }, { status: 500 });
    }

    const supabase = getServiceClient();
    const settings = await getEscrowSettings();

    const sourceAccount = settings.bank_account;
    const adminPayoutAccount = settings.admin_payout_account;

    if (!sourceAccount) {
      return NextResponse.json({ error: "Chybí nastavení bank_account (zdrojový účet) v escrow_settings" }, { status: 400 });
    }

    const sourceParsed = splitBankAccount(sourceAccount);
    if (!sourceParsed) {
      return NextResponse.json({ error: `Neplatný formát zdrojového účtu: ${sourceAccount}` }, { status: 400 });
    }

    // Fetch escrow transactions
    const { data: escrows, error: escrowError } = await supabase
      .from("escrow_transactions")
      .select("id, amount, commission_amount, seller_payout, seller_id, listing_id, payment_reference, status")
      .in("id", escrowIds)
      .in("status", ["completed", "auto_completed"]);

    if (escrowError) {
      return NextResponse.json({ error: "Chyba při načítání transakcí" }, { status: 500 });
    }

    if (!escrows || escrows.length === 0) {
      return NextResponse.json({ error: "Žádné transakce k vyplacení" }, { status: 400 });
    }

    // Fetch seller profiles
    const sellerIds = [...new Set(escrows.map((e) => e.seller_id))];
    const { data: sellers } = await supabase
      .from("profiles")
      .select("id, username, bank_account, bank_iban")
      .in("id", sellerIds);

    const sellerMap: Record<string, { username: string; bank_account: string | null }> = {};
    sellers?.forEach((s) => {
      sellerMap[s.id] = { username: s.username || s.id, bank_account: s.bank_account };
    });

    const today = new Date().toISOString().slice(0, 10);
    const orders: {
      accountTo: string;
      bankCode: string;
      amount: number;
      vs: string;
      message: string;
      comment: string;
      date: string;
    }[] = [];

    const results: {
      escrow_id: string;
      payment_reference: string;
      status: "ok" | "error";
      error?: string;
    }[] = [];

    for (const escrow of escrows) {
      const seller = sellerMap[escrow.seller_id];
      const vs = (escrow.payment_reference || "").replace(/\D/g, "");

      // Seller payout
      if (escrow.seller_payout > 0) {
        if (!seller?.bank_account) {
          results.push({
            escrow_id: escrow.id,
            payment_reference: escrow.payment_reference,
            status: "error",
            error: `Prodávající ${seller?.username || escrow.seller_id} nemá vyplněný bankovní účet`,
          });
          continue;
        }

        const sellerParsed = splitBankAccount(seller.bank_account);
        if (!sellerParsed) {
          results.push({
            escrow_id: escrow.id,
            payment_reference: escrow.payment_reference,
            status: "error",
            error: `Neplatný formát účtu prodávajícího: ${seller.bank_account}`,
          });
          continue;
        }

        orders.push({
          accountTo: sellerParsed.accountNumber,
          bankCode: sellerParsed.bankCode,
          amount: Number(escrow.seller_payout),
          vs,
          message: `Výplata z Lokopolis Bazar - ${escrow.payment_reference}`,
          comment: `Seller payout ${escrow.payment_reference}`,
          date: today,
        });
      }

      // Commission
      if (escrow.commission_amount > 0) {
        if (!adminPayoutAccount) {
          results.push({
            escrow_id: escrow.id,
            payment_reference: escrow.payment_reference,
            status: "error",
            error: "Chybí nastavení admin_payout_account (účet pro provize) v escrow_settings",
          });
          // Still process seller payout (already added above)
          continue;
        }

        const adminParsed = splitBankAccount(adminPayoutAccount);
        if (!adminParsed) {
          results.push({
            escrow_id: escrow.id,
            payment_reference: escrow.payment_reference,
            status: "error",
            error: `Neplatný formát účtu provizí: ${adminPayoutAccount}`,
          });
          continue;
        }

        orders.push({
          accountTo: adminParsed.accountNumber,
          bankCode: adminParsed.bankCode,
          amount: Number(escrow.commission_amount),
          vs,
          message: `Provize Lokopolis - ${escrow.payment_reference}`,
          comment: `Commission ${escrow.payment_reference}`,
          date: today,
        });
      }

      results.push({
        escrow_id: escrow.id,
        payment_reference: escrow.payment_reference,
        status: "ok",
      });
    }

    // If there are errors for ALL escrows, don't send anything
    const successEscrows = results.filter((r) => r.status === "ok");
    if (successEscrows.length === 0 || orders.length === 0) {
      return NextResponse.json({
        error: "Žádné platby k odeslání",
        results,
      }, { status: 400 });
    }

    // Build XML and send to FIO
    const xml = buildFioXml(sourceParsed.accountNumber, orders);

    const formData = new FormData();
    formData.append("token", fioToken.trim());
    formData.append("type", "xml");
    formData.append(
      "file",
      new Blob([xml], { type: "application/xml" }),
      "import.xml"
    );

    const fioRes = await fetch("https://fioapi.fio.cz/v1/rest/import/", {
      method: "POST",
      body: formData,
    });

    const fioText = await fioRes.text();

    if (!fioRes.ok) {
      return NextResponse.json({
        error: "FIO API vrátila chybu",
        fio_status: fioRes.status,
        fio_response: fioText.slice(0, 500),
        results,
      }, { status: 502 });
    }

    // Update escrow statuses to payout_sent
    const okIds = successEscrows.map((r) => r.escrow_id);
    if (okIds.length > 0) {
      await supabase
        .from("escrow_transactions")
        .update({ status: "payout_sent" })
        .in("id", okIds)
        .in("status", ["completed", "auto_completed"]);
    }

    return NextResponse.json({
      success: true,
      orders_count: orders.length,
      escrows_processed: successEscrows.length,
      results,
      fio_response: fioText.slice(0, 500),
    });
  } catch (error) {
    console.error("FIO payout error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
