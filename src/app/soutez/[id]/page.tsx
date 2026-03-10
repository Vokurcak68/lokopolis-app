"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type {
  CompetitionEntry,
  Competition,
  Profile,
} from "@/types/database";

/* ============================================================
   HELPERS
   ============================================================ */

function optimizeImageUrl(url: string, width: number = 800): string {
  if (!url) return "";
  return url
    .replace("/object/public/", "/render/image/public/")
    .concat(`?width=${width}&quality=75`);
}

interface EntryWithAuthor extends CompetitionEntry {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
}

/* ============================================================
   LIGHTBOX
   ============================================================ */

function Lightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (idx: number) => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0)
        onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < images.length - 1)
        onNavigate(currentIndex + 1);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [currentIndex, images.length, onClose, onNavigate]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.92)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "#fff",
          fontSize: "28px",
          cursor: "pointer",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2001,
        }}
      >
        ✕
      </button>
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          style={{
            position: "absolute",
            left: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#fff",
            fontSize: "28px",
            cursor: "pointer",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2001,
          }}
        >
          ‹
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          style={{
            position: "absolute",
            right: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#fff",
            fontSize: "28px",
            cursor: "pointer",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2001,
          }}
        >
          ›
        </button>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Image
          src={optimizeImageUrl(images[currentIndex], 1200)}
          alt={`Foto ${currentIndex + 1}`}
          width={1200}
          height={800}
          style={{
            maxWidth: "90vw",
            maxHeight: "80vh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: "8px",
          }}
          sizes="90vw"
        />
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
          {currentIndex + 1} / {images.length}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   ENTRY DETAIL PAGE
   ============================================================ */

