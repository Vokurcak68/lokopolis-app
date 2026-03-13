import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp, normalizeText, rateLimit } from "@/lib/security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`bazar-message:${ip}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Příliš mnoho zpráv, zkus to za chvíli." }, { status: 429 });
    }

    const body = await req.json();
    const listingId = body?.listingId as string;
    const senderId = body?.senderId as string;
    const recipientId = body?.recipientId as string;
    const turnstileToken = body?.turnstileToken as string;
    const content = normalizeText(body?.content || "", 2000);

    if (!listingId || !senderId || !recipientId || !content) {
      return NextResponse.json({ error: "Chybí povinná pole." }, { status: 400 });
    }

    if (!turnstileToken) {
      return NextResponse.json({ error: "Chybí anti-bot ověření." }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Anti-bot ověření selhalo." }, { status: 403 });
    }
    if (senderId === recipientId) {
      return NextResponse.json({ error: "Nemůžeš poslat zprávu sám sobě." }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    if (!token) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser(token);

    if (!user || user.id !== senderId) {
      return NextResponse.json({ error: "Neplatný odesílatel." }, { status: 403 });
    }

    // Verify listing and recipient relationship
    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("id, title, seller_id")
      .eq("id", listingId)
      .single();

    if (!listing) {
      return NextResponse.json({ error: "Inzerát nenalezen." }, { status: 404 });
    }

    if (recipientId !== listing.seller_id && senderId !== listing.seller_id) {
      return NextResponse.json({ error: "Neplatný příjemce." }, { status: 403 });
    }

    // Verify sender exists
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username")
      .eq("id", senderId)
      .single();

    if (!senderProfile) {
      return NextResponse.json({ error: "Neplatný odesílatel." }, { status: 403 });
    }

    // Insert message via service role (bypasses RLS)
    const { data: msg, error: insertErr } = await supabaseAdmin
      .from("bazar_messages")
      .insert({
        listing_id: listingId,
        sender_id: senderId,
        recipient_id: recipientId,
        content,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert message error:", insertErr);
      return NextResponse.json({ error: "Nepodařilo se odeslat zprávu." }, { status: 500 });
    }

    // Fetch recipient's email for notification
    try {
      const { data: recipientAuth } = await supabaseAdmin.auth.admin.getUserById(recipientId);

      const recipientEmail = recipientAuth?.user?.email;
      const listingTitle = listing?.title || "Inzerát";
      const senderName = senderProfile.display_name || senderProfile.username || "Uživatel";
      const listingUrl = `https://www.lokopolis.cz/bazar/${listingId}`;
      const messagesUrl = `https://www.lokopolis.cz/bazar/zpravy`;

      if (recipientEmail) {
        const sanitizedContent = content
          .trim()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br />");

        await sendEmail({
          to: recipientEmail,
          subject: `[Lokopolis] Nová zpráva k inzerátu „${listingTitle}"`,
          text: `${senderName} vám napsal/a zprávu k inzerátu „${listingTitle}":\n\n${content.trim()}\n\nOdpovězte na: ${listingUrl}\nVšechny zprávy: ${messagesUrl}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
              <div style="background: #0f1117; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h2 style="color: #f0a030; margin: 0; font-size: 20px;">📩 Nová zpráva v bazaru</h2>
              </div>
              <div style="background: #1a1d2e; padding: 24px; border: 1px solid #252838; border-top: none;">
                <p style="color: #e0e0e0; margin: 0 0 8px;">
                  <strong style="color: #f0a030;">${senderName}</strong> vám napsal/a zprávu k inzerátu:
                </p>
                <p style="margin: 0 0 16px;">
                  <a href="${listingUrl}" style="color: #f0a030; text-decoration: none; font-weight: 600;">
                    🏷️ ${listingTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                  </a>
                </p>
                <div style="background: #252838; border-radius: 8px; padding: 16px; margin: 0 0 20px; border-left: 3px solid #f0a030;">
                  <p style="color: #e0e0e0; margin: 0; line-height: 1.6; font-size: 14px;">
                    ${sanitizedContent}
                  </p>
                </div>
                <a href="${listingUrl}" style="display: inline-block; background: #f0a030; color: #000; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Odpovědět
                </a>
                <a href="${messagesUrl}" style="display: inline-block; color: #888; padding: 10px 16px; text-decoration: none; font-size: 13px; margin-left: 8px;">
                  Všechny zprávy →
                </a>
              </div>
              <div style="background: #0f1117; padding: 16px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #252838; border-top: none;">
                <p style="color: #666; margin: 0; font-size: 12px;">
                  Tento email byl odeslán z <a href="https://www.lokopolis.cz" style="color: #f0a030; text-decoration: none;">Lokopolis.cz</a>
                </p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      // Email notification is best-effort — don't fail the message send
      console.error("Email notification error:", emailErr);
    }

    return NextResponse.json({ ok: true, message: msg });
  } catch (error) {
    console.error("Bazar message API error:", error);
    return NextResponse.json({ error: "Interní chyba serveru." }, { status: 500 });
  }
}
