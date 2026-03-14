-- Product attachments (downloadable files linked to a product)
CREATE TABLE product_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- e.g. "Návod k použití", "Produktový list"
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_name TEXT NOT NULL, -- original filename
  file_size INTEGER, -- in bytes
  file_type TEXT, -- pdf, zip, etc.
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_product_attachments_product ON product_attachments(product_id);

-- RLS
ALTER TABLE product_attachments ENABLE ROW LEVEL SECURITY;

-- Everyone can read attachments of active products
CREATE POLICY "product_attachments_read" ON product_attachments
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "product_attachments_admin_insert" ON product_attachments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "product_attachments_admin_update" ON product_attachments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "product_attachments_admin_delete" ON product_attachments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
