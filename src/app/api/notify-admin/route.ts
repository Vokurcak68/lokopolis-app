import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { articleTitle, articleSlug, authorName } = await req.json();

    if (!articleTitle || !articleSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lokopolis-app.vercel.app";
    const adminUrl = `${siteUrl}/admin/clanky`;

    if (!serviceKey) {
      // No service key — just log
      console.log(`[NOTIFY] New article "${articleTitle}" by ${authorName} awaits approval. ${adminUrl}`);
      return NextResponse.json({ ok: true, sent: 0, reason: "no_service_key" });
    }

    // Find all admin profiles
    const profilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?role=eq.admin&select=id`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    const admins = await profilesRes.json();

    if (!Array.isArray(admins) || admins.length === 0) {
      console.log(`[NOTIFY] No admins found. Article "${articleTitle}" by ${authorName}.`);
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sentCount = 0;
    for (const admin of admins) {
      // Get admin email from auth
      const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${admin.id}`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });
      const userData = await userRes.json();
      const email = userData?.email;

      if (!email) continue;

      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const articleUrl = `${siteUrl}/clanky/${articleSlug}`;
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
              <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#f0a030;">📝 Nový článek ke schválení</h2>
                <p>Autor <strong>${authorName || "Neznámý"}</strong> publikoval nový článek:</p>
                <div style="background:#1a1c2e;border:1px solid #2a2f45;border-radius:8px;padding:16px;margin:16px 0;">
                  <h3 style="color:#fff;margin:0 0 8px;">${articleTitle}</h3>
                  <a href="${articleUrl}" style="color:#f0a030;text-decoration:none;font-size:14px;">Zobrazit článek →</a>
                </div>
                <a href="${adminUrl}" style="display:inline-block;background:#f0a030;color:#0f1117;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
                  Přejít do správy článků
                </a>
                <p style="color:#888;font-size:12px;margin-top:24px;">— Lokopolis.cz</p>
              </div>
            `,
          }),
        });
        if (res.ok) sentCount++;
      } else {
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
