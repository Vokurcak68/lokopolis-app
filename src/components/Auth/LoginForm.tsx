"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Nesprávný e-mail nebo heslo"
          : authError.message
      );
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Přihlášení</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="login-email" className="text-sm text-text-muted">
          E-mail
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-4 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-[var(--text-body)] placeholder:text-text-muted/50"
          placeholder="vas@email.cz"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="login-password" className="text-sm text-text-muted">
          Heslo
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="px-4 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus:border-primary focus:outline-none text-[var(--text-body)] placeholder:text-text-muted/50"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 px-6 py-2.5 rounded-lg bg-primary text-bg-dark font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Přihlašování…" : "Přihlásit se"}
      </button>

      <p className="text-sm text-text-muted text-center">
        Nemáte účet?{" "}
        <Link href="/registrace" className="text-primary hover:underline">
          Zaregistrujte se
        </Link>
      </p>
    </form>
  );
}
