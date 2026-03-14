"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TabKey = "email" | "invoice" | "legal";

// ─── Default values ──────────────────────────────────────────────────────────

const EMAIL_DEFAULTS: Record<string, string> = {
  email_order_confirmation_intro: "Děkujeme za Vaši objednávku na Lokopolis.cz!",
  email_order_shipped_intro: "Vaše objednávka byla odeslána!",
  email_welcome_intro: "Vítejte v komunitě Lokopolis!",
  email_signature: "S pozdravem,\nTým Lokopolis.cz",
  email_footer: "Tento e-mail byl odeslán automaticky, neodpovídejte na něj.",
};

const INVOICE_DEFAULTS: Record<string, string> = {
  invoice_supplier_note: "Nejsme plátci DPH.",
  invoice_note: "",
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "32px 20px 80px",
};

const cardStyle: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  padding: "24px",
  marginBottom: "20px",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: "6px",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: "80px",
  padding: "10px 12px",
  background: "var(--bg-dark)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  fontSize: "14px",
  fontFamily: "inherit",
  resize: "vertical",
  outline: "none",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-dark)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
};

const btnPrimary: CSSProperties = {
  padding: "10px 24px",
  background: "var(--accent)",
  color: "#1a1a2e",
  border: "none",
  borderRadius: "8px",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  padding: "10px 24px",
  background: "transparent",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};

