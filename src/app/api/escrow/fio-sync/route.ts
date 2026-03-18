import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  getEscrowSettings,
  getServiceClient,
  isAdmin,
} from "@/lib/escrow-helpers";
import { sendEmail } from "@/lib/email";
import {
  escrowPaid,
  escrowPaidBuyer,
  escrowPartialPayment,
} from "@/lib/email-templates";

type FioTransaction = Record<string, unknown>;

type FioHttpAttempt = {
  url: string;
  status: number;
  bodyPreview: string;
};

type ParsedTx = {
  bankTxId: string;
  amount: number;
  currency: string | null;
  variableSymbol: string | null;
  paidAt: string | null;
  raw: FioTransaction;
};

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = asString(value);
  if (!s) return null;
  const normalized = s.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function extractColumns(tx: FioTransaction): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(tx)) {
    if (!rawValue || typeof rawValue !== "object") continue;
    const obj = rawValue as { value?: unknown; name?: unknown };

    const value = asString(obj.value);
    if (!value) continue;

    const keyNorm = normalizeText(key);
    out[keyNorm] = value;

    const name = asString(obj.name);
    if (name) {
      out[normalizeText(name)] = value;
    }
  }

  return out;
}

function pickFirst(columns: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const val = columns[normalizeText(key)];
    if (val) return val;
  }
  return null;
}

function parseFioDate(input: string | null): string | null {
  if (!input) return null;

  // Fio usually returns YYYY-MM-DD or ISO-like strings.
  const normalized = input.includes(".")
    ? input.split(" ")[0].split(".").reverse().join("-")
    : input;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseTx(tx: FioTransaction): ParsedTx | null {
  const columns = extractColumns(tx);

  const bankTxId =
    pickFirst(columns, ["id pohybu", "id transakce", "transaction id", "id", "column22"]) ||
    asString((tx as { id?: unknown }).id);

  const amount =
    asNumber(pickFirst(columns, ["objem", "castka", "amount", "column1"])) ??
    asNumber((tx as { amount?: unknown }).amount);

  const currency =
    pickFirst(columns, ["mena", "currency", "column14"]) ??
    asString((tx as { currency?: unknown }).currency);

  const variableSymbolRaw =
    pickFirst(columns, ["variabilni symbol", "variable symbol", "vs", "column5"]) ??
    asString((tx as { variableSymbol?: unknown; variable_symbol?: unknown }).variableSymbol) ??
    asString((tx as { variable_symbol?: unknown }).variable_symbol);

  const variableSymbol = variableSymbolRaw ? variableSymbolRaw.replace(/\D/g, "") : null;

  const paidAt = parseFioDate(
    pickFirst(columns, ["datum", "datum provedeni", "datum zauctovani", "date", "column0"]) ??
      asString((tx as { date?: unknown }).date)
  );

  if (!bankTxId || amount == null) return null;

  return {
    bankTxId,
    amount,
    currency,
    variableSymbol,
    paidAt,
    raw: tx,
  };
}

function getFioTransactions(payload: unknown): FioTransaction[] {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as {
    accountStatement?: {
      transactionList?: {
        transaction?: unknown;
      };
    };
  };

  const tx = root.accountStatement?.transactionList?.transaction;
  if (!tx) return [];
  if (Array.isArray(tx)) return tx.filter((x) => x && typeof x === "object") as FioTransaction[];
  if (typeof tx === "object") return [tx as FioTransaction];
  return [];
}

function safeJoinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

function maskTokenInUrl(url: string, rawToken: string): string {
  if (!rawToken) return url;
  const encoded = encodeURIComponent(rawToken);
  return url.replaceAll(rawToken, "***REDACTED***").replaceAll(encoded, "***REDACTED***");
}

function sanitizeFioToken(token: string): string {
  return token.trim().replace(/^['"]+|['"]+$/g, "").replace(/\s+/g, "");
}

async function fetchFioPayload(token: string, fromDate: string, toDate: string): Promise<{ payload: unknown; usedUrl: string }> {
  const cleanToken = sanitizeFioToken(token);
  if (!cleanToken) {
    throw new Error("FIO_API_TOKEN je prázdný");
  }

  const encodedToken = encodeURIComponent(cleanToken);

  const defaultBase = "https://fioapi.fio.cz/v1/rest";
  const envBase = process.env.FIO_API_BASE?.trim();
  const chosenBase = envBase || defaultBase;

  const isLikelyBadBase = /www\.fio\.cz\/ib_api\/rest/i.test(chosenBase);
  if (isLikelyBadBase) {
    throw new Error(
      `FIO_API_BASE je nastavené na webový endpoint (${chosenBase}), který vrací HTML. Nastav FIO_API_BASE na ${defaultBase} nebo env úplně smaž.`
    );
  }

  const base = chosenBase.replace(/\/+$/, "");
  const urls = [
    safeJoinUrl(base, `periods/${encodedToken}/${fromDate}/${toDate}/transactions.json`),
    safeJoinUrl(base, `last/${encodedToken}/transactions.json`),
  ];

  const attempts: FioHttpAttempt[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: {
          "User-Agent": "Lokopolis-Escrow-FIO-Sync",
        },
      });

      const location = response.headers.get("location");
      if (location && (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308)) {
        attempts.push({
          url,
          status: response.status,
          bodyPreview: `Redirect na ${location}`,
        });
        continue;
      }

      const bodyText = await response.text();
      const bodyPreview = bodyText.slice(0, 400);

      attempts.push({
        url,
        status: response.status,
        bodyPreview,
      });

      if (!response.ok) {
        continue;
      }

      let payload: unknown;
      try {
        payload = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        attempts.push({
          url,
          status: response.status,
          bodyPreview: `Neplatný JSON odpovědi: ${bodyPreview}`,
        });
        continue;
      }

      return { payload, usedUrl: maskTokenInUrl(url, cleanToken) };
    } catch (error) {
      attempts.push({
        url,
        status: 0,
        bodyPreview: error instanceof Error ? error.message : "Network error",
      });
    }
  }

  const best = attempts[attempts.length - 1] || { url: "", status: 0, bodyPreview: "Bez odpovědi" };

  throw new Error(
    `FIO API request failed | status=${best.status} | url=${maskTokenInUrl(best.url, cleanToken)} | body=${best.bodyPreview}`
  );
}

