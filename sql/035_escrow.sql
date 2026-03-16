-- 035_escrow.sql — Bezpečná platba (escrow) pro bazar
-- Tabulky: escrow_transactions, escrow_disputes, escrow_settings

-- ═══════════════════════════════════════════════════════════════
-- 1) escrow_transactions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  amount numeric NOT NULL CHECK (amount > 0),
  commission_rate numeric NOT NULL DEFAULT 5,
  commission_amount numeric NOT NULL DEFAULT 0,
  seller_payout numeric NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','paid','shipped','delivered','completed','disputed','refunded','auto_completed','cancelled')),

  tracking_number text,
  carrier text,

  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  disputed_at timestamptz,
  cancelled_at timestamptz,
  buyer_confirmed_at timestamptz,
  auto_complete_at timestamptz,

  payment_reference text NOT NULL,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexy
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer ON escrow_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_seller ON escrow_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_listing ON escrow_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status);

-- RLS
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Buyer/seller mohou číst své transakce
CREATE POLICY escrow_transactions_select ON escrow_transactions
  FOR SELECT USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Zápis jen přes service role (API routes)
-- Žádná INSERT/UPDATE/DELETE policy pro anon/authenticated = jen service role

-- ═══════════════════════════════════════════════════════════════
-- 2) escrow_disputes
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS escrow_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  reason text NOT NULL,
  evidence_images text[] NOT NULL DEFAULT '{}',

  resolution text,
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,

  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved_buyer','resolved_seller','resolved_split')),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_disputes_escrow ON escrow_disputes(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_disputes_status ON escrow_disputes(status);

-- RLS
ALTER TABLE escrow_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_disputes_select ON escrow_disputes
  FOR SELECT USING (
    opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM escrow_transactions et
      WHERE et.id = escrow_disputes.escrow_id
      AND (et.buyer_id = auth.uid() OR et.seller_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- 3) escrow_settings (key-value)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS escrow_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE escrow_settings ENABLE ROW LEVEL SECURITY;

-- Nastavení může číst klient (pro zobrazení dostupnosti escrow), edituje jen admin přes service role API
CREATE POLICY escrow_settings_select ON escrow_settings
  FOR SELECT USING (true);

-- Seed data
INSERT INTO escrow_settings (key, value) VALUES
  ('commission_rate', '5'),
  ('min_commission', '15'),
  ('payment_deadline_hours', '24'),
  ('shipping_deadline_days', '5'),
  ('confirmation_deadline_days', '7'),
  ('auto_complete_days', '14'),
  ('bank_account', ''),
  ('bank_iban', ''),
  ('escrow_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Updated_at trigger pro escrow_transactions
CREATE OR REPLACE FUNCTION update_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION update_escrow_updated_at();
