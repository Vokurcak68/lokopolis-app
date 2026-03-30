import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ListingDetailClient from "./listing-detail-client";

export const revalidate = 120;

type Params = { id: string };

async function getListingSeo(id: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("listings")
    .select("id, title, description, category, scale, condition, price, status, created_at, images, location")
    .eq("id", id)
    .single();

  return data;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingSeo(id);

  if (!listing) {
    return {
      title: "Inzerát nenalezen",
      robots: { index: false, follow: false },
      alternates: { canonical: `/bazar/${id}` },
    };
  }

  const isIndexable = listing.status === "active" || listing.status === "reserved";
  const descriptionRaw = listing.description || `${listing.title} v bazaru Lokopolis`;
  const description = stripHtml(descriptionRaw).slice(0, 160);
  const image = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images[0] : undefined;

  return {
    title: `${listing.title} — Bazar`,
    description,
    alternates: { canonical: `/bazar/${id}` },
    robots: isIndexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: `${listing.title} — Bazar | Lokopolis`,
      description,
      url: `https://lokopolis.cz/bazar/${id}`,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.title} — Bazar | Lokopolis`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const listing = await getListingSeo(id);

  if (!listing) {
    notFound();
  }

  const isIndexable = listing.status === "active" || listing.status === "reserved";
  const descriptionRaw = listing.description || `${listing.title} v bazaru Lokopolis`;
  const description = stripHtml(descriptionRaw).slice(0, 300);
  const image = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images[0] : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description,
    ...(image ? { image: [image] } : {}),
    ...(listing.category ? { category: listing.category } : {}),
    ...(listing.condition
      ? {
          itemCondition:
            listing.condition === "new"
              ? "https://schema.org/NewCondition"
              : "https://schema.org/UsedCondition",
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "CZK",
      price: Number(listing.price ?? 0),
      availability:
        listing.status === "active"
          ? "https://schema.org/InStock"
          : listing.status === "reserved"
            ? "https://schema.org/LimitedAvailability"
            : "https://schema.org/OutOfStock",
      url: `https://lokopolis.cz/bazar/${id}`,
    },
  };

  return (
    <>
      {isIndexable && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ListingDetailClient />
    </>
  );
}
