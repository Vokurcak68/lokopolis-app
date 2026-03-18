-- 042: ShieldTrack admin data + hold podpora
-- Cached ShieldTrack data v escrow_transactions
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS st_score integer;
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS st_status text;
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS st_alert_sent boolean DEFAULT false;
-- Hold support
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS hold_reason text;
