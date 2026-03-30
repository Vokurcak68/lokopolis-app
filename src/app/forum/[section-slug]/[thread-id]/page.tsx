import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ThreadDetailClient from "./thread-detail-client";

export const revalidate = 120;

type Params = { "section-slug": string; "thread-id": string };

async function getThreadSeo(sectionSlug: string, threadId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const { data: section } = await supabase
    .from("forum_sections")
    .select("id, name, slug")
    .eq("slug", sectionSlug)
    .single();

  if (!section) return null;

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, title, content, created_at, updated_at, section_id")
    .eq("id", threadId)
    .eq("section_id", section.id)
    .single();

  if (!thread) return null;

  const { count } = await supabase
    .from("forum_posts")
    .select("*", { count: "exact", head: true })
    .eq("thread_id", threadId);

  return { section, thread, postsCount: count || 0 };
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const sectionSlug = p["section-slug"];
  const threadId = p["thread-id"];
  const data = await getThreadSeo(sectionSlug, threadId);

  if (!data) {
    return {
      title: "Vlákno nenalezeno",
      robots: { index: false, follow: false },
      alternates: { canonical: `/forum/${sectionSlug}/${threadId}` },
    };
  }

  const description = stripHtml(data.thread.content || `${data.thread.title} — diskuze na Lokopolis`).slice(0, 160);
  return {
    title: `${data.thread.title} — Fórum`,
    description,
    alternates: { canonical: `/forum/${sectionSlug}/${threadId}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${data.thread.title} — Fórum | Lokopolis`,
      description,
      url: `https://lokopolis.cz/forum/${sectionSlug}/${threadId}`,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${data.thread.title} — Fórum | Lokopolis`,
      description,
    },
  };
}

export default async function ThreadDetailPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const sectionSlug = p["section-slug"];
  const threadId = p["thread-id"];
  const data = await getThreadSeo(sectionSlug, threadId);

  if (!data) {
    notFound();
  }

  const description = stripHtml(data.thread.content || data.thread.title).slice(0, 300);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: data.thread.title,
    articleBody: description,
    datePublished: data.thread.created_at,
    dateModified: data.thread.updated_at || data.thread.created_at,
    url: `https://lokopolis.cz/forum/${sectionSlug}/${threadId}`,
    mainEntityOfPage: `https://lokopolis.cz/forum/${sectionSlug}/${threadId}`,
    publisher: {
      "@type": "Organization",
      name: "Lokopolis",
      url: "https://lokopolis.cz",
    },
    about: data.section.name,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: data.postsCount,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ThreadDetailClient />
    </>
  );
}
