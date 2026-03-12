import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { listingId, senderId, recipientId, content } = await req.json();

    if (!listingId || !senderId || !recipientId || !content?.trim()) {
      return NextResponse.json({ error: "Chybí povinná pole." }, { status: 400 });
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
        content: content.trim(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert message error:", insertErr);
      return NextResponse.json({ error: "Nepodařilo se odeslat zprávu." }, { status: 500 });
    }

    // Fetch recipient's email + listing title for notification
    try {
      const [{ data: recipientAuth }, { data: listing }] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(recipientId),
        supabaseAdmin
          .from("listings")
          .select("id, title")
          .eq("id", listingId)
          .single(),
      ]);

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
