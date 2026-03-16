import { NextRequest, NextResponse } from "next/server";

// ARES API — public, no key needed
// https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}

export async function GET(req: NextRequest) {
  const ico = req.nextUrl.searchParams.get("ico")?.replace(/\s/g, "");

  if (!ico || !/^\d{7,8}$/.test(ico)) {
    return NextResponse.json({ error: "Neplatné IČO (7–8 číslic)" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Subjekt nenalezen" }, { status: 404 });
      }
      return NextResponse.json({ error: `ARES vrátil ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    // Extract relevant fields
    const sidlo = data.sidlo || {};
    const result = {
      ico: data.ico || ico,
      dic: data.dic || null,
      company: data.obchodniJmeno || null,
      street: [sidlo.nazevUlice, sidlo.cisloDomovni ? `${sidlo.cisloDomovni}${sidlo.cisloOrientacni ? "/" + sidlo.cisloOrientacni : ""}` : null]
        .filter(Boolean)
        .join(" ") || null,
      city: sidlo.nazevObce || null,
      zip: sidlo.psc ? String(sidlo.psc).replace(/(\d{3})(\d{2})/, "$1 $2") : null,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return NextResponse.json({ error: "ARES timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Chyba při dotazu na ARES" }, { status: 500 });
  }
}
