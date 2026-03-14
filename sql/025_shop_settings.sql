-- Shop settings table
CREATE TABLE IF NOT EXISTS shop_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON shop_settings FOR SELECT USING (true);
CREATE POLICY "settings_update" ON shop_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "settings_insert" ON shop_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Default settings
INSERT INTO shop_settings (key, value) VALUES
  ('company', '{"name": "Lokopolis.cz", "ico": "", "dic": "", "street": "", "city": "", "zip": "", "country": "CZ", "email": "info@lokopolis.cz", "phone": "", "bank_account": ""}'),
  ('cart_timeout_hours', '72'),
  ('invoice_note', '"Faktura slouží jako daňový doklad."'),
  ('email_footer', '"Tento e-mail byl odeslán automaticky z Lokopolis.cz"')
ON CONFLICT (key) DO NOTHING;

-- Cart timeout: updated_at column on carts
ALTER TABLE carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Order archive: archived_at column on shop_orders
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
