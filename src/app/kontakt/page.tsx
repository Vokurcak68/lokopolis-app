"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "#1e2233",
    border: "1px solid #2a2f45",
    borderRadius: "8px",
    color: "#e0e0e0",
    fontSize: "14px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#a0a4b8",
    marginBottom: "6px",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        <span style={{ color: "#fff" }}>Kontaktujte </span>
        <span style={{ color: "#f0a030" }}>nás</span>
      </h1>
      <p style={{ fontSize: "15px", color: "#8a8ea0", marginBottom: "40px" }}>
        Máte dotaz, nápad nebo připomínku? Napište nám.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "32px" }}>
        {/* Contact info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              background: "#1a1e2e",
              border: "1px solid #252838",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
              📬 Jak nás zastihnout
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "20px" }}>📧</span>
                <div>
                  <div style={{ fontSize: "12px", color: "#6a6e80" }}>E-mail</div>
                  <div style={{ fontSize: "14px", color: "#e0e0e0" }}>info@lokopolis.cz</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "20px" }}>💬</span>
                <div>
                  <div style={{ fontSize: "12px", color: "#6a6e80" }}>Fórum</div>
                  <Link href="/forum" style={{ fontSize: "14px", color: "#f0a030", textDecoration: "none" }}>
                    Diskuzní fórum Lokopolis
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#1a1e2e",
              border: "1px solid #252838",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
              ❓ Časté dotazy
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { q: "Jak se registruji?", a: "Klikněte na Registrace v pravém horním rohu." },
                { q: "Jak napíšu článek?", a: "Po přihlášení klikněte na Napsat článek. Článek projde schválením." },
                { q: "Můžu nahrávat obrázky?", a: "Ano, v editoru článků i v galerii (po přihlášení)." },
                { q: "Našel jsem chybu. Co mám dělat?", a: "Napište nám přes formulář nebo do fóra." },
              ].map((faq) => (
                <div key={faq.q}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#e0e0e0", marginBottom: "2px" }}>{faq.q}</div>
                  <div style={{ fontSize: "13px", color: "#8a8ea0", lineHeight: 1.5 }}>{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div
          style={{
            background: "#1a1e2e",
            border: "1px solid #252838",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          {submitted ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <h3 style={{ fontSize: "18px", color: "#fff", marginBottom: "8px" }}>Děkujeme za zprávu!</h3>
              <p style={{ fontSize: "14px", color: "#8a8ea0", marginBottom: "20px" }}>
                Ozveme se vám co nejdříve.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                style={{
                  padding: "10px 20px",
                  background: "rgba(240,160,48,0.15)",
                  color: "#f0a030",
                  border: "1px solid rgba(240,160,48,0.3)",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Poslat další zprávu
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f0a030", marginBottom: "20px" }}>
                ✉️ Napište nám
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Jméno</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Vaše jméno"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="vas@email.cz"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Předmět</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="O čem chcete psát?"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Zpráva</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Vaše zpráva..."
                    style={{ ...inputStyle, resize: "vertical", minHeight: "120px" }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: "12px 24px",
                    background: "#f0a030",
                    color: "#0f1117",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Odeslat zprávu
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
