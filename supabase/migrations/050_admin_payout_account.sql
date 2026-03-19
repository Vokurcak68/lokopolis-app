-- Add admin_payout_account setting (bank account for commission payouts)
INSERT INTO escrow_settings (key, value)
VALUES ('admin_payout_account', '')
ON CONFLICT (key) DO NOTHING;
