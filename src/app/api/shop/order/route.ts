import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp, honeypotValid, minFillTimeValid, normalizeText, payloadDigest, rateLimit, replayGuard } from "@/lib/security";

// Lazy env check - only validate at runtime, not at build time
function getEnvConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error("Missing required SMTP env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    smtpHost,
    smtpPort: Number(smtpPort),
    smtpUser,
    smtpPass,
    smtpSecure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const config = getEnvConfig();

    const ip = getClientIp(req);
    const rl = rateLimit(`shop-order:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Příliš mnoho pokusů, zkus to za chvíli." }, { status: 429 });
    }

    const body = await req.json();
    const { productId, notes, turnstileToken, website, startedAt } = body;

    if (!honeypotValid(website)) {
      return NextResponse.json({ error: "Požadavek byl zablokován." }, { status: 400 });
    }

    if (!minFillTimeValid(startedAt, 2500)) {
      return NextResponse.json({ error: "Formulář byl odeslán příliš rychle." }, { status: 400 });
    }

    if (!turnstileToken) {
      return NextResponse.json({ error: "Chybí anti-bot ověření." }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Anti-bot ověření selhalo." }, { status: 403 });
    }

    if (!productId) {
      return NextResponse.json({ error: "Chybí productId" }, { status: 400 });
    }

    const safeNotes = normalizeText(notes || "", 1000) || null;

    const replayKey = `shop-order:${ip}:${payloadDigest({ productId, safeNotes })}`;
    if (!replayGuard(replayKey, 120000)) {
      return NextResponse.json({ error: "Duplicitní objednávka. Zkus to za chvíli znovu." }, { status: 409 });
    }

    // Get auth token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const userClient = createClient(config.supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get product
    const { data: product, error: productError } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", productId)
      .eq("status", "active")
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
    }

    // Check for existing pending order or purchase
    const { data: existingPurchase } = await supabase
      .from("user_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingPurchase) {
      return NextResponse.json({ error: "Tento produkt již vlastníte" }, { status: 400 });
    }

    // Generate order number
    const { data: orderNumData, error: orderNumError } = await supabase.rpc("generate_order_number");
    if (orderNumError || !orderNumData) {
      return NextResponse.json({ error: "Nepodařilo se vytvořit číslo objednávky" }, { status: 500 });
    }

    const orderNumber = orderNumData as string;
    const isFree = product.price === 0;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("shop_orders")
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        product_id: productId,
        price: product.price,
        status: isFree ? "paid" : "pending",
        payment_method: isFree ? "free" : "bank_transfer",
        notes: safeNotes,
        paid_at: isFree ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Nepodařilo se vytvořit objednávku" }, { status: 500 });
    }

    // If free, auto-create purchase
    if (isFree) {
      await supabase.from("user_purchases").insert({
        user_id: user.id,
        product_id: productId,
        order_id: order.id,
      });
    } else {
      // Send email notification for paid orders
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .single();

      const username = profile?.display_name || profile?.username || user.email || "Neznámý";

      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      try {
        await transporter.sendMail({
          from: '"Lokopolis Shop" <info@lokopolis.cz>',
          to: "info@lokopolis.cz",
          subject: `Nová objednávka ${orderNumber}`,
          text: `Nová objednávka ${orderNumber}\n\nProdukt: ${product.title}\nCena: ${product.price} Kč\nOd: ${username} (${user.email})\n${safeNotes ? `Poznámka: ${safeNotes}\n` : ""}\nPro potvrzení platby jděte do admin panelu: /admin/shop`,
          html: `
            <h2>Nová objednávka ${orderNumber}</h2>
            <p><strong>Produkt:</strong> ${String(product.title).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            <p><strong>Cena:</strong> ${product.price} Kč</p>
            <p><strong>Od:</strong> ${String(username).replace(/</g, "&lt;").replace(/>/g, "&gt;")} (${String(user.email || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")})</p>
            ${safeNotes ? `<p><strong>Poznámka:</strong> ${safeNotes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ""}
            <p><a href="https://lokopolis-app.vercel.app/admin/shop">Otevřít admin panel</a></p>
          `,
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
        // Don't fail the order if email fails
      }
    }

    return NextResponse.json({
      orderNumber,
      orderId: order.id,
      status: isFree ? "paid" : "pending",
    });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
