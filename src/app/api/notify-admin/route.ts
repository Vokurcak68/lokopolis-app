import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { articleTitle, articleSlug, authorName } = await req.json();

    if (!articleTitle || !articleSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Find all admin users
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (!admins || admins.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Get admin emails from auth.users
    let sentCount = 0;
    for (const admin of admins) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(admin.id);
      const email = userData?.user?.email;
      if (!email) continue;

      // Send email via Supabase Edge Function or SMTP
      // For now, use a simple approach: insert into a notifications table
      // OR use Supabase's built-in email via auth (hack)
      // Best approach: use a simple fetch to an email API

      // Use Resend (free tier, 100 emails/day) or just log for now
      // Let's try sending via Supabase's inbuilt admin email
      
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lokopolis-app.vercel.app";
      const adminUrl = `${siteUrl}/admin/clanky`;
      const articleUrl = `${siteUrl}/clanky/${articleSlug}`;

      // Try Resend if API key exists, otherwise skip
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Lokopolis <noreply@lokopolis.cz>",
            to: email,
            subject: `Nový článek čeká na schválení: ${articleTitle}`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f0a030;">📝 Nový článek ke schválení</h2>
                <p>Autor <strong>${authorName || "Neznámý"}</strong> publikoval nový článek:</p>
                <div style="background: #1a1c2e; border: 1px solid #2a2f45; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <h3 style="color: #fff; margin: 0 0 8px;">${articleTitle}</h3>
                  <a href="${articleUrl}" style="color: #f0a030; text-decoration: none; font-size: 14px;">Zobrazit článek →</a>
                </div>
                <a href="${adminUrl}" style="display: inline-block; background: #f0a030; color: #0f1117; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
                  Přejít do správy článků
                </a>
                <p style="color: #888; font-size: 12px; margin-top: 24px;">— Lokopolis.cz</p>
              </div>
            `,
          }),
        });
        if (res.ok) sentCount++;
      } else {
        // No email provider configured — log to console
        console.log(`[NOTIFY] Admin ${email}: New article "${articleTitle}" by ${authorName} awaits approval. ${adminUrl}`);
        sentCount++;
      }
    }

    return NextResponse.json({ ok: true, sent: sentCount });
  } catch (err) {
    console.error("Notify admin error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
