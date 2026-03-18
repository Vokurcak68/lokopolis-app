-- 041: Add shieldtrack_shipment_id to escrow_transactions
ALTER TABLE escrow_transactions
ADD COLUMN IF NOT EXISTS shieldtrack_shipment_id UUID DEFAULT NULL;

COMMENT ON COLUMN escrow_transactions.shieldtrack_shipment_id IS 'ShieldTrack shipment ID for delivery verification';
