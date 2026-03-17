-- 038: Add bank account fields to profiles for seller payouts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_iban text;
