const projectId = "psbeoiaqoreergwqzqoz";

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function supabaseImageLoader({ src, width, quality }: ImageLoaderParams): string {
  // Only transform Supabase storage URLs
  if (src.includes(`${projectId}.supabase.co/storage/v1/object/public/`)) {
    // Split existing query to avoid generating invalid URLs with two "?"
    const [baseUrl, existingQuery = ""] = src.split("?");

    // Replace /object/public/ with /render/image/public/ for transformation API
    const renderBaseUrl = baseUrl.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );

    const params = new URLSearchParams(existingQuery);
    params.set("width", String(width));
    params.set("quality", String(quality || 75));

    return `${renderBaseUrl}?${params.toString()}`;
  }

  // Return other URLs as-is (YouTube thumbnails, external images)
  return src;
}
