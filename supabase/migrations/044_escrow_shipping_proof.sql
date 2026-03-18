-- Shipping proof photos & AI photo verification for escrow transactions
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS shipping_proof_urls text[] DEFAULT '{}';
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS photo_verification jsonb;
