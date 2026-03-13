-- Shop categories (standalone table, no CHECK constraint on products)
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read" ON shop_categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON shop_categories FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "categories_update" ON shop_categories FOR UPDATE USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "categories_delete" ON shop_categories FOR DELETE USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default categories
INSERT INTO shop_categories (slug, name, emoji, color, sort_order) VALUES
  ('kolejovy-plan', 'Kolejové plány', '📐', '#3b82f6', 1),
  ('stl-model', '3D modely / STL', '🧊', '#8b5cf6', 2),
  ('navod', 'Návody', '📖', '#22c55e', 3),
  ('ebook', 'E-booky', '📚', '#eab308', 4),
  ('balicek', 'Balíčky', '📦', '#ec4899', 5)
ON CONFLICT (slug) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_shop_categories_active ON shop_categories(active, sort_order);
