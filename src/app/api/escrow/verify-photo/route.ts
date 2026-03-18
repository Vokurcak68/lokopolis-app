import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";
import { runPhotoVerification } from "@/lib/photo-verification";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const body = await req.json();
    const { escrowId } = body;
    if (!escrowId) {
      return NextResponse.json({ error: "Chybí escrowId" }, { status: 400 });
    }

    // Only admin can trigger photo verification
    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const supabase = getServiceClient();
    const verification = await runPhotoVerification(escrowId, supabase);

    return NextResponse.json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error("Photo verification error:", error);
    const message = error instanceof Error ? error.message : "Interní chyba serveru";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
