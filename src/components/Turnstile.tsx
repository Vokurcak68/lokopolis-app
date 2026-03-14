"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const renderedRef = useRef(false);

  // Keep refs up to date without re-triggering render effect
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  const handleVerify = useCallback((token: string) => {
    onVerifyRef.current(token);
  }, []);

  const handleExpire = useCallback(() => {
    onExpireRef.current?.();
  }, []);

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }
    if (document.querySelector('script[src*="turnstile"]')) {
      // Script tag exists but not loaded yet — wait for it
      const check = setInterval(() => {
        if (window.turnstile) { setScriptLoaded(true); clearInterval(check); }
      }, 100);
      return () => clearInterval(check);
    }

    window.onTurnstileLoad = () => setScriptLoaded(true);

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      delete window.onTurnstileLoad;
    };
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return;
    if (renderedRef.current) return; // Already rendered — don't re-render

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: handleVerify,
      "expired-callback": handleExpire,
    });
    renderedRef.current = true;

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
        renderedRef.current = false;
      }
    };
  }, [scriptLoaded, handleVerify, handleExpire]);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <div style={{ marginTop: "8px", fontSize: "12px", color: "#ef4444" }}>
        Chybí konfigurace anti-bot ověření (NEXT_PUBLIC_TURNSTILE_SITE_KEY).
      </div>
    );
  }

  return <div ref={containerRef} style={{ marginTop: "8px" }} />;
}