const tabBtnStyle = (active: boolean): CSSProperties => ({
  padding: "10px 20px",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "#1a1a2e" : "var(--text-muted)",
  border: active ? "none" : "1px solid var(--border)",
  borderRadius: "8px",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s",
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminSablonyPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("email");

  // All settings from DB
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  // Email fields
  const [emailConfirmIntro, setEmailConfirmIntro] = useState("");
  const [emailShippedIntro, setEmailShippedIntro] = useState("");
  const [emailWelcomeIntro, setEmailWelcomeIntro] = useState("");
  const [emailSignature, setEmailSignature] = useState("");
  const [emailFooter, setEmailFooter] = useState("");

  // Invoice fields
  const [invoiceSupplierNote, setInvoiceSupplierNote] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyIco, setCompanyIco] = useState("");
  const [companyDic, setCompanyDic] = useState("");
  const [companyStreet, setCompanyStreet] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyZip, setCompanyZip] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyBankAccount, setCompanyBankAccount] = useState("");

  // Legal fields
  const [pageGdpr, setPageGdpr] = useState("");
  const [pageVop, setPageVop] = useState("");

  // Preview modal
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // ─── Auth check ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/prihlaseni"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      setIsAdmin(true);
      setLoading(false);
    }
    checkAdmin();
  }, [router]);

  // ─── Load settings ──────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/settings");
      const data = await res.json();
      setSettings(data);

      // Email
      setEmailConfirmIntro(typeof data.email_order_confirmation_intro === "string" ? data.email_order_confirmation_intro : EMAIL_DEFAULTS.email_order_confirmation_intro);
      setEmailShippedIntro(typeof data.email_order_shipped_intro === "string" ? data.email_order_shipped_intro : EMAIL_DEFAULTS.email_order_shipped_intro);
      setEmailWelcomeIntro(typeof data.email_welcome_intro === "string" ? data.email_welcome_intro : EMAIL_DEFAULTS.email_welcome_intro);
      setEmailSignature(typeof data.email_signature === "string" ? data.email_signature : EMAIL_DEFAULTS.email_signature);
      setEmailFooter(typeof data.email_footer === "string" ? data.email_footer : EMAIL_DEFAULTS.email_footer);

      // Invoice
      setInvoiceSupplierNote(typeof data.invoice_supplier_note === "string" ? data.invoice_supplier_note : INVOICE_DEFAULTS.invoice_supplier_note);
      setInvoiceNote(typeof data.invoice_note === "string" ? data.invoice_note : INVOICE_DEFAULTS.invoice_note);

      // Company
      const c = data.company as Record<string, string> | undefined;
      setCompanyName(c?.name || "");
      setCompanyIco(c?.ico || "");
      setCompanyDic(c?.dic || "");
      setCompanyStreet(c?.street || "");
      setCompanyCity(c?.city || "");
      setCompanyZip(c?.zip || "");
      setCompanyEmail(c?.email || "");
      setCompanyPhone(c?.phone || "");
      setCompanyBankAccount(c?.bank_account || "");

      // Legal
      setPageGdpr(typeof data.page_gdpr === "string" ? data.page_gdpr : "");
      setPageVop(typeof data.page_vop === "string" ? data.page_vop : "");
    } catch {
      console.error("Failed to load settings");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadSettings();
  }, [isAdmin, loadSettings]);

  // ─── Save helpers ────────────────────────────────────────────────────────

  async function saveSettings(updates: Record<string, unknown>) {
    setSaving(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/shop/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg({ text: "Uloženo ✓", ok: true });
      // Reload settings to keep in sync
      await loadSettings();
    } catch {
      setMsg({ text: "Chyba při ukládání", ok: false });
    } finally {
      setSaving(false);
    }
  }

  function saveEmail() {
    saveSettings({
      email_order_confirmation_intro: emailConfirmIntro,
      email_order_shipped_intro: emailShippedIntro,
      email_welcome_intro: emailWelcomeIntro,
      email_signature: emailSignature,
      email_footer: emailFooter,
    });
  }

  function resetEmail() {
    setEmailConfirmIntro(EMAIL_DEFAULTS.email_order_confirmation_intro);
    setEmailShippedIntro(EMAIL_DEFAULTS.email_order_shipped_intro);
    setEmailWelcomeIntro(EMAIL_DEFAULTS.email_welcome_intro);
    setEmailSignature(EMAIL_DEFAULTS.email_signature);
    setEmailFooter(EMAIL_DEFAULTS.email_footer);
  }

  function saveInvoice() {
    saveSettings({
      invoice_supplier_note: invoiceSupplierNote,
      invoice_note: invoiceNote,
      company: {
        ...((settings.company || {}) as Record<string, unknown>),
        name: companyName,
        ico: companyIco,
        dic: companyDic,
        street: companyStreet,
        city: companyCity,
        zip: companyZip,
        email: companyEmail,
        phone: companyPhone,
        bank_account: companyBankAccount,
      },
    });
  }

  function saveLegal() {
    saveSettings({
      page_gdpr: pageGdpr || null,
      page_vop: pageVop || null,
    });
  }

  function resetLegalGdpr() {
    setPageGdpr("");
  }

  function resetLegalVop() {
    setPageVop("");
  }

  // ─── Preview helper ──────────────────────────────────────────────────────

  function showPreview(label: string, text: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;padding:32px;border-radius:12px;color:#e0e0e0;">
        <div style="text-align:center;padding-bottom:20px;border-bottom:2px solid #f0a030;margin-bottom:20px;">
          <span style="font-size:28px;font-weight:800;letter-spacing:3px;color:#f0a030;">LOKOPOLIS</span>
        </div>
        <h2 style="color:#f0a030;margin:0 0 16px;">${label}</h2>
        <p style="white-space:pre-wrap;color:#e0e0e0;line-height:1.6;">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2a4e;color:#999;font-size:13px;">
          ${emailSignature.replace(/\n/g, "<br>").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
        <div style="margin-top:20px;padding-top:12px;border-top:1px solid #2a2a4e;text-align:center;font-size:12px;color:#666;">
          <a href="https://lokopolis.cz" style="color:#f0a030;text-decoration:none;">lokopolis.cz</a>
          &nbsp;·&nbsp; info@lokopolis.cz
          <br>${emailFooter.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
      </div>`;
    setPreviewHtml(html);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading || !isAdmin) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>📝 Šablony</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>Editace emailů, faktur a právních stránek</p>
        </div>
        <Link href="/admin/shop" style={{ color: "var(--accent)", fontSize: "14px", textDecoration: "none" }}>
          ← Zpět do e-shopu
        </Link>
      </div>

      {/* Status message */}
      {msg && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "8px",
          marginBottom: "20px",
          background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          color: msg.ok ? "#22c55e" : "#ef4444",
          fontWeight: 600,
          fontSize: "14px",
        }}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button style={tabBtnStyle(activeTab === "email")} onClick={() => setActiveTab("email")}>📧 Emailové šablony</button>
        <button style={tabBtnStyle(activeTab === "invoice")} onClick={() => setActiveTab("invoice")}>📄 Faktura</button>
        <button style={tabBtnStyle(activeTab === "legal")} onClick={() => setActiveTab("legal")}>📋 Právní stránky</button>
      </div>

      {/* ─── Tab: Email ─────────────────────────────────────────────────── */}
      {activeTab === "email" && (
        <div>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={labelStyle}>Úvod potvrzení objednávky</label>
              <button style={{ ...btnSecondary, padding: "4px 12px", fontSize: "12px" }} onClick={() => showPreview("Potvrzení objednávky", emailConfirmIntro)}>📧 Náhled</button>
            </div>
            <textarea style={textareaStyle} value={emailConfirmIntro} onChange={(e) => setEmailConfirmIntro(e.target.value)} rows={2} />
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={labelStyle}>Úvod odeslání zásilky</label>
              <button style={{ ...btnSecondary, padding: "4px 12px", fontSize: "12px" }} onClick={() => showPreview("Odeslání zásilky", emailShippedIntro)}>📧 Náhled</button>
            </div>
            <textarea style={textareaStyle} value={emailShippedIntro} onChange={(e) => setEmailShippedIntro(e.target.value)} rows={2} />
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={labelStyle}>Úvod uvítacího emailu</label>
              <button style={{ ...btnSecondary, padding: "4px 12px", fontSize: "12px" }} onClick={() => showPreview("Uvítací email", emailWelcomeIntro)}>📧 Náhled</button>
            </div>
            <textarea style={textareaStyle} value={emailWelcomeIntro} onChange={(e) => setEmailWelcomeIntro(e.target.value)} rows={2} />
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Podpis emailu</label>
            <textarea style={textareaStyle} value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} rows={3} />
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "4px" }}>Zobrazí se na konci každého emailu. Podporuje \n pro nové řádky.</p>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Patička emailu</label>
            <textarea style={textareaStyle} value={emailFooter} onChange={(e) => setEmailFooter(e.target.value)} rows={2} />
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "4px" }}>Text v patičce pod každým emailem (nad odkazem na web).</p>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button style={btnSecondary} onClick={resetEmail}>Obnovit výchozí</button>
            <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={saveEmail} disabled={saving}>{saving ? "Ukládám..." : "Uložit"}</button>
          </div>
        </div>
      )}

      {/* ─── Tab: Invoice ───────────────────────────────────────────────── */}
      {activeTab === "invoice" && (
        <div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Údaje dodavatele</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Název firmy</label>
                <input style={inputStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Lokopolis.cz" />
              </div>
              <div>
                <label style={labelStyle}>IČO</label>
                <input style={inputStyle} value={companyIco} onChange={(e) => setCompanyIco(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>DIČ</label>
                <input style={inputStyle} value={companyDic} onChange={(e) => setCompanyDic(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Ulice</label>
                <input style={inputStyle} value={companyStreet} onChange={(e) => setCompanyStreet(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Město</label>
                <input style={inputStyle} value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>PSČ</label>
                <input style={inputStyle} value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input style={inputStyle} value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="info@lokopolis.cz" />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input style={inputStyle} value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Číslo účtu</label>
                <input style={inputStyle} value={companyBankAccount} onChange={(e) => setCompanyBankAccount(e.target.value)} placeholder="XXXX/XXXX" />
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Poznámka na faktuře</label>
            <textarea style={textareaStyle} value={invoiceNote} onChange={(e) => setInvoiceNote(e.target.value)} rows={2} placeholder="Volitelná poznámka zobrazená na faktuře" />
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Poznámka o DPH</label>
            <textarea style={textareaStyle} value={invoiceSupplierNote} onChange={(e) => setInvoiceSupplierNote(e.target.value)} rows={2} />
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "4px" }}>Zobrazí se v patičce faktury (výchozí: &quot;Nejsme plátci DPH.&quot;)</p>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={saveInvoice} disabled={saving}>{saving ? "Ukládám..." : "Uložit"}</button>
          </div>
        </div>
      )}

      {/* ─── Tab: Legal ─────────────────────────────────────────────────── */}
      {activeTab === "legal" && (
        <div>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Ochrana osobních údajů (GDPR)</h3>
              <button style={{ ...btnSecondary, padding: "4px 12px", fontSize: "12px" }} onClick={resetLegalGdpr}>Obnovit výchozí</button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginBottom: "8px" }}>
              Pokud je pole prázdné, zobrazí se výchozí text. Zadejte HTML kód pro vlastní obsah.
            </p>
            <textarea
              style={{ ...textareaStyle, minHeight: "300px", fontFamily: "monospace", fontSize: "13px" }}
              value={pageGdpr}
              onChange={(e) => setPageGdpr(e.target.value)}
              placeholder="Prázdné = výchozí text. Zadejte HTML pro vlastní obsah..."
            />
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Obchodní podmínky (VOP)</h3>
              <button style={{ ...btnSecondary, padding: "4px 12px", fontSize: "12px" }} onClick={resetLegalVop}>Obnovit výchozí</button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginBottom: "8px" }}>
              Pokud je pole prázdné, zobrazí se výchozí text. Zadejte HTML kód pro vlastní obsah.
            </p>
            <textarea
              style={{ ...textareaStyle, minHeight: "300px", fontFamily: "monospace", fontSize: "13px" }}
              value={pageVop}
              onChange={(e) => setPageVop(e.target.value)}
              placeholder="Prázdné = výchozí text. Zadejte HTML pro vlastní obsah..."
            />
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={saveLegal} disabled={saving}>{saving ? "Ukládám..." : "Uložit"}</button>
          </div>
        </div>
      )}

      {/* ─── Preview Modal ──────────────────────────────────────────────── */}
      {previewHtml && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setPreviewHtml(null)}
        >
          <div
            style={{
              maxWidth: "680px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              background: "#111122",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: "16px" }}>📧 Náhled emailu</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setPreviewHtml(null)}
              >
                ✕
              </button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
