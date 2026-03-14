CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'new_order', 'new_review', 'new_report', 'low_stock', 'new_registration'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT, -- URL kam odkázat (např. /admin/shop?tab=objednavky)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_notif_unread ON admin_notifications(is_read) WHERE is_read = false;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_notif_select" ON admin_notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_notif_update" ON admin_notifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_notif_delete" ON admin_notifications FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Insert without auth check (server-side inserts from API routes)
CREATE POLICY "admin_notif_insert" ON admin_notifications FOR INSERT WITH CHECK (true);
