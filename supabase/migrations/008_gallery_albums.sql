-- ============================================================
-- 008_gallery_albums.sql — Gallery Albums (album-based gallery)
-- ============================================================

-- 1. Tabulka gallery_albums
CREATE TABLE IF NOT EXISTS gallery_albums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  access          TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'authenticated')),
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  item_count      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Trigger updated_at (reuse existing function)
CREATE TRIGGER gallery_albums_updated_at
  BEFORE UPDATE ON gallery_albums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 3. Add album_id to gallery_items
ALTER TABLE gallery_items
  ADD COLUMN album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE;

-- 4. RLS for gallery_albums
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;

-- SELECT: public albums → everyone
CREATE POLICY "gallery_albums_select_public"
  ON gallery_albums FOR SELECT
  USING (access = 'public');

-- SELECT: authenticated albums → logged-in users
CREATE POLICY "gallery_albums_select_authenticated"
  ON gallery_albums FOR SELECT
  TO authenticated
  USING (access = 'authenticated');

-- INSERT: admin only
CREATE POLICY "gallery_albums_insert_admin"
  ON gallery_albums FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- UPDATE: admin only
CREATE POLICY "gallery_albums_update_admin"
  ON gallery_albums FOR UPDATE
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
CREATE POLICY "gallery_albums_delete_admin"
  ON gallery_albums FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 5. Trigger to update item_count on gallery_albums
CREATE OR REPLACE FUNCTION update_gallery_album_item_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE gallery_albums
      SET item_count = (SELECT COUNT(*) FROM gallery_items WHERE album_id = NEW.album_id),
          updated_at = now()
      WHERE id = NEW.album_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE gallery_albums
      SET item_count = (SELECT COUNT(*) FROM gallery_items WHERE album_id = OLD.album_id),
          updated_at = now()
      WHERE id = OLD.album_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If album_id changed, update both old and new album
    IF OLD.album_id IS DISTINCT FROM NEW.album_id THEN
      IF OLD.album_id IS NOT NULL THEN
        UPDATE gallery_albums
          SET item_count = (SELECT COUNT(*) FROM gallery_items WHERE album_id = OLD.album_id),
              updated_at = now()
          WHERE id = OLD.album_id;
      END IF;
      IF NEW.album_id IS NOT NULL THEN
        UPDATE gallery_albums
          SET item_count = (SELECT COUNT(*) FROM gallery_items WHERE album_id = NEW.album_id),
              updated_at = now()
          WHERE id = NEW.album_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gallery_items_album_count
  AFTER INSERT OR UPDATE OR DELETE ON gallery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_album_item_count();