async function markPartialPaid(
  supabase: ReturnType<typeof getServiceClient>,
  escrow: {
    id: string;
    amount: number;
    buyer_id: string;
    listing_id: string;
    payment_reference: string;
    status: string;
  },
  cumulativePaid: number
) {
  await supabase
    .from("escrow_transactions")
    .update({
      status: "partial_paid",
      partial_amount: cumulativePaid,
    })
    .eq("id", escrow.id)
    .in("status", ["created", "partial_paid"]);

  // Notify buyer (same behavior as manual partial-payment route)
  const [buyerRes, listingRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", escrow.buyer_id).single(),
    supabase.from("listings").select("*").eq("id", escrow.listing_id).single(),
  ]);

  const buyer = buyerRes.data;
  const listing = listingRes.data;

  if (buyer?.email && listing) {
    try {
      const settings = await getEscrowSettings();
      const html = escrowPartialPayment(buyer, listing, escrow, cumulativePaid, settings);
      const missing = Number(escrow.amount) - cumulativePaid;
      await sendEmail(
        buyer.email,
        `⚠️ Neúplná platba — doplaťte ${missing.toLocaleString("cs-CZ")} Kč (${escrow.payment_reference})`,
        html
      );
    } catch (e) {
      console.error("Escrow email (fio partial-payment):", e);
    }
  }
}

