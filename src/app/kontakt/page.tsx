"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadedAt] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _ts: loadedAt, turnstileToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Nepodařilo se odeslat zprávu.");
        return;
      }

      setStatus("success");
      setForm({ name: "", email: "", subject: "", message: "", website: "" });
    } catch {
      setStatus("error");
      setErrorMsg("Nepodařilo se odeslat zprávu. Zkuste to znovu.");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-body)",
    marginBottom: "6px",
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        <span style={{ color: "var(--text-primary)" }}>Kontaktujte </span>
        <span style={{ color: "#f0a030" }}>nás</span>
      </h1>
      <p style={{ fontSize: "15px", color: "var(--text-body)", marginBottom: "40px" }}>
        Máte dotaz, nápad nebo připomínku? Napište nám a my se vám ozveme.
      </p>

      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        {/* Contact form */}
        <div
          style={{
            flex: "1 1 360px",
            maxWidth: "600px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "12px",
                  padding: "24px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
                <h3 style={{ fontSize: "18px", color: "#22c55e", marginBottom: "8px", fontWeight: 600 }}>
                  Zpráva odeslána!
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-body)" }}>
                  Děkujeme za vaši zprávu. Ozveme se vám co nejdříve.
                </p>
              </div>
              <button
                onClick={() => setStatus("idle")}
                style={{
                  padding: "10px 24px",
                  background: "var(--bg-primary, #f0a030)",
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
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

              {status === "error" && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                    color: "#ef4444",
                    fontSize: "14px",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Honeypot — invisible to humans, bots fill it */}
                <div style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Jméno <span style={{ color: "#ef4444" }}>*</span>
                  </label>
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
                  <label style={labelStyle}>
                    E-mail <span style={{ color: "#ef4444" }}>*</span>
                  </label>
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
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="O čem chcete psát? (nepovinné)"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Zpráva <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Vaše zpráva..."
                    style={{ ...inputStyle, resize: "vertical", minHeight: "120px" }}
                  />
                </div>
                <Turnstile
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                />
                <button
                  type="submit"
                  disabled={status === "loading" || !turnstileToken}
                  style={{
                    padding: "12px 24px",
                    background: (status === "loading" || !turnstileToken) ? "#b8861f" : "var(--bg-primary, #f0a030)",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: (status === "loading" || !turnstileToken) ? "not-allowed" : "pointer",
                    opacity: (status === "loading" || !turnstileToken) ? 0.5 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {status === "loading" ? "Odesílání..." : "Odeslat zprávu"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Info box */}
        <div style={{ flex: "1 1 240px", maxWidth: "300px" }}>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f0a030", marginBottom: "16px" }}>
              📬 Kontaktní údaje
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "20px" }}>📧</span>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-body)", opacity: 0.7 }}>E-mail</div>
                  <a
                    href="mailto:info@lokopolis.cz"
                    style={{ fontSize: "14px", color: "#f0a030", textDecoration: "none" }}
                  >
                    info@lokopolis.cz
                  </a>
                </div>
              </div>
              <div
                style={{
                  marginTop: "8px",
                  padding: "12px 16px",
                  background: "rgba(240, 160, 48, 0.08)",
                  borderRadius: "8px",
                  border: "1px solid rgba(240, 160, 48, 0.15)",
                }}
              >
                <p style={{ fontSize: "13px", color: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>
                  💡 Odpovíme co nejdříve — obvykle do 24 hodin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
