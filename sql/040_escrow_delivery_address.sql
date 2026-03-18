-- 040: Add delivery_address to escrow_transactions (buyer's shipping address)
ALTER TABLE escrow_transactions
ADD COLUMN IF NOT EXISTS delivery_address JSONB DEFAULT NULL;

COMMENT ON COLUMN escrow_transactions.delivery_address IS 'Buyer delivery address: {name, street, city, zip, phone}';
