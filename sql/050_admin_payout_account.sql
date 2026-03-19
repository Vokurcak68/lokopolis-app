-- 050: Add admin_payout_account to escrow_settings
-- Bankovní účet kam se posílá provize (může být jiný než hlavní Lokopolis účet)
INSERT INTO escrow_settings (key, value)
VALUES ('admin_payout_account', '')
ON CONFLICT (key) DO NOTHING;
