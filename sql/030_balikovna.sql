-- Rozšíření shipping_methods o typ dopravy
ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS shipping_type TEXT NOT NULL DEFAULT 'standard';
-- standard = klasická doprava na adresu
-- pickup_point = výdejní místo (Balíkovna, Zásilkovna apod.)

-- Sloupce pro uložení výdejního místa k objednávce
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pickup_point_id TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pickup_point_name TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pickup_point_address TEXT;

-- Dva nové záznamy pro Balíkovnu
INSERT INTO shipping_methods (name, slug, description, price, free_from, delivery_days, physical_only, active, sort_order, shipping_type)
VALUES 
  ('Balíkovna — Na adresu', 'balikovna-adresa', 'Doručení na vaši adresu přes Českou poštu / Balíkovnu', 89, 1500, '2-3 pracovní dny', true, true, 10, 'standard'),
  ('Balíkovna — Výdejní místo', 'balikovna-vydejni-misto', 'Vyzvedněte si balík na vybraném výdejním místě Balíkovny', 59, 1500, '2-3 pracovní dny', true, true, 11, 'pickup_point')
ON CONFLICT (slug) DO NOTHING;
