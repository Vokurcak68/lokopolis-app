"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import Turnstile from "@/components/Turnstile";
import type { BazarMessage } from "@/types/database";

interface MessageThreadProps {
  listingId: string;
  recipientId: string;
  recipientName: string;
}

export default function MessageThread({
  listingId,
  recipientId,
  recipientName,
}: MessageThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BazarMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setLoading(true);

    const { data } = await supabase
      .from("bazar_messages")
      .select("*")
      .eq("listing_id", listingId)
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    if (data) {
      setMessages((prev) => {
        // Only update if there are new messages (avoid unnecessary re-renders)
        if (prev.length !== data.length || (data.length > 0 && prev[prev.length - 1]?.id !== data[data.length - 1]?.id)) {
          return data;
        }
        return prev;
      });
    }
    setLoading(false);

    // Mark unread as read
    await supabase
      .from("bazar_messages")
      .update({ read: true })
      .eq("listing_id", listingId)
      .eq("sender_id", recipientId)
      .eq("recipient_id", user.id)
      .eq("read", false);
  }, [user, listingId, recipientId]);

  // Initial fetch + polling every 5s for live chat feel
  useEffect(() => {
    if (!user) return;

    fetchMessages(true);

    const interval = setInterval(() => fetchMessages(false), 5000);
    return () => clearInterval(interval);
  }, [user, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!user || !newMessage.trim()) return;
    if (!turnstileToken) {
      alert("Potvrď anti-bot ověření.");
      return;
    }
    const content = newMessage.trim();
    setSending(true);
    setNewMessage("");

    // Optimistic: add message to local state immediately
    const optimisticMsg: BazarMessage = {
      id: crypto.randomUUID(),
      listing_id: listingId,
      sender_id: user.id,
      recipient_id: recipientId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Neplatná session. Přihlas se znovu.");
      }

      const res = await fetch("/api/bazar/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          listingId,
          senderId: user.id,
          recipientId,
          content,
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba při odesílání");
      setTurnstileToken(null);
      // Refresh to get the real message from DB
      fetchMessages(false);
    } catch (err) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setNewMessage(content);
      alert(err instanceof Error ? err.message : "Chyba při odesílání");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "32px", color: "var(--text-dimmer)" }}>
        ⏳ Načítám zprávy...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "400px",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-card)",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        📩 Konverzace s {recipientName}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-dimmer)",
              fontSize: "13px",
              padding: "32px",
            }}
          >
            Zatím žádné zprávy. Napište první!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  maxWidth: "75%",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: isMine
                      ? "12px 12px 4px 12px"
                      : "12px 12px 12px 4px",
                    background: isMine
                      ? "rgba(59,130,246,0.2)"
                      : "var(--bg-card)",
                    border: `1px solid ${
                      isMine ? "rgba(59,130,246,0.3)" : "var(--border)"
                    }`,
                    color: "var(--text-body)",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-faint)",
                    marginTop: "4px",
                    textAlign: isMine ? "right" : "left",
                  }}
                >
                  {timeAgo(msg.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div>
          <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Napište zprávu..."
          rows={1}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-input)",
            borderRadius: "8px",
            color: "var(--text-body)",
            fontSize: "14px",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !newMessage.trim() || !turnstileToken}
          style={{
            padding: "10px 20px",
            background:
              sending || !newMessage.trim() || !turnstileToken
                ? "var(--border-hover)"
                : "var(--accent)",
            color:
              sending || !newMessage.trim() || !turnstileToken
                ? "var(--text-dimmer)"
                : "var(--accent-text-on)",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor:
              sending || !newMessage.trim() || !turnstileToken ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "..." : "Odeslat"}
        </button>
        </div>
      </div>
    </div>
  );
}
