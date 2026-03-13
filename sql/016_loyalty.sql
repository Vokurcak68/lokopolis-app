-- =============================================
-- 016_loyalty.sql — Věrnostní program
-- =============================================

-- 1) Věrnostní úrovně
CREATE TABLE IF NOT EXISTS loyalty_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                       -- "Bronzový", "Stříbrný", "Zlatý", "Platinový"
  slug TEXT NOT NULL UNIQUE,
  min_points INTEGER NOT NULL DEFAULT 0,    -- od kolika bodů
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,  -- trvalá sleva v %
  points_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,  -- násobitel bodů (1.5× pro zlaté)
  color TEXT NOT NULL DEFAULT '#cd7f32',
  icon TEXT NOT NULL DEFAULT '🥉',
  perks TEXT[],                             -- speciální výhody ["Přednostní přístup", "Exkluzivní produkty"]
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Body uživatelů
CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,                   -- + připsání, - využití
  reason TEXT NOT NULL,                      -- 'purchase', 'review', 'registration', 'referral', 'admin', 'redeem'
  order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL,
  description TEXT,                          -- "Objednávka LKP-2026-12345"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Rozšíření profiles o body
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS loyalty_level_id UUID REFERENCES loyalty_levels(id);

-- 4) Rozšíření shop_orders o body
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS loyalty_points_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 5) Indexy
CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_order ON loyalty_points(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_levels_min_points ON loyalty_levels(min_points);
CREATE INDEX IF NOT EXISTS idx_profiles_loyalty_level ON profiles(loyalty_level_id);

-- 6) RLS
ALTER TABLE loyalty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- Úrovně: čtení pro všechny
CREATE POLICY "loyalty_levels_read" ON loyalty_levels FOR SELECT USING (true);
CREATE POLICY "loyalty_levels_admin" ON loyalty_levels FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Body: uživatel vidí své, admin vidí vše
CREATE POLICY "loyalty_points_own" ON loyalty_points FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "loyalty_points_admin" ON loyalty_points FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 7) Seed: 4 úrovně
INSERT INTO loyalty_levels (name, slug, min_points, discount_percent, points_multiplier, color, icon, perks, sort_order) VALUES
  ('Bronzový', 'bronze', 0, 0, 1.0, '#cd7f32', '🥉', ARRAY['Sbírání bodů'], 1),
  ('Stříbrný', 'silver', 500, 3, 1.2, '#c0c0c0', '🥈', ARRAY['3% sleva na vše', '1.2× body'], 2),
  ('Zlatý', 'gold', 2000, 5, 1.5, '#ffd700', '🥇', ARRAY['5% sleva na vše', '1.5× body', 'Přednostní přístup k novinkám'], 3),
  ('Platinový', 'platinum', 5000, 10, 2.0, '#e5e4e2', '💎', ARRAY['10% sleva na vše', '2× body', 'Přednostní přístup', 'Exkluzivní produkty', 'VIP podpora'], 4)
ON CONFLICT (slug) DO NOTHING;
