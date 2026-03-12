-- 012: Shop categories
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6b7280',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_categories_read" ON shop_categories FOR SELECT USING (true);
CREATE POLICY "shop_categories_admin" ON shop_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed default categories
INSERT INTO shop_categories (slug, name, emoji, color, sort_order) VALUES
  ('kolejovy-plan', 'Kolejové plány', '📐', '#3b82f6', 1),
  ('stl-model', '3D modely / STL', '🧊', '#8b5cf6', 2),
  ('navod', 'Návody', '📖', '#22c55e', 3),
  ('ebook', 'E-booky', '📚', '#eab308', 4),
  ('balicek', 'Balíčky', '📦', '#ec4899', 5)
ON CONFLICT (slug) DO NOTHING;
