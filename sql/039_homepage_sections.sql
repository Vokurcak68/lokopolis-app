-- Homepage sections visibility settings
-- Allows admin to toggle which sections are visible on the homepage

-- Create site_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default homepage sections configuration
INSERT INTO site_settings (key, value) VALUES (
  'homepage_sections',
  '{
    "leaderboard_banner": true,
    "latest_articles": true,
    "forum_bar": true,
    "categories": true,
    "cta_strip": true,
    "stats_bar": true,
    "inline_banner": true,
    "bazar": true,
    "competition": true,
    "shop_products": true,
    "downloads": true,
    "popular_articles": true,
    "events": true,
    "active_authors": true,
    "forum_widget": true,
    "tags": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
