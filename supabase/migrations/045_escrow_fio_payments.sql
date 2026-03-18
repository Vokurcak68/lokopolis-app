-- 045: FIO incoming payments log for escrow pairing
-- Stores processed bank transactions to ensure idempotent payment processing.

CREATE TABLE IF NOT EXISTS escrow_bank_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_tx_id text UNIQUE NOT NULL,
  escrow_id uuid REFERENCES escrow_transactions(id) ON DELETE SET NULL,
  payment_reference text,
  variable_symbol text,
  amount numeric(12,2) NOT NULL,
  currency text,
  paid_at timestamptz,
  matched boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'new', -- new | partial | paid | overpaid | ignored | error
  raw jsonb NOT NULL,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_bank_payments_escrow_id ON escrow_bank_payments(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_bank_payments_variable_symbol ON escrow_bank_payments(variable_symbol);
CREATE INDEX IF NOT EXISTS idx_escrow_bank_payments_created_at ON escrow_bank_payments(created_at DESC);
