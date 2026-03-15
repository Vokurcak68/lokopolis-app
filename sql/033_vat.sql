-- DPH sazba na produktech (ceny v DB jsou S DPH)
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS vat_rate INTEGER NOT NULL DEFAULT 21;

-- DPH sazba uložená v momentě nákupu na order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_rate INTEGER NOT NULL DEFAULT 21;

-- DPH sazba na dopravě
ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS vat_rate INTEGER NOT NULL DEFAULT 21;

-- Celkové DPH a základ na objednávce
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS total_vat NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS total_without_vat NUMERIC(10,2) DEFAULT 0;
