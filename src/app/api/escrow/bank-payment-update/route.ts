import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, getServiceClient, isAdmin } from "@/lib/escrow-helpers";

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
    const { action, bank_payment_id, escrow_id, processing_status, error_message } = body;

    if (!bank_payment_id) {
      return NextResponse.json({ error: "Chybí bank_payment_id" }, { status: 400 });
    }

    const supabase = getServiceClient();

    if (action === "assign") {
      // Assign bank payment to an escrow transaction
      if (!escrow_id) {
        return NextResponse.json({ error: "Chybí escrow_id" }, { status: 400 });
      }

      // Verify the escrow transaction exists
      const { data: escrow, error: escrowErr } = await supabase
        .from("escrow_transactions")
        .select("id, status")
        .eq("id", escrow_id)
        .single();

      if (escrowErr || !escrow) {
        return NextResponse.json({ error: "Escrow transakce nenalezena" }, { status: 404 });
      }

      const { error: updateErr } = await supabase
        .from("escrow_bank_payments")
        .update({
          escrow_id,
          matched: true,
          processing_status: "paid",
        })
        .eq("id", bank_payment_id);

      if (updateErr) {
        return NextResponse.json({ error: "Nepodařilo se aktualizovat platbu" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "mark") {
      // Mark bank payment with a status
      if (!processing_status) {
        return NextResponse.json({ error: "Chybí processing_status" }, { status: 400 });
      }

      const allowed = ["unidentified", "duplicate", "other", "ignored"];
      if (!allowed.includes(processing_status)) {
        return NextResponse.json({ error: "Neplatný processing_status" }, { status: 400 });
      }

      const updateData: Record<string, unknown> = { processing_status };
      if (processing_status === "other" && error_message) {
        updateData.error_message = error_message;
      }

      const { error: updateErr } = await supabase
        .from("escrow_bank_payments")
        .update(updateData)
        .eq("id", bank_payment_id);

      if (updateErr) {
        return NextResponse.json({ error: "Nepodařilo se aktualizovat platbu" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Neplatná akce" }, { status: 400 });
  } catch (error) {
    console.error("Bank payment update error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
