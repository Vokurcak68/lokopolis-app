"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchMessages() {
      const { data } = await supabase
        .from("bazar_messages")
        .select("*")
        .eq("listing_id", listingId)
        .or(
          `and(sender_id.eq.${user!.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user!.id})`
        )
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
      setLoading(false);

      // Mark unread as read
      await supabase
        .from("bazar_messages")
        .update({ read: true })
        .eq("listing_id", listingId)
        .eq("sender_id", recipientId)
        .eq("recipient_id", user!.id)
        .eq("read", false);
    }

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`bazar-msgs-${listingId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bazar_messages",
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const msg = payload.new as BazarMessage;
          if (
            (msg.sender_id === user!.id && msg.recipient_id === recipientId) ||
            (msg.sender_id === recipientId && msg.recipient_id === user!.id)
          ) {
            setMessages((prev) => [...prev, msg]);
            // Auto-mark received as read
            if (msg.sender_id === recipientId) {
              supabase
                .from("bazar_messages")
                .update({ read: true })
                .eq("id", msg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, listingId, recipientId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!user || !newMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("bazar_messages").insert({
        listing_id: listingId,
        sender_id: user.id,
        recipient_id: recipientId,
        content: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage("");
    } catch (err) {
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
          gap: "8px",
        }}
      >
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
          disabled={sending || !newMessage.trim()}
          style={{
            padding: "10px 20px",
            background:
              sending || !newMessage.trim()
                ? "var(--border-hover)"
                : "var(--accent)",
            color:
              sending || !newMessage.trim()
                ? "var(--text-dimmer)"
                : "var(--accent-text-on)",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor:
              sending || !newMessage.trim() ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "..." : "Odeslat"}
        </button>
      </div>
    </div>
  );
}
