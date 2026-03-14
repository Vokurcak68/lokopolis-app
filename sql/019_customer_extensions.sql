-- 019_customer_extensions.sql
-- Rozšíření profilu o fakturační údaje, slevy a kontakt

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_zip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'CZ';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_ico TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_dic TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_company TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permanent_discount_percent INTEGER DEFAULT 0; -- admin nastaví % slevu napořád
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS volume_discount_percent INTEGER DEFAULT 0; -- automatická objemová sleva
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS volume_discount_threshold INTEGER DEFAULT 0; -- threshold v CZK za období
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS volume_discount_period_days INTEGER DEFAULT 365; -- období v dnech

-- RLS: uživatel může UPDATE vlastní profil (jen bezpečné sloupce)
-- Nejdřív smažeme starou policy pokud existuje
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Nová policy: uživatel může měnit jen bezpečné sloupce svého profilu
-- (ne role, ne discount sloupce)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Zajistíme, že uživatel nemůže měnit citlivé sloupce
    -- RLS check: role a discount sloupce musí zůstat stejné jako v DB
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    AND permanent_discount_percent = (SELECT p.permanent_discount_percent FROM profiles p WHERE p.id = auth.uid())
    AND volume_discount_percent = (SELECT p.volume_discount_percent FROM profiles p WHERE p.id = auth.uid())
    AND volume_discount_threshold = (SELECT p.volume_discount_threshold FROM profiles p WHERE p.id = auth.uid())
    AND volume_discount_period_days = (SELECT p.volume_discount_period_days FROM profiles p WHERE p.id = auth.uid())
  );

-- Admin policy: admin může updatovat cokoliv na jakémkoliv profilu
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
