"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import { timeAgo } from "@/lib/timeAgo";
import MessageThread from "@/components/Bazar/MessageThread";
import type { BazarMessage } from "@/types/database";

interface Conversation {
  listingId: string;
  listingTitle: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export default function BazarMessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all messages for this user
      const { data: messages } = await supabase
        .from("bazar_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Group by listing_id + other_user_id
      const convMap = new Map<string, {
        listingId: string;
        otherUserId: string;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
      }>();

      for (const msg of messages as BazarMessage[]) {
        const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        const key = `${msg.listing_id}:${otherUserId}`;
        const existing = convMap.get(key);
        if (!existing) {
          convMap.set(key, {
            listingId: msg.listing_id,
            otherUserId,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: !msg.read && msg.recipient_id === user.id ? 1 : 0,
          });
        } else {
          if (!msg.read && msg.recipient_id === user.id) {
            existing.unreadCount++;
          }
        }
      }

      // Fetch listing titles and user profiles
      const listingIds = [...new Set([...convMap.values()].map((c) => c.listingId))];
      const userIds = [...new Set([...convMap.values()].map((c) => c.otherUserId))];

      const [{ data: listings }, { data: profiles }] = await Promise.all([
        supabase.from("listings").select("id, title").in("id", listingIds),
        supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", userIds),
      ]);

      const listingMap = new Map((listings || []).map((l: { id: string; title: string }) => [l.id, l.title]));
      const profileMap = new Map(
        (profiles || []).map((p: { id: string; display_name: string | null; username: string; avatar_url: string | null }) => [
          p.id,
          { name: p.display_name || p.username || "Anonym", avatar: p.avatar_url },
        ])
      );

      const convList: Conversation[] = [];
      for (const [, conv] of convMap) {
        const profile = profileMap.get(conv.otherUserId);
        convList.push({
          listingId: conv.listingId,
          listingTitle: listingMap.get(conv.listingId) || "Neznámý inzerát",
          otherUserId: conv.otherUserId,
          otherUserName: profile?.name || "Anonym",
          otherUserAvatar: profile?.avatar || null,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount,
        });
      }

      convList.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/prihlaseni");
      return;
    }
    if (user) fetchConversations();
  }, [user, authLoading, router, fetchConversations]);

  if (authLoading || !user) {
    return (
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--text-dimmer)" }}>⏳ Načítám...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Link
          href="/bazar"
          style={{ color: "var(--text-dimmer)", textDecoration: "none", fontSize: "13px" }}
        >
          ← Zpět na bazar
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
          <span style={{ color: "var(--text-primary)" }}>Moje </span>
          <span style={{ color: "var(--accent)" }}>zprávy</span>
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--text-dimmer)" }}>⏳ Načítám zprávy...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>💬</div>
          <p style={{ fontSize: "14px", color: "var(--text-dimmer)" }}>
            Zatím nemáte žádné zprávy
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedConv ? "300px 1fr" : "1fr",
            gap: "16px",
            minHeight: "500px",
          }}
          className="messages-grid"
        >
          {/* Conversation list */}
          <div
            style={{
              display: selectedConv ? undefined : "flex",
              flexDirection: "column",
              gap: "4px",
              overflowY: "auto",
              maxHeight: "600px",
            }}
            className={selectedConv ? "messages-list-panel" : ""}
          >
            {conversations.map((conv) => {
              const isSelected =
                selectedConv?.listingId === conv.listingId &&
                selectedConv?.otherUserId === conv.otherUserId;
              return (
                <button
                  key={`${conv.listingId}:${conv.otherUserId}`}
                  onClick={() => setSelectedConv(conv)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: isSelected ? "var(--accent-bg)" : "var(--bg-card)",
                    border: `1px solid ${isSelected ? "var(--accent-border)" : "var(--border)"}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--accent-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      flexShrink: 0,
                    }}
                  >
                    👤
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "2px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {conv.otherUserName}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--accent)",
                        marginBottom: "2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {conv.listingTitle}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-dimmer)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {conv.lastMessage}
                    </div>
                  </div>

                  {/* Unread badge */}
                  {conv.unreadCount > 0 && (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "var(--accent)",
                        color: "#000",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {conv.unreadCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Chat panel */}
          {selectedConv && (
            <div className="messages-chat-panel">
              <div style={{ marginBottom: "12px" }}>
                <Link
                  href={`/bazar/${selectedConv.listingId}`}
                  style={{
                    fontSize: "13px",
                    color: "var(--accent)",
                    textDecoration: "none",
                  }}
                >
                  🔗 {selectedConv.listingTitle}
                </Link>
                <button
                  onClick={() => setSelectedConv(null)}
                  className="messages-back-btn"
                  style={{
                    display: "none",
                    padding: "4px 10px",
                    fontSize: "12px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text-dimmer)",
                    cursor: "pointer",
                    marginLeft: "12px",
                  }}
                >
                  ← Zpět
                </button>
              </div>
              <MessageThread
                listingId={selectedConv.listingId}
                recipientId={selectedConv.otherUserId}
                recipientName={selectedConv.otherUserName}
              />
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .messages-grid {
            grid-template-columns: 1fr !important;
          }
          .messages-list-panel {
            ${selectedConv ? "display: none !important;" : ""}
          }
          .messages-back-btn {
            display: inline-block !important;
          }
        }
      `}</style>
    </div>
  );
}
