-- 036_escrow_v2.sql — Escrow v2: partial payment, payout flow, reviews

-- ═══════════════════════════════════════════════════════════════
-- 1) ALTER escrow_transactions
-- ═══════════════════════════════════════════════════════════════

-- Nový sloupec pro částečnou platbu
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS partial_amount numeric;

-- Admin poznámka
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS admin_note text;

-- Fotka potvrzení o odeslání
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS shipping_photo text;

-- Rozšířit CHECK constraint o nové stavy
ALTER TABLE escrow_transactions DROP CONSTRAINT IF EXISTS escrow_transactions_status_check;
ALTER TABLE escrow_transactions ADD CONSTRAINT escrow_transactions_status_check
  CHECK (status IN ('created','partial_paid','paid','shipped','delivered','completed','disputed','refunded','auto_completed','cancelled','payout_sent','payout_confirmed'));

-- ═══════════════════════════════════════════════════════════════
-- 2) escrow_reviews
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS escrow_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reviewed_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escrow_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_reviews_escrow ON escrow_reviews(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_reviews_reviewer ON escrow_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_reviews_reviewed ON escrow_reviews(reviewed_id);

-- RLS
ALTER TABLE escrow_reviews ENABLE ROW LEVEL SECURITY;

-- Kdokoliv může číst recenze (veřejné)
CREATE POLICY escrow_reviews_select ON escrow_reviews
  FOR SELECT USING (true);

-- Zápis jen přes service role (API routes)
