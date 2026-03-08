const projectId = "psbeoiaqoreergwqzqoz";

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function supabaseImageLoader({ src, width, quality }: ImageLoaderParams): string {
  // Only transform Supabase storage URLs
  if (src.includes(`${projectId}.supabase.co/storage/v1/object/public/`)) {
    // Replace /object/ with /render/image/ for transformation API
    const renderUrl = src.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    return `${renderUrl}?width=${width}&quality=${quality || 75}`;
  }

  // Return other URLs as-is (YouTube thumbnails, external images)
  return src;
}
