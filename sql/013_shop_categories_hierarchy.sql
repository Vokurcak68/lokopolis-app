-- Add parent_id column to shop_categories for hierarchical categories
ALTER TABLE shop_categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL;

-- Index for parent_id lookups
CREATE INDEX IF NOT EXISTS idx_shop_categories_parent_id ON shop_categories(parent_id);

-- Update existing seed categories (keep their existing ids, just ensure names match)
UPDATE shop_categories SET name = 'Kolejové plány', emoji = '📐', color = '#3b82f6', sort_order = 1 WHERE slug = 'kolejovy-plan';
UPDATE shop_categories SET name = '3D modely / STL', emoji = '🧊', color = '#8b5cf6', sort_order = 7 WHERE slug = 'stl-model';
UPDATE shop_categories SET name = 'Návody & Tutoriály', emoji = '📖', color = '#22c55e', sort_order = 6 WHERE slug = 'navod';
UPDATE shop_categories SET name = 'E-booky', emoji = '📚', color = '#eab308', sort_order = 8 WHERE slug = 'ebook';
UPDATE shop_categories SET name = 'Balíčky', emoji = '📦', color = '#ec4899', sort_order = 9 WHERE slug = 'balicek';

-- Insert new parent categories (ON CONFLICT DO NOTHING for safety)
INSERT INTO shop_categories (slug, name, emoji, color, sort_order, parent_id) VALUES
  ('kolejovy-plan', 'Kolejové plány', '📐', '#3b82f6', 1, NULL),
  ('lokomotivy', 'Lokomotivy', '🚂', '#ef4444', 2, NULL),
  ('vozy', 'Vozy', '🚃', '#f97316', 3, NULL),
  ('budovy-scenerie', 'Budovy & Scenérie', '🏠', '#14b8a6', 4, NULL),
  ('elektronika', 'Elektronika & Digitalizace', '🔧', '#6366f1', 5, NULL),
  ('navod', 'Návody & Tutoriály', '📖', '#22c55e', 6, NULL),
  ('stl-model', '3D modely / STL', '🧊', '#8b5cf6', 7, NULL),
  ('ebook', 'E-booky', '📚', '#eab308', 8, NULL),
  ('balicek', 'Balíčky', '📦', '#ec4899', 9, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Subcategories: Kolejové plány
INSERT INTO shop_categories (slug, name, emoji, color, sort_order, parent_id) VALUES
  ('kolejovy-plan-tt', 'TT', '📐', '#3b82f6', 11, (SELECT id FROM shop_categories WHERE slug = 'kolejovy-plan')),
  ('kolejovy-plan-h0', 'H0', '📐', '#3b82f6', 12, (SELECT id FROM shop_categories WHERE slug = 'kolejovy-plan')),
  ('kolejovy-plan-n', 'N', '📐', '#3b82f6', 13, (SELECT id FROM shop_categories WHERE slug = 'kolejovy-plan'))
ON CONFLICT (slug) DO NOTHING;

-- Subcategories: Lokomotivy
INSERT INTO shop_categories (slug, name, emoji, color, sort_order, parent_id) VALUES
  ('lokomotivy-parni', 'Parní', '🚂', '#ef4444', 21, (SELECT id FROM shop_categories WHERE slug = 'lokomotivy')),
  ('lokomotivy-dieselove', 'Dieselové', '🚂', '#ef4444', 22, (SELECT id FROM shop_categories WHERE slug = 'lokomotivy')),
  ('lokomotivy-elektricke', 'Elektrické', '🚂', '#ef4444', 23, (SELECT id FROM shop_categories WHERE slug = 'lokomotivy'))
ON CONFLICT (slug) DO NOTHING;

-- Subcategories: Vozy
INSERT INTO shop_categories (slug, name, emoji, color, sort_order, parent_id) VALUES
  ('vozy-osobni', 'Osobní', '🚃', '#f97316', 31, (SELECT id FROM shop_categories WHERE slug = 'vozy')),
  ('vozy-nakladni', 'Nákladní', '🚃', '#f97316', 32, (SELECT id FROM shop_categories WHERE slug = 'vozy'))
ON CONFLICT (slug) DO NOTHING;

-- Subcategories: Budovy & Scenérie
INSERT INTO shop_categories (slug, name, emoji, color, sort_order, parent_id) VALUES
  ('budovy-nadrazi', 'Nádraží', '🏠', '#14b8a6', 41, (SELECT id FROM shop_categories WHERE slug = 'budovy-scenerie')),
  ('budovy-domy', 'Domy', '🏠', '#14b8a6', 42, (SELECT id FROM shop_categories WHERE slug = 'budovy-scenerie')),
  ('budovy-krajina', 'Krajina & Terén', '🏠', '#14b8a6', 43, (SELECT id FROM shop_categories WHERE slug = 'budovy-scenerie'))
ON CONFLICT (slug) DO NOTHING;

-- Subcategories: Elektronika & Digitalizace
INSERT INTO shop_categories (slug, name, emoji, color, sort_order, parent_id) VALUES
  ('elektronika-dcc', 'DCC dekodéry', '🔧', '#6366f1', 51, (SELECT id FROM shop_categories WHERE slug = 'elektronika')),
  ('elektronika-vyhybky', 'Ovládání výhybek', '🔧', '#6366f1', 52, (SELECT id FROM shop_categories WHERE slug = 'elektronika'))
ON CONFLICT (slug) DO NOTHING;
