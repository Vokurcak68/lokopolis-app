-- 051: Add shipping_reminder_sent flag to escrow_transactions
-- Tracks whether the seller was reminded about shipping deadline
ALTER TABLE escrow_transactions
  ADD COLUMN IF NOT EXISTS shipping_reminder_sent boolean DEFAULT NULL;

COMMENT ON COLUMN escrow_transactions.shipping_reminder_sent IS 'Set to true when shipping deadline reminder email was sent to seller';
