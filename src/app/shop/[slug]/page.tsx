import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ShopProductDetailClient from "./shop-product-detail-client";

export const revalidate = 300;

type Params = { slug: string };

async function getProductSeo(slug: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("shop_products")
    .select("id, slug, title, description, long_description, category, scale, price, original_price, status, created_at, cover_image_url, preview_images")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  return data;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductSeo(slug);

  if (!product) {
    return {
      title: "Produkt nenalezen",
      robots: { index: false, follow: false },
      alternates: { canonical: `/shop/${slug}` },
    };
  }

  const raw = product.description || product.long_description || `${product.title} v shopu Lokopolis`;
  const description = stripHtml(raw).slice(0, 160);
  const images = [product.cover_image_url, ...(product.preview_images || [])].filter(Boolean) as string[];

  return {
    title: `${product.title} — Shop`,
    description,
    alternates: { canonical: `/shop/${slug}` },
    openGraph: {
      title: `${product.title} — Shop | Lokopolis`,
      description,
      url: `https://lokopolis.cz/shop/${slug}`,
      type: "website",
      ...(images.length ? { images: images.slice(0, 4).map((url) => ({ url })) } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} — Shop | Lokopolis`,
      description,
      ...(images.length ? { images: [images[0]] } : {}),
    },
  };
}

export default async function ShopProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProductSeo(slug);

  if (!product) {
    notFound();
  }

  const raw = product.description || product.long_description || `${product.title} v shopu Lokopolis`;
  const description = stripHtml(raw).slice(0, 300);
  const images = [product.cover_image_url, ...(product.preview_images || [])].filter(Boolean) as string[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    ...(images.length ? { image: images } : {}),
    ...(product.category ? { category: product.category } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "CZK",
      price: Number(product.price ?? 0),
      availability: "https://schema.org/InStock",
      url: `https://lokopolis.cz/shop/${slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShopProductDetailClient />
    </>
  );
}
