-- ============================================================
-- 005_article_views.sql — Počítadlo zobrazení článků
-- ============================================================
-- NESPOUŠTĚT AUTOMATICKY — zkopírovat do Supabase SQL editoru

-- 1. Sloupec view_count na articles (celkový počet)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 2. Tabulka article_views — záznamy zobrazení s timestampem (pro měsíční statistiky)
CREATE TABLE IF NOT EXISTS article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_article_views_article_id ON article_views(article_id);
CREATE INDEX idx_article_views_viewed_at ON article_views(viewed_at DESC);

-- 3. RLS — kdokoliv může vložit view, nikdo nemůže číst/mazat
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "article_views_insert_anyone" ON article_views
  FOR INSERT WITH CHECK (true);

-- Admin může číst (pro statistiky)
CREATE POLICY "article_views_select_admin" ON article_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. RPC funkce — inkrementuje view_count a vloží záznam do article_views
CREATE OR REPLACE FUNCTION increment_article_view(target_article_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Inkrementovat celkový counter
  UPDATE articles
  SET view_count = view_count + 1
  WHERE id = target_article_id;

  -- Vložit záznam pro měsíční statistiky
  INSERT INTO article_views (article_id) VALUES (target_article_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC funkce — populární články za posledních N dní
CREATE OR REPLACE FUNCTION get_popular_articles(days_back INTEGER DEFAULT 30, max_results INTEGER DEFAULT 4)
RETURNS TABLE (
  article_id UUID,
  view_count_period BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    av.article_id,
    COUNT(*) AS view_count_period
  FROM article_views av
  JOIN articles a ON a.id = av.article_id
  WHERE av.viewed_at >= now() - (days_back || ' days')::INTERVAL
    AND a.status = 'published'
    AND a.verified = true
  GROUP BY av.article_id
  ORDER BY view_count_period DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
