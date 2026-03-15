-- EAN kód produktu (volitelný, max 13 znaků)
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS ean TEXT;
