-- 027: Add billing_name to profiles (real name for invoicing, separate from username/display_name)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_name TEXT;
