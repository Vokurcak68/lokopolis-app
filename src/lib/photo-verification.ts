import type { SupabaseClient } from "@supabase/supabase-js";

interface VisionAnalysisResult {
  tracking_number: string | null;
  date: string | null;
  recipient_name: string | null;
  recipient_city: string | null;
  recipient_zip: string | null;
  carrier: string | null;
  is_legitimate_document: boolean;
  confidence: number;
  notes: string | null;
}

async function analyzeImage(imageUrl: string): Promise<VisionAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyzuj tento obrázek podacího lístku / potvrzení o odeslání zásilky.

Najdi a extrahuj:
1. Tracking číslo (podací číslo zásilky)
2. Datum podání/převzetí
3. Jméno příjemce (pokud viditelné)
4. Adresa příjemce — město a PSČ (pokud viditelné)
5. Název přepravce

Vrať POUZE validní JSON (bez markdown, bez code bloků):
{
  "tracking_number": "nalezené číslo nebo null",
  "date": "YYYY-MM-DD nebo null",
  "recipient_name": "jméno nebo null",
  "recipient_city": "město nebo null",
  "recipient_zip": "PSČ nebo null",
  "carrier": "název přepravce nebo null",
  "is_legitimate_document": true/false,
  "confidence": 0-100,
  "notes": "poznámky k dokumentu"
}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Parse JSON from response (strip markdown code blocks if present)
  const jsonStr = content.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();

  try {
    return JSON.parse(jsonStr) as VisionAnalysisResult;
  } catch {
    console.error("Failed to parse OpenAI response:", content);
    return {
      tracking_number: null,
      date: null,
      recipient_name: null,
      recipient_city: null,
      recipient_zip: null,
      carrier: null,
      is_legitimate_document: false,
      confidence: 0,
      notes: "Nepodařilo se zpracovat odpověď AI",
    };
  }
}

function normalizeString(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function trackingMatch(fromPhoto: string | null, fromTransaction: string | null): boolean {
  if (!fromPhoto || !fromTransaction) return false;
  const a = fromPhoto.replace(/\s/g, "").toLowerCase();
  const b = fromTransaction.replace(/\s/g, "").toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function dateAfterPayment(photoDate: string | null, paymentDate: string | null): boolean {
  if (!photoDate || !paymentDate) return false;
  try {
    const pd = new Date(photoDate);
    const pay = new Date(paymentDate);
    return pd >= pay;
  } catch {
    return false;
  }
}

function cityMatch(photoCity: string | null, transactionCity: string | null): boolean {
  if (!photoCity || !transactionCity) return false;
  const a = normalizeString(photoCity);
  const b = normalizeString(transactionCity);
  return a === b || a.includes(b) || b.includes(a);
}

function zipMatch(photoZip: string | null, transactionZip: string | null): boolean {
  if (!photoZip || !transactionZip) return false;
  const a = photoZip.replace(/\s/g, "");
  const b = transactionZip.replace(/\s/g, "");
  return a === b;
}

export interface PhotoVerificationOutput {
  verified_at: string;
  overall_score: number;
  results: {
    image_url: string;
    tracking_number: string | null;
    date: string | null;
    recipient_name: string | null;
    recipient_city: string | null;
    recipient_zip: string | null;
    carrier: string | null;
    is_legitimate_document: boolean;
    confidence: number;
    notes: string | null;
  }[];
  matching: {
    tracking_match: boolean;
    date_after_payment: boolean;
    city_match: boolean;
    zip_match: boolean;
  };
}

/**
 * Run photo verification for an escrow transaction.
 * Analyzes shipping proof photos using GPT-4o Vision and compares with transaction data.
 * Saves results to the database. If score < 40, puts transaction on hold.
 */
export async function runPhotoVerification(
  escrowId: string,
  supabase: SupabaseClient,
): Promise<PhotoVerificationOutput> {
  const { data: transaction, error: fetchError } = await supabase
    .from("escrow_transactions")
    .select("*")
    .eq("id", escrowId)
    .single();

  if (fetchError || !transaction) {
    throw new Error("Transakce nenalezena");
  }

  const proofUrls: string[] = transaction.shipping_proof_urls || [];
  if (proofUrls.length === 0) {
    throw new Error("Žádné fotky k ověření");
  }

  const deliveryAddress = transaction.delivery_address as {
    name?: string;
    street?: string;
    city?: string;
    zip?: string;
  } | null;

  // Analyze each photo
  const results: (VisionAnalysisResult & { image_url: string })[] = [];
  for (const url of proofUrls) {
    const result = await analyzeImage(url);
    results.push({ ...result, image_url: url });
  }

  // Calculate matching using best results across all photos
  const bestTracking = results.some(r => trackingMatch(r.tracking_number, transaction.tracking_number));
  const bestDate = results.some(r => dateAfterPayment(r.date, transaction.payment_date || transaction.paid_at));
  const bestCity = results.some(r => cityMatch(r.recipient_city, deliveryAddress?.city || null));
  const bestZip = results.some(r => zipMatch(r.recipient_zip, deliveryAddress?.zip || null));
  const bestLegitimate = results.some(r => r.is_legitimate_document);

  // Calculate score
  let score = 0;
  if (bestTracking) score += 40;
  if (bestDate) score += 20;
  if (bestCity) score += 15;
  if (bestZip) score += 10;
  if (bestLegitimate) score += 15;

  const verificationResult: PhotoVerificationOutput = {
    verified_at: new Date().toISOString(),
    overall_score: score,
    results: results.map(r => ({
      image_url: r.image_url,
      tracking_number: r.tracking_number,
      date: r.date,
      recipient_name: r.recipient_name,
      recipient_city: r.recipient_city,
      recipient_zip: r.recipient_zip,
      carrier: r.carrier,
      is_legitimate_document: r.is_legitimate_document,
      confidence: r.confidence,
      notes: r.notes,
    })),
    matching: {
      tracking_match: bestTracking,
      date_after_payment: bestDate,
      city_match: bestCity,
      zip_match: bestZip,
    },
  };

  // Save to database
  const updateData: Record<string, unknown> = {
    photo_verification: verificationResult,
  };

  // If score < 40, set hold
  if (score < 40) {
    updateData.hold_reason = "photo_verification_failed";
    updateData.status = "hold";
  }

  const { error: updateError } = await supabase
    .from("escrow_transactions")
    .update(updateData)
    .eq("id", escrowId);

  if (updateError) {
    console.error("Failed to save photo verification:", updateError);
    throw new Error("Nepodařilo se uložit výsledek");
  }

  return verificationResult;
}
