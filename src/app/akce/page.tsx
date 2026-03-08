"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/Auth/AuthProvider";
import type { Event, EventAccess } from "@/types/database";

/* ============================================================
   HELPERS
   ============================================================ */

const CZECH_MONTHS = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

const CZECH_MONTHS_NOMINATIVE = [
  "leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
];

function formatCzechDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = CZECH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}. ${month} ${year}`;
}

function formatCzechDateRange(startStr: string, endStr: string | null): string {
  if (!endStr || endStr === startStr) return formatCzechDate(startStr);
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startDay}.–${endDay}. ${CZECH_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${formatCzechDate(startStr)} – ${formatCzechDate(endStr)}`;
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  return `${parts[0]}:${parts[1]}`;
}

function isUpcoming(event: Event): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = event.end_date || event.event_date;
  const eventEnd = new Date(endDate + "T23:59:59");
  return eventEnd >= today;
}

type FilterType = "upcoming" | "past" | "all";

const FILTERS: { value: FilterType; label: string; icon: string }[] = [
  { value: "upcoming", label: "Nadcházející", icon: "📅" },
  { value: "past", label: "Proběhlé", icon: "📋" },
  { value: "all", label: "Vše", icon: "🗓️" },
];

/* ============================================================
   EVENT CARD
   ============================================================ */

function EventCard({
  event,
  isPast,
  isAdmin,
  isAuthenticated,
  onDelete,
}: {
  event: Event;
  isPast: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const needsAuth = event.access === "authenticated" && !isAuthenticated;

  const d = new Date(event.event_date + "T00:00:00");
  const dayNum = d.getDate();
  const monthName = CZECH_MONTHS_NOMINATIVE[d.getMonth()].substring(0, 3).toUpperCase();

  const description = event.description || "";
  const isLong = description.length > 200;
  const displayDesc = expanded ? description : description.substring(0, 200);

  return (
    <div
      ref={cardRef}
      style={{
        background: needsAuth ? "var(--bg-card)" : "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        overflow: "hidden",
        transition: "all 0.2s",
        borderBottom: isPast ? "3px solid var(--border-hover)" : "3px solid var(--accent)",
        position: "relative",
        opacity: isPast ? 0.6 : 1,
        filter: needsAuth ? "none" : "none",
      }}
      onMouseEnter={() => {
        if (cardRef.current) {
          cardRef.current.style.transform = "translateY(-3px)";
          cardRef.current.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
          cardRef.current.style.borderColor = "var(--border-hover)";
          if (!isPast) cardRef.current.style.opacity = "1";
          else cardRef.current.style.opacity = "0.8";
        }
      }}
      onMouseLeave={() => {
        if (cardRef.current) {
          cardRef.current.style.transform = "translateY(0)";
          cardRef.current.style.boxShadow = "none";
          cardRef.current.style.borderColor = "var(--border)";
          cardRef.current.style.opacity = isPast ? "0.6" : "1";
        }
      }}
    >
      {/* Cover image */}
      {event.cover_image_url && (
        <div
          style={{
            width: "100%",
            height: "180px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {needsAuth ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
              }}
            >
              <Image
                src={event.cover_image_url}
                alt=""
                fill
                style={{
                  objectFit: "cover",
                  filter: "blur(20px) brightness(0.4)",
                }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          ) : (
            <Image
              src={event.cover_image_url}
              alt={event.title}
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}
        </div>
      )}

      {/* Access badge */}
      {event.access === "authenticated" && (
        <div
          style={{
            position: "absolute",
            top: event.cover_image_url ? "12px" : "12px",
            right: "12px",
            background: "var(--accent-border)",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--accent)",
            fontWeight: 500,
            zIndex: 5,
          }}
        >
          🔒 Pro přihlášené
        </div>
      )}

      {/* Card content */}
      <div style={{ display: "flex", gap: "16px", padding: "20px" }}>
        {/* Date badge (calendar-like) */}
        <div
          style={{
            minWidth: "60px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: isPast ? "var(--border)" : "var(--accent)",
              color: isPast ? "var(--text-dimmer)" : "var(--accent-text-on)",
              borderRadius: "10px 10px 0 0",
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {monthName}
          </div>
          <div
            style={{
              background: isPast ? "var(--bg-input)" : "var(--accent-bg)",
              border: `1px solid ${isPast ? "var(--border)" : "var(--accent-border-strong)"}`,
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              padding: "8px",
              fontSize: "28px",
              fontWeight: 800,
              color: isPast ? "var(--text-dimmer)" : "var(--accent)",
              lineHeight: 1,
            }}
          >
            {dayNum}
          </div>
        </div>

        {/* Event info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {needsAuth ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔒</div>
              <a
                href="/prihlaseni"
                style={{
                  color: "var(--accent)",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Přihlaste se pro zobrazení
              </a>
            </div>
          ) : (
            <>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                  lineHeight: 1.3,
                }}
              >
                {event.title}
              </h3>

              {/* Meta info */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "10px",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                }}
              >
                <span>📅 {formatCzechDateRange(event.event_date, event.end_date)}</span>
                {event.event_time && <span>🕐 {formatTime(event.event_time)}</span>}
                {event.location && <span>📍 {event.location}</span>}
              </div>

              {/* Description */}
              {description && (
                <div style={{ marginBottom: "10px" }}>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--text-dim)",
                      lineHeight: 1.6,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {displayDesc}
                    {isLong && !expanded && "…"}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: "13px",
                        cursor: "pointer",
                        padding: "4px 0",
                        fontWeight: 500,
                      }}
                    >
                      {expanded ? "zobrazit méně" : "zobrazit více"}
                    </button>
                  )}
                </div>
              )}

              {/* Link */}
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "var(--accent)",
                    fontSize: "13px",
                    fontWeight: 500,
                    textDecoration: "none",
                    padding: "6px 12px",
                    background: "var(--accent-bg)",
                    borderRadius: "8px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--accent-border)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--accent-bg)")
                  }
                >
                  🔗 Web akce
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Admin delete button */}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: "absolute",
            bottom: "12px",
            right: "12px",
            padding: "6px 10px",
            background: "var(--danger-bg)",
            border: "1px solid rgba(220,53,69,0.3)",
            borderRadius: "8px",
            color: "var(--danger)",
            fontSize: "14px",
            cursor: "pointer",
            transition: "background 0.2s",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--danger-border)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--danger-bg)";
          }}
        >
          🗑️
        </button>
      )}
    </div>
  );
}

