-- 020_user_addresses.sql
-- Dodací adresy uživatelů + rozšíření profilu o admin_note a is_blocked

-- === Dodací adresy ===
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Domů',
  full_name TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CZ',
  phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);

ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Uživatel vidí a spravuje jen své adresy
CREATE POLICY "user_addresses_select" ON user_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_addresses_insert" ON user_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_addresses_update" ON user_addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_addresses_delete" ON user_addresses FOR DELETE USING (auth.uid() = user_id);

-- Admin vidí všechny
CREATE POLICY "user_addresses_admin_select" ON user_addresses FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- === Rozšíření profiles ===
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
