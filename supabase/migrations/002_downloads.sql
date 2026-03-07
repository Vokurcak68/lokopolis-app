-- ================================================
-- Lokopolis — Downloads migrace
-- ================================================
-- NESPOUŠTĚT AUTOMATICKY — zkopírovat do Supabase SQL editoru

-- ------------------------------------------------
-- 1. Tabulka downloads
-- ------------------------------------------------

CREATE TABLE downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  thumbnail_url TEXT,
  category TEXT CHECK (category IN ('kolejovy-plan', 'stl-model', '3d-tisk', 'navod', 'software', 'ostatni')),
  access TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'authenticated')),
  download_count INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------
-- 2. Indexy
-- ------------------------------------------------

CREATE INDEX idx_downloads_category ON downloads(category);
CREATE INDEX idx_downloads_access ON downloads(access);
CREATE INDEX idx_downloads_created_at ON downloads(created_at DESC);

-- ------------------------------------------------
-- 3. Trigger pro updated_at (využívá existující funkci z 001_init.sql)
-- ------------------------------------------------

CREATE TRIGGER downloads_updated_at
  BEFORE UPDATE ON downloads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------
-- 4. Row Level Security (RLS)
-- ------------------------------------------------

ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

-- SELECT: veřejné soubory vidí všichni, authenticated soubory jen přihlášení
CREATE POLICY "downloads_select_public" ON downloads
  FOR SELECT USING (
    access = 'public'
    OR (access = 'authenticated' AND auth.uid() IS NOT NULL)
  );

-- INSERT: pouze admin
CREATE POLICY "downloads_insert_admin" ON downloads
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE: pouze admin
CREATE POLICY "downloads_update_admin" ON downloads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE: pouze admin
CREATE POLICY "downloads_delete_admin" ON downloads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ------------------------------------------------
-- 5. RPC pro inkrementaci download_count (volá kdokoliv kdo vidí soubor)
-- ------------------------------------------------

CREATE OR REPLACE FUNCTION increment_download_count(download_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE downloads
  SET download_count = download_count + 1
  WHERE id = download_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------
-- 6. Storage bucket pro soubory ke stažení
-- ------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('downloads', 'downloads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: veřejné čtení, upload/delete jen admin
CREATE POLICY "downloads_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'downloads');

CREATE POLICY "downloads_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'downloads'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "downloads_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'downloads'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
