-- 053: Add delivery_final_warning_sent flag to escrow_transactions
-- Tracks whether buyer received the final warning 1 day before auto-complete
ALTER TABLE escrow_transactions
  ADD COLUMN IF NOT EXISTS delivery_final_warning_sent boolean DEFAULT NULL;

COMMENT ON COLUMN escrow_transactions.delivery_final_warning_sent IS 'Set to true when final auto-complete warning email was sent to buyer (1 day before deadline)';
