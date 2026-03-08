/**
 * CategoryIcon — displays the custom icon image for a category (by slug),
 * falling back to the emoji if no custom icon exists.
 */

const ICON_BASE = "https://psbeoiaqoreergwqzqoz.supabase.co/storage/v1/object/public/images/icons";

const CATEGORY_ICONS: Record<string, string> = {
  "stavba-kolejiste": `${ICON_BASE}/stavba-kolejiste.png`,
  "recenze": `${ICON_BASE}/recenze-modelu.png`,
  "navody-a-tipy": `${ICON_BASE}/navody-a-tipy.png`,
  "krajina-a-zelen": `${ICON_BASE}/krajina-a-zelen.png`,
  "digitalni-rizeni": `${ICON_BASE}/digitalni-rizeni.png?v=6`,
  "prestavby": `${ICON_BASE}/prestavby.png`,
  "kolejove-plany": `${ICON_BASE}/kolejove-plany.png`,
  "modelove-domy": `${ICON_BASE}/modelove-domy.png`,
  "natery-a-patina": `${ICON_BASE}/natery-a-patina.png`,
  "osvetleni": `${ICON_BASE}/osvetleni.png`,
  "3d-tisk": `${ICON_BASE}/3d-tisk.png`,
  "ze-sveta": `${ICON_BASE}/ze-sveta.png`,
};

interface CategoryIconProps {
  slug?: string;
  emoji?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function getCategoryIconUrl(slug: string): string | undefined {
  return CATEGORY_ICONS[slug];
}

export default function CategoryIcon({ slug, emoji, size = 20, className, style }: CategoryIconProps) {
  const iconUrl = slug ? CATEGORY_ICONS[slug] : undefined;

  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          objectFit: "contain",
          ...style,
        }}
      />
    );
  }

  return <span className={className} style={style}>{emoji || "📁"}</span>;
}
