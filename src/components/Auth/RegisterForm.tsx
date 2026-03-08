"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function RegisterForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validace shody hesel
    if (password !== passwordConfirm) {
      setError("Hesla se neshodují");
      setLoading(false);
      return;
    }

    // Validace username
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      setError(
        "Uživatelské jméno musí mít 3–30 znaků a obsahovat pouze písmena, čísla, - nebo _"
      );
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        setError("Tento e-mail je již zaregistrován");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    onSuccess?.();
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-sm text-center">
        <div className="text-4xl">📧</div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Ověřte svůj e-mail</h2>
        <p className="text-text-muted">
          Na adresu <span className="text-primary">{email}</span> jsme odeslali
          ověřovací odkaz. Klikněte na něj pro dokončení registrace.
        </p>
        <Link
          href="/prihlaseni"
          className="text-primary hover:underline text-sm mt-2"
        >
          Zpět na přihlášení
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 w-full max-w-sm"
    >
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Registrace</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="reg-username" className="text-sm text-text-muted">
          Uživatelské jméno
        </label>
        <input
          id="reg-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          className="px-4 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-[var(--text-body)] placeholder:text-text-muted/50"
          placeholder="jan_modelar"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reg-email" className="text-sm text-text-muted">
          E-mail
        </label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-4 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-[var(--text-body)] placeholder:text-text-muted/50"
          placeholder="vas@email.cz"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reg-password" className="text-sm text-text-muted">
          Heslo
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="px-4 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-[var(--text-body)] placeholder:text-text-muted/50"
          placeholder="Minimálně 6 znaků"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reg-password-confirm" className="text-sm text-text-muted">
          Heslo znovu
        </label>
        <input
          id="reg-password-confirm"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          minLength={6}
          className="px-4 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-[var(--text-body)] placeholder:text-text-muted/50"
          placeholder="Zopakujte heslo"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 px-6 py-2.5 rounded-lg bg-primary text-bg-dark font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Registrace…" : "Vytvořit účet"}
      </button>

      <p className="text-sm text-text-muted text-center">
        Už máte účet?{" "}
        <Link href="/prihlaseni" className="text-primary hover:underline">
          Přihlaste se
        </Link>
      </p>
    </form>
  );
}
