-- Nový způsob dopravy: Zásilkovna
INSERT INTO shipping_methods (name, slug, description, price, free_from, delivery_days, physical_only, active, sort_order, shipping_type)
VALUES 
  ('Zásilkovna — Výdejní místo', 'zasilkovna-vydejni-misto', 'Vyzvedněte si balík na výdejním místě Zásilkovny (Z-BOX, Z-POINT)', 59, 1500, '1-3 pracovní dny', true, true, 12, 'pickup_point')
ON CONFLICT (slug) DO NOTHING;

-- Přidat sloupec pro rozlišení poskytovatele pickup pointu
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pickup_point_carrier TEXT;
-- Hodnoty: 'balikovna', 'zasilkovna', null
