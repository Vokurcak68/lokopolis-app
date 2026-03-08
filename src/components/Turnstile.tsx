"use client";

import { useEffect, useRef, useState } from "react";

// Site key hardcoded (same pattern as other credentials in this project)
const TURNSTILE_SITE_KEY = "0x4AAAAAACoE4_gtCgNEZDLm";

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
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (document.querySelector('script[src*="turnstile"]')) {
      if (window.turnstile) setScriptLoaded(true);
      return;
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
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return;

    // Remove old widget if re-rendering
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: (token: string) => onVerify(token),
      "expired-callback": () => onExpire?.(),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, onVerify, onExpire]);

  return <div ref={containerRef} style={{ marginTop: "8px" }} />;
}
