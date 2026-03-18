-- 043: Add delivered_at column to escrow_transactions for auto-delivery feature
-- delivered_at tracks when the package was confirmed as delivered by carrier
-- Used for 14-day auto-release countdown

ALTER TABLE escrow_transactions
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient cron query: find delivered transactions older than 14 days
CREATE INDEX IF NOT EXISTS idx_escrow_delivered_at
ON escrow_transactions (delivered_at)
WHERE status = 'delivered' AND delivered_at IS NOT NULL;
