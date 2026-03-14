-- 021: Order tracking + shipping name/company
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS admin_order_note TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_name TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_company TEXT;
