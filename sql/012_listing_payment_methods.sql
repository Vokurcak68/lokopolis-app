ALTER TABLE listings ADD COLUMN IF NOT EXISTS payment_methods text[] DEFAULT '{}'::text[];

-- Backfill existing listings: if shipping=true, add all four; else cash+transfer
UPDATE listings SET payment_methods = CASE
  WHEN shipping = true THEN ARRAY['cash','transfer','cod','escrow']
  ELSE ARRAY['cash','transfer']
END WHERE payment_methods = '{}' OR payment_methods IS NULL;
