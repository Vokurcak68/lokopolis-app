-- 029: Add billing_company to shop_orders
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS billing_company TEXT;
