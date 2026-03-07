-- =============================================
-- 006_tags.sql — Tagging system
-- =============================================

-- Tabulka tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabulka article_tags (many-to-many)
CREATE TABLE IF NOT EXISTS article_tags (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- Indexy
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON article_tags(tag_id);

-- RLS pro tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_all" ON tags
  FOR SELECT USING (true);

CREATE POLICY "tags_insert_authenticated" ON tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tags_update_admin" ON tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "tags_delete_admin" ON tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS pro article_tags
ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "article_tags_select_all" ON article_tags
  FOR SELECT USING (true);

CREATE POLICY "article_tags_insert_owner_or_admin" ON article_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_id
      AND articles.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "article_tags_delete_owner_or_admin" ON article_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_id
      AND articles.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RPC funkce get_popular_tags
CREATE OR REPLACE FUNCTION get_popular_tags(max_results INTEGER DEFAULT 15)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  article_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    COUNT(at.article_id) AS article_count
  FROM tags t
  LEFT JOIN article_tags at ON at.tag_id = t.id
  LEFT JOIN articles a ON a.id = at.article_id AND a.status = 'published' AND a.verified = true
  GROUP BY t.id, t.name, t.slug
  HAVING COUNT(at.article_id) > 0
  ORDER BY article_count DESC
  LIMIT max_results;
$$;
