-- =============================================
-- 014_shop_full.sql — Full e-shop: cart, checkout, shipping, payments, order items
-- =============================================

-- 1) Shipping methods (admin-configurable)
CREATE TABLE IF NOT EXISTS shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- "Česká pošta - Balík do ruky"
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  free_from NUMERIC(10,2),                     -- free shipping above this amount (NULL = never free)
  delivery_days TEXT,                           -- "2-3 pracovní dny"
  digital_only BOOLEAN NOT NULL DEFAULT false,  -- true = only for digital-only orders
  physical_only BOOLEAN NOT NULL DEFAULT false,  -- true = only for physical orders
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Payment methods (admin-configurable)
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- "Bankovní převod"
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  surcharge NUMERIC(10,2) NOT NULL DEFAULT 0, -- extra fee
  instructions TEXT,                           -- payment instructions shown to customer
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Extend shop_orders with shipping/payment/address/multi-item support
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_method_id UUID REFERENCES shipping_methods(id);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS payment_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2);  -- computed: items + shipping + surcharge
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_phone TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_street TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_city TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_zip TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'CZ';
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_ico TEXT;           -- IČ for business
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_dic TEXT;           -- DIČ for business
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_street TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_city TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_zip TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_country TEXT DEFAULT 'CZ';
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Update order status enum to include new states
-- Note: if status is text, just use the new values. If it's an enum, need ALTER TYPE.
-- We'll handle both: try alter type, if fails it's already text
DO $$
BEGIN
  -- Check if shop_order_status type exists and alter it
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_order_status') THEN
    BEGIN
      ALTER TYPE shop_order_status ADD VALUE IF NOT EXISTS 'processing';
      ALTER TYPE shop_order_status ADD VALUE IF NOT EXISTS 'shipped';
      ALTER TYPE shop_order_status ADD VALUE IF NOT EXISTS 'delivered';
    EXCEPTION WHEN others THEN
      NULL; -- ignore if already exists
    END;
  END IF;
END $$;

-- 4) Order items (multi-product orders)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- 5) Carts (persistent for logged-in users)
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,  -- for anonymous carts (future)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_methods_active ON shipping_methods(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(active, sort_order);

-- 7) RLS policies
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Shipping methods: read for all, write for admin
CREATE POLICY "shipping_read" ON shipping_methods FOR SELECT USING (true);
CREATE POLICY "shipping_admin" ON shipping_methods FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Payment methods: same
CREATE POLICY "payment_read" ON payment_methods FOR SELECT USING (true);
CREATE POLICY "payment_admin" ON payment_methods FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Order items: users see own, admin sees all
CREATE POLICY "order_items_user" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE id = order_items.order_id AND user_id = auth.uid()));
CREATE POLICY "order_items_admin" ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Carts: users see/edit own
CREATE POLICY "carts_own" ON carts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Cart items: users manage own cart items
CREATE POLICY "cart_items_own" ON cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM carts WHERE id = cart_items.cart_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM carts WHERE id = cart_items.cart_id AND user_id = auth.uid()));

-- 8) Seed shipping methods
INSERT INTO shipping_methods (slug, name, description, price, delivery_days, digital_only, sort_order) VALUES
  ('email', 'E-mail (digitální produkty)', 'Okamžité doručení po zaplacení', 0, 'Ihned', true, 1),
  ('ceska-posta-balik', 'Česká pošta - Balík do ruky', 'Doručení na adresu', 89, '2-3 pracovní dny', false, 2),
  ('zasilkovna', 'Zásilkovna', 'Výdejní místa po celé ČR', 69, '1-2 pracovní dny', false, 3),
  ('osobni-odber', 'Osobní odběr', 'Po domluvě', 0, 'Dle dohody', false, 4)
ON CONFLICT (slug) DO NOTHING;

-- 9) Seed payment methods
INSERT INTO payment_methods (slug, name, description, instructions, sort_order) VALUES
  ('bank-transfer', 'Bankovní převod', 'Platba na účet', 'Převeďte částku na účet uvedený v potvrzení objednávky. Do poznámky uveďte číslo objednávky.', 1),
  ('qr-payment', 'QR platba', 'Naskenujte QR kód v bankovní aplikaci', 'Po vytvoření objednávky se zobrazí QR kód pro platbu.', 2),
  ('cash-on-delivery', 'Dobírka', 'Platba při převzetí zásilky (pouze fyzické produkty)', NULL, 3)
ON CONFLICT (slug) DO NOTHING;