async function markPaid(
  supabase: ReturnType<typeof getServiceClient>,
  escrow: {
    id: string;
    amount: number;
    seller_payout: number;
    seller_id: string;
    buyer_id: string;
    listing_id: string;
    payment_reference: string;
    status: string;
    partial_amount: number | null;
    admin_note: string | null;
  },
  overpaidBy: number
) {
  const note =
    overpaidBy > 0
      ? `${escrow.admin_note ? `${escrow.admin_note}\n` : ""}[FIO] Detekován přeplatek ${overpaidBy.toLocaleString("cs-CZ", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} Kč (${new Date().toISOString()}).`
      : escrow.admin_note;

  await supabase
    .from("escrow_transactions")
    .update({
      status: "paid",
      partial_amount: null,
      admin_note: note,
    })
    .eq("id", escrow.id)
    .in("status", ["created", "partial_paid"]);

  const settings = await getEscrowSettings();
  const shippingDays = Number(settings.shipping_deadline_days || 5);

  const [sellerRes, buyerRes, listingRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", escrow.seller_id).single(),
    supabase.from("profiles").select("*").eq("id", escrow.buyer_id).single(),
    supabase.from("listings").select("*").eq("id", escrow.listing_id).single(),
  ]);

  const seller = sellerRes.data;
  const buyer = buyerRes.data;
  const listing = listingRes.data;

  if (listing) {
    if (seller?.email) {
      try {
        const html = escrowPaid(seller, listing, escrow, shippingDays);
        await sendEmail(seller.email, `💰 Platba přijata — odešlete zboží (${escrow.payment_reference})`, html);
      } catch (e) {
        console.error("Escrow email (fio seller paid):", e);
      }
    }

    if (buyer?.email) {
      try {
        const html = escrowPaidBuyer(buyer, listing, escrow, shippingDays);
        await sendEmail(buyer.email, `✅ Platba připsána — ${escrow.payment_reference}`, html);
      } catch (e) {
        console.error("Escrow email (fio buyer paid):", e);
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    // Allow either cron-secret auth OR admin user auth for manual triggering.
    const viaCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!viaCron) {
      const user = await authenticateUser(req);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const admin = await isAdmin(user.id);
      if (!admin) {
        return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
      }
    }

    const fioToken = process.env.FIO_API_TOKEN;
    if (!fioToken) {
      return NextResponse.json({ error: "Chybí FIO_API_TOKEN" }, { status: 500 });
    }

    const lookbackDays = Number(process.env.FIO_SYNC_LOOKBACK_DAYS || 14);

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    let payload: unknown;
    let usedUrl = "";

    try {
      const fio = await fetchFioPayload(fioToken, fmt(from), fmt(to));
      payload = fio.payload;
      usedUrl = fio.usedUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "FIO API request failed";
      return NextResponse.json(
        {
          error: "FIO API request failed",
          detail: message,
        },
        { status: 502 }
      );
    }

    const transactions = getFioTransactions(payload);

    const supabase = getServiceClient();
    const tolerance = Number(process.env.ESCROW_PAYMENT_TOLERANCE || 0);

    const { data: openEscrows } = await supabase
      .from("escrow_transactions")
      .select("id, amount, partial_amount, status, payment_reference, seller_payout, seller_id, buyer_id, listing_id, admin_note")
      .in("status", ["created", "partial_paid"])
      .limit(500);

    const stats = {
      fetched: transactions.length,
      parsed: 0,
      newRows: 0,
      duplicates: 0,
      unmatched: 0,
      partial: 0,
      paid: 0,
      overpaid: 0,
      ignoredOutgoing: 0,
      errors: 0,
    };

    for (const rawTx of transactions) {
      try {
        const parsed = parseTx(rawTx);
        if (!parsed) {
          stats.errors += 1;
          continue;
        }

        stats.parsed += 1;

        // Process only incoming payments.
        if (parsed.amount <= 0) {
          stats.ignoredOutgoing += 1;
          continue;
        }

        const insertPayload = {
          bank_tx_id: parsed.bankTxId,
          payment_reference: null,
          variable_symbol: parsed.variableSymbol,
          amount: parsed.amount,
          currency: parsed.currency,
          paid_at: parsed.paidAt,
          raw: parsed.raw,
          matched: false,
          processing_status: "new",
        };

        const { data: inserted, error: insertError } = await supabase
          .from("escrow_bank_payments")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError) {
          // Duplicate tx id = already processed (idempotence)
          if (String(insertError.message).toLowerCase().includes("duplicate") || String(insertError.message).includes("unique")) {
            stats.duplicates += 1;
            continue;
          }
          console.error("FIO insert error:", insertError);
          stats.errors += 1;
          continue;
        }

        stats.newRows += 1;

        const txRowId = inserted.id as string;

        if (!parsed.variableSymbol) {
          await supabase
            .from("escrow_bank_payments")
            .update({
              processing_status: "ignored",
              error_message: "Chybí variabilní symbol",
              processed_at: new Date().toISOString(),
            })
            .eq("id", txRowId);
          stats.unmatched += 1;
          continue;
        }

        const matches = (openEscrows || []).filter((e) =>
          String(e.payment_reference || "").replace(/\D/g, "") === parsed.variableSymbol
        );

        if (matches.length !== 1) {
          await supabase
            .from("escrow_bank_payments")
            .update({
              processing_status: "ignored",
              error_message:
                matches.length === 0
                  ? `Nenalezena escrow transakce pro VS ${parsed.variableSymbol}`
                  : `Více escrow transakcí pro VS ${parsed.variableSymbol}`,
              processed_at: new Date().toISOString(),
            })
            .eq("id", txRowId);
          stats.unmatched += 1;
          continue;
        }

        const escrow = matches[0];

        await supabase
          .from("escrow_bank_payments")
          .update({
            escrow_id: escrow.id,
            payment_reference: escrow.payment_reference,
            matched: true,
          })
          .eq("id", txRowId);

        const { data: paidRows } = await supabase
          .from("escrow_bank_payments")
          .select("amount")
          .eq("escrow_id", escrow.id)
          .eq("matched", true);

        const bankCumulativePaid = Number(
          (paidRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2)
        );

        // Fallback for legacy/manual partials where older incoming payments
        // may not exist in escrow_bank_payments yet.
        const escrowPartialKnown = Number(escrow.partial_amount || 0);
        const cumulativePaid = Number(
          Math.max(bankCumulativePaid, escrowPartialKnown + Number(parsed.amount)).toFixed(2)
        );

        const expectedAmount = Number(escrow.amount);
        const diff = Number((cumulativePaid - expectedAmount).toFixed(2));

        if (cumulativePaid + tolerance < expectedAmount) {
          await markPartialPaid(supabase, escrow, cumulativePaid);

          await supabase
            .from("escrow_bank_payments")
            .update({
              processing_status: "partial",
              processed_at: new Date().toISOString(),
            })
            .eq("id", txRowId);

          stats.partial += 1;
          continue;
        }

        const overpaidBy = diff > tolerance ? diff : 0;
        await markPaid(supabase, escrow, overpaidBy);

        await supabase
          .from("escrow_bank_payments")
          .update({
            processing_status: overpaidBy > 0 ? "overpaid" : "paid",
            processed_at: new Date().toISOString(),
          })
          .eq("id", txRowId);

        if (overpaidBy > 0) {
          stats.overpaid += 1;
        } else {
          stats.paid += 1;
        }
      } catch (txErr) {
        console.error("FIO tx processing error:", txErr);
        stats.errors += 1;
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      range: {
        from: fmt(from),
        to: fmt(to),
      },
      debug: {
        usedUrl,
      },
    });
  } catch (error) {
    console.error("FIO sync error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
