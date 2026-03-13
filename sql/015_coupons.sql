-- =============================================
-- 015_coupons.sql — Kupóny a slevy
-- =============================================

-- 1) Kupóny
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                     -- "ZIMA2026", "PRVNI10"
  description TEXT,                              -- interní popis pro admina
  discount_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  discount_value NUMERIC(10,2) NOT NULL,         -- 10 = 10% nebo 10 Kč
  min_order_amount NUMERIC(10,2),                -- min. hodnota objednávky (NULL = bez limitu)
  max_discount NUMERIC(10,2),                    -- max sleva v Kč pro percent typ (NULL = bez limitu)
  max_uses INTEGER,                              -- celkový limit použití (NULL = neomezeno)
  max_uses_per_user INTEGER DEFAULT 1,           -- limit na uživatele
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,                        -- platnost od (NULL = ihned)
  valid_until TIMESTAMPTZ,                       -- platnost do (NULL = neomezeno)
  product_ids UUID[],                            -- omezení na produkty (NULL = všechny)
  category_slugs TEXT[],                         -- omezení na kategorie (NULL = všechny)
  first_order_only BOOLEAN NOT NULL DEFAULT false,  -- jen první objednávka
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Použití kupónů (auditní log)
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL,        -- skutečná sleva v Kč
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, order_id)
);

-- 3) Rozšíření shop_orders o kupón
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 4) Indexy
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON coupon_usage(order_id);

-- 5) RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- Kupóny: čtení pro všechny (validace), zápis jen admin
CREATE POLICY "coupons_read" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_admin" ON coupons FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Použití: uživatel vidí své, admin vidí vše
CREATE POLICY "coupon_usage_own" ON coupon_usage FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "coupon_usage_admin" ON coupon_usage FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
-- Insert pro service role (checkout API) — RLS se obchází přes service key
