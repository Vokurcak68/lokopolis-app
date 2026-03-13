-- 017_inventory.sql - Inventory management system
-- Add inventory columns to shop_products
ALTER TABLE shop_products
  ADD COLUMN stock_mode TEXT NOT NULL DEFAULT 'unlimited'
    CHECK (stock_mode IN ('unlimited', 'tracked', 'preorder')),
  ADD COLUMN stock_quantity INTEGER,
  ADD COLUMN stock_reserved INTEGER DEFAULT 0,
  ADD COLUMN stock_alert_threshold INTEGER DEFAULT 5,
  ADD COLUMN max_per_order INTEGER DEFAULT NULL;

-- Constraint: reserved can't exceed quantity for tracked items
ALTER TABLE shop_products
  ADD CONSTRAINT stock_reserved_valid 
    CHECK (
      stock_mode != 'tracked' 
      OR stock_reserved IS NULL 
      OR stock_quantity IS NULL 
      OR (stock_reserved >= 0 AND stock_reserved <= stock_quantity)
    );

-- Stock movements audit table
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('reserve', 'release', 'sale', 'restock', 'adjustment', 'return')),
  quantity INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  reserved_before INTEGER,
  reserved_after INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_order ON stock_movements(order_id);

-- RLS for stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stock movements"
  ON stock_movements FOR SELECT
  USING (true);

CREATE POLICY "Admin insert stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function: atomic stock reservation
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
  v_available INTEGER;
BEGIN
  -- Lock row
  SELECT id, stock_mode, stock_quantity, stock_reserved
  INTO v_product
  FROM shop_products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  -- Check availability
  IF v_product.stock_mode = 'tracked' THEN
    v_available := COALESCE(v_product.stock_quantity, 0) - COALESCE(v_product.stock_reserved, 0);
    IF v_available < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock', 'available', v_available);
    END IF;

    -- Reserve
    UPDATE shop_products
    SET stock_reserved = COALESCE(stock_reserved, 0) + p_quantity
    WHERE id = p_product_id;

    -- Log movement
    INSERT INTO stock_movements (product_id, order_id, movement_type, quantity, quantity_before, quantity_after, reserved_before, reserved_after)
    VALUES (
      p_product_id,
      p_order_id,
      'reserve',
      p_quantity,
      v_product.stock_quantity,
      v_product.stock_quantity,
      v_product.stock_reserved,
      COALESCE(v_product.stock_reserved, 0) + p_quantity
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function: release reserved stock
CREATE OR REPLACE FUNCTION release_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
BEGIN
  SELECT id, stock_mode, stock_quantity, stock_reserved
  INTO v_product
  FROM shop_products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF v_product.stock_mode = 'tracked' THEN
    UPDATE shop_products
    SET stock_reserved = GREATEST(0, COALESCE(stock_reserved, 0) - p_quantity)
    WHERE id = p_product_id;

    INSERT INTO stock_movements (product_id, order_id, movement_type, quantity, quantity_before, quantity_after, reserved_before, reserved_after)
    VALUES (
      p_product_id,
      p_order_id,
      'release',
      p_quantity,
      v_product.stock_quantity,
      v_product.stock_quantity,
      v_product.stock_reserved,
      GREATEST(0, COALESCE(v_product.stock_reserved, 0) - p_quantity)
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function: confirm sale (deduct from quantity + reserved)
CREATE OR REPLACE FUNCTION confirm_sale(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
BEGIN
  SELECT id, stock_mode, stock_quantity, stock_reserved
  INTO v_product
  FROM shop_products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF v_product.stock_mode = 'tracked' THEN
    UPDATE shop_products
    SET 
      stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - p_quantity),
      stock_reserved = GREATEST(0, COALESCE(stock_reserved, 0) - p_quantity)
    WHERE id = p_product_id;

    INSERT INTO stock_movements (product_id, order_id, movement_type, quantity, quantity_before, quantity_after, reserved_before, reserved_after, created_by)
    VALUES (
      p_product_id,
      p_order_id,
      'sale',
      p_quantity,
      v_product.stock_quantity,
      GREATEST(0, COALESCE(v_product.stock_quantity, 0) - p_quantity),
      v_product.stock_reserved,
      GREATEST(0, COALESCE(v_product.stock_reserved, 0) - p_quantity),
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function: restock (admin only)
CREATE OR REPLACE FUNCTION restock_product(
  p_product_id UUID,
  p_quantity INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Check admin
  SELECT role = 'admin' INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Lock row
  SELECT id, stock_mode, stock_quantity, stock_reserved
  INTO v_product
  FROM shop_products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF v_product.stock_mode = 'tracked' THEN
    UPDATE shop_products
    SET stock_quantity = COALESCE(stock_quantity, 0) + p_quantity
    WHERE id = p_product_id;

    INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reserved_before, reserved_after, notes, created_by)
    VALUES (
      p_product_id,
      'restock',
      p_quantity,
      v_product.stock_quantity,
      COALESCE(v_product.stock_quantity, 0) + p_quantity,
      v_product.stock_reserved,
      v_product.stock_reserved,
      p_notes,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