export default function EntryDetailPage() {
  const params = useParams();
  const entryId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [entry, setEntry] = useState<EntryWithAuthor | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mainImage, setMainImage] = useState(0);

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("competition_entries")
        .select(
          "*, author:profiles!competition_entries_user_id_fkey(id, username, display_name, avatar_url)"
        )
        .eq("id", entryId)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      const e = data as unknown as EntryWithAuthor;
      setEntry(e);

      // Load competition
      const { data: comp } = await supabase
        .from("competitions")
        .select("*")
        .eq("id", e.competition_id)
        .single();

      if (comp) setCompetition(comp as Competition);

      // Check if user already voted
      if (user) {
        const { data: voteData } = await supabase
          .from("competition_votes")
          .select("id")
          .eq("competition_id", e.competition_id)
          .eq("user_id", user.id)
          .maybeSingle();

        setHasVoted(!!voteData);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [entryId, user]);

  useEffect(() => {
    if (!authLoading) fetchEntry();
  }, [fetchEntry, authLoading]);

  async function handleVote() {
    if (!user || !entry || !competition) return;
    setVoting(true);

    const { error } = await supabase.from("competition_votes").insert({
      entry_id: entry.id,
      competition_id: entry.competition_id,
      user_id: user.id,
    });

    if (!error) {
      setHasVoted(true);
      setEntry((prev) =>
        prev ? { ...prev, vote_count: prev.vote_count + 1 } : prev
      );
    }
    setVoting(false);
  }

  async function handleUnvote() {
    if (!user || !entry) return;
    setVoting(true);

    const { error } = await supabase
      .from("competition_votes")
      .delete()
      .eq("competition_id", entry.competition_id)
      .eq("user_id", user.id);

    if (!error) {
      setHasVoted(false);
      setEntry((prev) =>
        prev ? { ...prev, vote_count: Math.max(0, prev.vote_count - 1) } : prev
      );
    }
    setVoting(false);
  }

  if (loading || authLoading) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
        <p style={{ color: "var(--text-dimmer)" }}>Načítám...</p>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>😕</div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Přihláška nenalezena
        </h1>
        <Link
          href="/soutez"
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "var(--accent-text-on)",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Zpět na soutěž
        </Link>
      </div>
    );
  }

  const authorName =
    entry.author?.display_name || entry.author?.username || "Anonym";
  const images = entry.images || [];
  const isOwnEntry = user && entry.author?.id === user.id;
  const canVote =
    competition &&
    (competition.status === "active" || competition.status === "voting") &&
    user &&
    !isOwnEntry &&
    !hasVoted;
  const showVoteSection =
    competition &&
    (competition.status === "active" || competition.status === "voting");

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Back link */}
      <Link
        href="/soutez"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--text-muted)",
          fontSize: "14px",
          textDecoration: "none",
          marginBottom: "24px",
        }}
      >
        ← Zpět na soutěž
      </Link>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "32px",
        }}
      >
        {/* Gallery */}
        {images.length > 0 && (
          <div>
            {/* Main image */}
            <div
              style={{
                width: "100%",
                height: "500px",
                position: "relative",
                overflow: "hidden",
                borderRadius: "16px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                marginBottom: "12px",
              }}
              onClick={() => setLightboxIndex(mainImage)}
            >
              <Image
                src={optimizeImageUrl(images[mainImage], 1200)}
                alt={entry.title}
                fill
                style={{ objectFit: "contain" }}
                sizes="(max-width: 1200px) 100vw, 1200px"
                priority
              />
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  overflowX: "auto",
                  padding: "4px 0",
                }}
              >
                {images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setMainImage(i)}
                    style={{
                      width: "80px",
                      height: "60px",
                      position: "relative",
                      flexShrink: 0,
                      borderRadius: "8px",
                      overflow: "hidden",
                      border:
                        i === mainImage
                          ? "2px solid var(--accent)"
                          : "2px solid var(--border)",
                      cursor: "pointer",
                      opacity: i === mainImage ? 1 : 0.7,
                      transition: "all 0.2s",
                    }}
                  >
                    <Image
                      src={optimizeImageUrl(img, 100)}
                      alt={`Foto ${i + 1}`}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="80px"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info section */}
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "16px",
            }}
          >
            {entry.title}
          </h1>

          {entry.description && (
            <p
              style={{
                fontSize: "15px",
                color: "var(--text-body)",
                lineHeight: 1.7,
                marginBottom: "20px",
                whiteSpace: "pre-wrap",
              }}
            >
              {entry.description}
            </p>
          )}

          {/* Badges */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            {entry.scale && (
              <span
                style={{
                  padding: "6px 14px",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                📐 {entry.scale}
              </span>
            )}
            {entry.dimensions && (
              <span
                style={{
                  padding: "6px 14px",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "var(--accent)",
                }}
              >
                📏 {entry.dimensions}
              </span>
            )}
            {entry.landscape && (
              <span
                style={{
                  padding: "6px 14px",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "var(--accent)",
                }}
              >
                🏔️ {entry.landscape}
              </span>
            )}
          </div>

          {/* Author */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              marginBottom: "24px",
            }}
          >
            {entry.author?.avatar_url ? (
              <Image
                src={entry.author.avatar_url}
                alt=""
                width={40}
                height={40}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--border-hover)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  color: "var(--text-muted)",
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {authorName}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>
                Autor přihlášky
              </div>
            </div>
            {entry.author?.username && (
              <Link
                href={`/profil/${entry.author.username}`}
                style={{
                  marginLeft: "auto",
                  fontSize: "13px",
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                Zobrazit profil →
              </Link>
            )}
          </div>

          {/* Vote section */}
          {showVoteSection && (
            <div
              style={{
                padding: "24px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginBottom: "12px",
                }}
              >
                ❤️ {entry.vote_count}{" "}
                {entry.vote_count === 1
                  ? "hlas"
                  : entry.vote_count >= 2 && entry.vote_count <= 4
                    ? "hlasy"
                    : "hlasů"}
              </div>

              {!user && (
                <Link
                  href="/prihlaseni"
                  style={{
                    display: "inline-block",
                    padding: "12px 32px",
                    background: "var(--border-hover)",
                    color: "var(--text-dim)",
                    borderRadius: "12px",
                    fontSize: "15px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Přihlaste se pro hlasování
                </Link>
              )}

              {isOwnEntry && (
                <div
                  style={{
                    padding: "12px 32px",
                    background: "var(--border)",
                    color: "var(--text-dimmer)",
                    borderRadius: "12px",
                    fontSize: "15px",
                    fontWeight: 500,
                    display: "inline-block",
                  }}
                >
                  Nemůžete hlasovat pro vlastní přihlášku
                </div>
              )}

              {canVote && (
                <button
                  onClick={handleVote}
                  disabled={voting}
                  style={{
                    padding: "14px 40px",
                    background: voting ? "var(--border-hover)" : "#22c55e",
                    color: voting ? "var(--text-dimmer)" : "#fff",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: voting ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {voting ? "Hlasuju..." : "👍 Hlasovat"}
                </button>
              )}

              {hasVoted && !isOwnEntry && user && (
                <div>
                  <div
                    style={{
                      padding: "14px 40px",
                      background: "rgba(34,197,94,0.1)",
                      color: "#22c55e",
                      borderRadius: "12px",
                      fontSize: "16px",
                      fontWeight: 700,
                      display: "inline-block",
                      marginBottom: "8px",
                    }}
                  >
                    ✅ Hlasováno
                  </div>
                  <div>
                    <button
                      onClick={handleUnvote}
                      disabled={voting}
                      style={{
                        padding: "6px 16px",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--text-dimmer)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Odebrat hlas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If finished, just show votes */}
          {competition && competition.status === "finished" && (
            <div
              style={{
                padding: "24px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginBottom: "8px",
                }}
              >
                ❤️ {entry.vote_count}{" "}
                {entry.vote_count === 1
                  ? "hlas"
                  : entry.vote_count >= 2 && entry.vote_count <= 4
                    ? "hlasy"
                    : "hlasů"}
              </div>
              {competition.winner_id === entry.id && (
                <div
                  style={{
                    fontSize: "18px",
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  🏆 Vítěz soutěže!
                </div>
              )}
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text-dimmer)",
                  marginTop: "4px",
                }}
              >
                Soutěž ukončena
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(idx) => setLightboxIndex(idx)}
        />
      )}
    </div>
  );
}
