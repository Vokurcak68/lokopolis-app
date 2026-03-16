-- 037: Homepage banners system
-- Admin-managed banners for homepage (leaderboard, native cards, etc.)

CREATE TABLE IF NOT EXISTS homepage_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Position: 'hero_leaderboard' (under hero), 'article_native' (in articles), 'bazar_native' (in bazar)
  position text NOT NULL DEFAULT 'hero_leaderboard',
  title text NOT NULL,
  subtitle text,
  -- Image: full-width for leaderboard, card-sized for native
  image_url text,
  -- Link: where the banner clicks through
  link_url text NOT NULL,
  -- Badge text: "Sponzorováno", "Eshop", "Partner" etc.
  badge_text text DEFAULT 'Sponzorováno',
  -- Scheduling
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  -- Priority: higher = shown first; same priority = random rotation
  priority int DEFAULT 0,
  -- Active toggle (admin can disable without deleting)
  is_active boolean DEFAULT true,
  -- Stats
  impressions int DEFAULT 0,
  clicks int DEFAULT 0,
  -- Meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Index for efficient homepage queries
CREATE INDEX IF NOT EXISTS idx_homepage_banners_active
  ON homepage_banners (position, is_active, priority DESC)
  WHERE is_active = true;

-- RLS
ALTER TABLE homepage_banners ENABLE ROW LEVEL SECURITY;

-- Everyone can read active banners
CREATE POLICY "Anyone can read active banners"
  ON homepage_banners FOR SELECT
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

-- Only admins can manage
CREATE POLICY "Admins can manage banners"
  ON homepage_banners FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RPC for incrementing impressions (called server-side)
CREATE OR REPLACE FUNCTION increment_banner_impressions(banner_ids uuid[])
RETURNS void AS $$
BEGIN
  UPDATE homepage_banners SET impressions = impressions + 1 WHERE id = ANY(banner_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for incrementing clicks (called on click)
CREATE OR REPLACE FUNCTION increment_banner_clicks(banner_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE homepage_banners SET clicks = clicks + 1 WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