/* ============================================================
   ADD EVENT MODAL
   ============================================================ */

function AddEventModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [access, setAccess] = useState<EventAccess>("public");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  function handleFileSelect(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    const validExt = ["jpg", "jpeg", "png", "gif", "webp"];
    if (!validExt.includes(ext)) {
      setError(`Nepodporovaný formát (.${ext}). Povolené: ${validExt.join(", ")}`);
      setCoverFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Obrázek je příliš velký. Maximum je 10 MB.");
      setCoverFile(null);
      return;
    }
    setError("");
    setCoverFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate || !user) return;

    setSaving(true);
    setError("");

    try {
      let coverImageUrl: string | null = null;

      // Upload cover image
      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const filePath = `events/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from("images")
          .upload(filePath, coverFile);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("images")
          .getPublicUrl(filePath);

        coverImageUrl = urlData.publicUrl;
      }

      const { error: dbErr } = await supabase.from("events").insert({
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        event_time: eventTime || null,
        end_date: endDate || null,
        location: location.trim() || null,
        url: url.trim() || null,
        cover_image_url: coverImageUrl,
        access,
        created_by: user.id,
      });

      if (dbErr) throw dbErr;

      onAdded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba při ukládání";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-input)",
    borderRadius: "8px",
    color: "var(--text-body)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    color: "var(--text-muted)",
    marginBottom: "6px",
    fontWeight: 500,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
            ➕ Přidat akci
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Název */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Název *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Název akce"
              style={inputStyle}
            />
          </div>

          {/* Popis */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Popis</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Podrobný popis akce..."
              rows={4}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />
          </div>

          {/* Datum konání + Čas */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Datum konání *</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                style={{
                  ...inputStyle,
                  colorScheme: "dark",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Čas začátku</label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                style={{
                  ...inputStyle,
                  colorScheme: "dark",
                }}
              />
            </div>
          </div>

          {/* Datum konce */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Datum konce (pro vícedenní akce)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                ...inputStyle,
                colorScheme: "dark",
              }}
            />
          </div>

          {/* Místo */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Místo konání</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Adresa, město"
              style={inputStyle}
            />
          </div>

          {/* URL */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Odkaz na web akce</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          {/* Cover image */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Cover obrázek</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() =>
                document.getElementById("event-cover-input")?.click()
              }
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-input)"}`,
                borderRadius: "12px",
                padding: "24px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.2s",
                background: dragOver
                  ? "var(--accent-bg-subtle)"
                  : "transparent",
              }}
            >
              <input
                id="event-cover-input"
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
                style={{ display: "none" }}
              />
              {coverFile ? (
                <div>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>📷</div>
                  <div style={{ fontSize: "14px", color: "var(--text-body)", fontWeight: 500 }}>
                    {coverFile.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-dimmer)", marginTop: "4px" }}>
                    {(coverFile.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>📷</div>
                  <div style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                    Přetáhněte obrázek sem nebo klikněte
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "4px" }}>
                    JPEG, PNG, GIF, WebP · max 10 MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Přístup */}
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Přístup</label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "var(--text-body)",
                }}
              >
                <input
                  type="radio"
                  name="access"
                  value="public"
                  checked={access === "public"}
                  onChange={() => setAccess("public")}
                  style={{ accentColor: "var(--accent)" }}
                />
                🌐 Veřejné
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "var(--text-body)",
                }}
              >
                <input
                  type="radio"
                  name="access"
                  value="authenticated"
                  checked={access === "authenticated"}
                  onChange={() => setAccess("authenticated")}
                  style={{ accentColor: "var(--accent)" }}
                />
                🔒 Jen přihlášení
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--danger-bg)",
                border: "1px solid rgba(220,53,69,0.3)",
                borderRadius: "8px",
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !title.trim() || !eventDate}
            style={{
              width: "100%",
              padding: "12px",
              background:
                saving || !title.trim() || !eventDate ? "var(--border-hover)" : "var(--accent)",
              color:
                saving || !title.trim() || !eventDate ? "var(--text-dimmer)" : "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor:
                saving || !title.trim() || !eventDate
                  ? "not-allowed"
                  : "pointer",
              transition: "background 0.2s",
            }}
          >
            {saving ? "Ukládám..." : "Přidat akci"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function EventsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("upcoming");
  const [showAddModal, setShowAddModal] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isAuthenticated = !!user;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.getSession();

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;
      setEvents((data as Event[]) || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchEvents();
    }
  }, [fetchEvents, authLoading]);

  async function handleDelete(event: Event) {
    if (!confirm(`Opravdu smazat akci "${event.title}"?`)) return;

    try {
      // Delete cover image from storage if exists
      if (event.cover_image_url) {
        const urlParts = event.cover_image_url.split("/images/");
        if (urlParts[1]) {
          const storagePath = decodeURIComponent(urlParts[1]);
          await supabase.storage.from("images").remove([storagePath]);
        }
      }

      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);
      if (error) throw error;

      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba při mazání");
    }
  }

  // Split events
  const upcomingEvents = events
    .filter(isUpcoming)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const pastEvents = events
    .filter((e) => !isUpcoming(e))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  let displayEvents: Event[];
  if (activeFilter === "upcoming") displayEvents = upcomingEvents;
  else if (activeFilter === "past") displayEvents = pastEvents;
  else displayEvents = [...upcomingEvents, ...pastEvents];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>Plánované </span>
            <span style={{ color: "var(--accent)" }}>akce</span>
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-dim)" }}>
            Výstavy, setkání a události ze světa modelové železnice
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-text-on)",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent)")
            }
          >
            ➕ Přidat akci
          </button>
        )}
      </div>

      {/* Filter buttons */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "32px",
          flexWrap: "wrap",
        }}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.value;
          const count =
            f.value === "upcoming"
              ? upcomingEvents.length
              : f.value === "past"
              ? pastEvents.length
              : events.length;
          return (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{
                padding: "8px 16px",
                background: isActive
                  ? "var(--accent-border)"
                  : "var(--bg-card)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "8px",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {f.icon} {f.label}
              {!loading && (
                <span
                  style={{
                    fontSize: "11px",
                    color: isActive ? "var(--accent)" : "var(--text-faint)",
                    marginLeft: "2px",
                  }}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Events list */}
      {loading || authLoading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "var(--text-dimmer)", fontSize: "14px" }}>
            Načítám akce...
          </p>
        </div>
      ) : displayEvents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "16px",
              marginBottom: "4px",
            }}
          >
            {activeFilter === "upcoming"
              ? "Žádné nadcházející akce"
              : activeFilter === "past"
              ? "Žádné proběhlé akce"
              : "Zatím nejsou žádné akce"}
          </p>
          <p style={{ color: "var(--text-faint)", fontSize: "13px" }}>
            {activeFilter === "upcoming"
              ? "Zkuste se podívat na proběhlé akce"
              : "Nové akce budou brzy přidány"}
          </p>
        </div>
      ) : (
        <>
          {/* Upcoming section when filter is "all" */}
          {activeFilter === "all" && upcomingEvents.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--accent)",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                📅 Nadcházející akce
              </h2>
              <div
                style={{
                  display: "grid",
                  gap: "20px",
                }}
              >
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                      @media (min-width: 768px) {
                        .events-grid { grid-template-columns: repeat(2, 1fr) !important; }
                      }
                    `,
                  }}
                />
                <div
                  className="events-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "20px",
                  }}
                >
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isPast={false}
                      isAdmin={isAdmin}
                      isAuthenticated={isAuthenticated}
                      onDelete={() => handleDelete(event)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Past section when filter is "all" */}
          {activeFilter === "all" && pastEvents.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-dimmer)",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                📋 Proběhlé akce
              </h2>
              <div
                className="events-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "20px",
                }}
              >
                {pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isPast={true}
                    isAdmin={isAdmin}
                    isAuthenticated={isAuthenticated}
                    onDelete={() => handleDelete(event)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Single filter view (upcoming or past) */}
          {activeFilter !== "all" && (
            <div
              className="events-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "20px",
              }}
            >
              {displayEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isPast={!isUpcoming(event)}
                  isAdmin={isAdmin}
                  isAuthenticated={isAuthenticated}
                  onDelete={() => handleDelete(event)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Responsive grid style */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 768px) {
              .events-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
          `,
        }}
      />

      {/* Add event modal */}
      {showAddModal && (
        <AddEventModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => fetchEvents()}
        />
      )}
    </div>
  );
}
