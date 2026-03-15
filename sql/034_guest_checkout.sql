-- 034: Guest checkout support
-- Allow orders without user account (guest_email required when no user_id)

-- 1. Make user_id NULLABLE (was NOT NULL with FK to profiles)
ALTER TABLE shop_orders ALTER COLUMN user_id DROP NOT NULL;

-- 2. Make product_id NULLABLE (multi-item orders don't always have a single product_id)
ALTER TABLE shop_orders ALTER COLUMN product_id DROP NOT NULL;

-- 3. Add guest columns
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 4. CHECK: either user_id or guest_email must be set
ALTER TABLE shop_orders ADD CONSTRAINT chk_order_has_customer
  CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

-- 5. Update RLS policies to allow guest order reads via service role
-- (Guest orders are inserted via service role, so INSERT policy doesn't need change)
-- But we need to allow anon reads of guest orders by order_number for the confirmation page

-- Drop old policies
DROP POLICY IF EXISTS "orders_read" ON shop_orders;
DROP POLICY IF EXISTS "orders_insert" ON shop_orders;

-- New read policy: user can see own orders, admin can see all
-- Guest orders (user_id IS NULL) are only accessible via service role or admin
CREATE POLICY "orders_read" ON shop_orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- New insert policy: logged-in user can insert own orders
-- Guest orders are inserted via service role (bypasses RLS)
CREATE POLICY "orders_insert" ON shop_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Also update order_items RLS to handle guest orders
DROP POLICY IF EXISTS "order_items_user" ON order_items;
CREATE POLICY "order_items_user" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shop_orders
      WHERE id = order_items.order_id
      AND (user_id = auth.uid() OR user_id IS NULL)
    )
  );

-- 7. Index on guest_email for admin lookups
CREATE INDEX IF NOT EXISTS idx_shop_orders_guest_email ON shop_orders(guest_email) WHERE guest_email IS NOT NULL;
