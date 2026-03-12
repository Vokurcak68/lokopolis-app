-- Shop products
CREATE TABLE shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT, -- krátký popis (pro karty)
  long_description TEXT, -- detailní popis (HTML, pro detail stránku)
  price INTEGER NOT NULL DEFAULT 0, -- cena v CZK (0 = zdarma)
  original_price INTEGER, -- původní cena (pro zobrazení slevy)
  category TEXT NOT NULL CHECK (category IN ('kolejovy-plan', 'stl-model', 'navod', 'ebook', 'balicek')),
  scale TEXT, -- TT, H0, N, universal
  cover_image_url TEXT, -- náhledový obrázek
  preview_images TEXT[] DEFAULT '{}', -- galerie náhledů
  file_url TEXT, -- URL ke stažení (Supabase Storage, private bucket)
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT, -- pdf, zip, stl
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT false, -- zvýrazněný produkt
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- LKP-2026-0001
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  price INTEGER NOT NULL, -- cena v momentě objednávky
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method TEXT, -- 'bank_transfer', 'free'
  notes TEXT, -- poznámky od uživatele
  admin_notes TEXT, -- poznámky admina
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User's purchased products (for download access)
CREATE TABLE user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Indexes
CREATE INDEX idx_shop_products_status ON shop_products(status);
CREATE INDEX idx_shop_products_category ON shop_products(category);
CREATE INDEX idx_shop_products_featured ON shop_products(featured) WHERE featured = true;
CREATE INDEX idx_shop_products_slug ON shop_products(slug);
CREATE INDEX idx_shop_orders_user ON shop_orders(user_id);
CREATE INDEX idx_shop_orders_status ON shop_orders(status);
CREATE INDEX idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_product ON user_purchases(product_id);

-- RLS
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read active, admin can CRUD
CREATE POLICY "products_read" ON shop_products FOR SELECT USING (status = 'active' OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "products_insert" ON shop_products FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "products_update" ON shop_products FOR UPDATE USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "products_delete" ON shop_products FOR DELETE USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Orders: user sees own, admin sees all
CREATE POLICY "orders_read" ON shop_orders FOR SELECT USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "orders_insert" ON shop_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_update" ON shop_orders FOR UPDATE USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Purchases: user sees own, admin sees all
CREATE POLICY "purchases_read" ON user_purchases FOR SELECT USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "purchases_insert" ON user_purchases FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Order number generator
CREATE OR REPLACE FUNCTION generate_order_number() RETURNS TEXT AS $$
DECLARE
  yr TEXT := EXTRACT(YEAR FROM now())::TEXT;
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 10) AS INTEGER)), 0) + 1
  INTO seq FROM shop_orders WHERE order_number LIKE 'LKP-' || yr || '-%';
  RETURN 'LKP-' || yr || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Private storage bucket for shop files (downloads)
INSERT INTO storage.buckets (id, name, public) VALUES ('shop', 'shop', false) ON CONFLICT DO NOTHING;
CREATE POLICY "shop_admin_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop' AND EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "shop_admin_read" ON storage.objects FOR SELECT USING (bucket_id = 'shop' AND EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "shop_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'shop' AND EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
