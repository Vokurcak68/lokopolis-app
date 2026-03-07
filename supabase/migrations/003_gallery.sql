-- ============================================================
-- 003_gallery.sql — Galerie (images, videos, YouTube)
-- ============================================================

-- 1. Tabulka gallery_items
CREATE TABLE IF NOT EXISTS gallery_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL CHECK (type IN ('image', 'video', 'youtube')),
  media_url   TEXT NOT NULL,
  thumbnail_url TEXT,
  access      TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'authenticated')),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Trigger updated_at (reuse existing function)
CREATE TRIGGER gallery_items_updated_at
  BEFORE UPDATE ON gallery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 3. RLS
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- SELECT: public items → everyone; authenticated items → logged-in users
CREATE POLICY "gallery_select_public"
  ON gallery_items FOR SELECT
  USING (access = 'public');

CREATE POLICY "gallery_select_authenticated"
  ON gallery_items FOR SELECT
  TO authenticated
  USING (access = 'authenticated');

-- INSERT: admin only
CREATE POLICY "gallery_insert_admin"
  ON gallery_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- UPDATE: admin only
CREATE POLICY "gallery_update_admin"
  ON gallery_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- DELETE: admin only
CREATE POLICY "gallery_delete_admin"
  ON gallery_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 4. Storage bucket "gallery"
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bucket "gallery"
-- Public read
CREATE POLICY "gallery_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

-- Admin upload
CREATE POLICY "gallery_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Admin update
CREATE POLICY "gallery_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'gallery'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Admin delete
CREATE POLICY "gallery_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'gallery'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
