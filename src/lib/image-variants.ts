/**
 * Get the correct image variant for different contexts
 * Variants: thumb_ (200×200), card_ (600×450), full_ (1200×800)
 */

export function getImageVariant(
  coverUrl: string | null,
  variant: "thumb" | "card" | "full"
): string {
  if (!coverUrl) return "";

  // Always use Supabase render API with resize=contain (no crop)
  // Strip any existing variant prefix to get the original image
  const originalUrl = coverUrl.replace(/covers\/(thumb|card|full)_/, "covers/");

  const sizes = {
    thumb: { width: 200, height: 200 },
    card: { width: 600, height: 450 },
    full: { width: 1200, height: 800 },
  };
  const { width, height } = sizes[variant];

  return originalUrl
    .replace("/object/public/", "/render/image/public/")
    .concat(`?width=${width}&height=${height}&resize=contain&quality=85`);
}

/**
 * Optimize Supabase image URL for rendering
 */
export function optimizeImageUrl(url: string, width?: number): string {
  if (!url) return "";
  let optimized = url.replace("/object/public/", "/render/image/public/");
  if (width) {
    optimized += `?width=${width}&quality=75`;
  }
  return optimized;
}
