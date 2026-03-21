-- 052: Add delivery_reminder_sent flag to escrow_transactions
-- Tracks whether buyer was reminded to confirm delivery
ALTER TABLE escrow_transactions
  ADD COLUMN IF NOT EXISTS delivery_reminder_sent boolean DEFAULT NULL;

COMMENT ON COLUMN escrow_transactions.delivery_reminder_sent IS 'Set to true when delivery confirmation reminder email was sent to buyer';
