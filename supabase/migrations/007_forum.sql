-- ============================================================
-- 007_forum.sql — Kompletní fórum pro Lokopolis
-- ============================================================

-- 1. forum_sections
CREATE TABLE IF NOT EXISTS forum_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. forum_threads
CREATE TABLE IF NOT EXISTS forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES forum_sections(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  post_count INTEGER DEFAULT 0,
  last_post_at TIMESTAMPTZ DEFAULT now(),
  last_post_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. forum_posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. forum_reactions
CREATE TABLE IF NOT EXISTS forum_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT forum_reactions_post_user_unique UNIQUE (post_id, user_id),
  CONSTRAINT forum_reactions_thread_user_unique UNIQUE (thread_id, user_id),
  CONSTRAINT forum_reactions_target_check CHECK (
    (post_id IS NOT NULL AND thread_id IS NULL) OR
    (post_id IS NULL AND thread_id IS NOT NULL)
  )
);

-- 5. forum_reports
CREATE TABLE IF NOT EXISTS forum_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. forum_bans
CREATE TABLE IF NOT EXISTS forum_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_forum_threads_section ON forum_threads(section_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_last_post ON forum_threads(last_post_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_post ON forum_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_thread ON forum_reactions(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_user ON forum_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status);
CREATE INDEX IF NOT EXISTS idx_forum_bans_user ON forum_bans(user_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE forum_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_bans ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin/mod
CREATE OR REPLACE FUNCTION is_admin_or_mod(check_uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = check_uid AND role IN ('admin', 'moderator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is forum banned
CREATE OR REPLACE FUNCTION is_forum_banned(check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM forum_bans
    WHERE user_id = check_user_id
      AND (expires_at IS NULL OR expires_at > now())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- forum_sections RLS
CREATE POLICY "forum_sections_select" ON forum_sections FOR SELECT USING (true);
CREATE POLICY "forum_sections_insert" ON forum_sections FOR INSERT WITH CHECK (
  is_admin_or_mod(auth.uid()) AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "forum_sections_update" ON forum_sections FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "forum_sections_delete" ON forum_sections FOR DELETE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- forum_threads RLS
CREATE POLICY "forum_threads_select" ON forum_threads FOR SELECT USING (true);
CREATE POLICY "forum_threads_insert" ON forum_threads FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND NOT is_forum_banned(auth.uid())
);
CREATE POLICY "forum_threads_update" ON forum_threads FOR UPDATE USING (
  auth.uid() = author_id OR is_admin_or_mod(auth.uid())
);
CREATE POLICY "forum_threads_delete" ON forum_threads FOR DELETE USING (
  is_admin_or_mod(auth.uid())
);

-- forum_posts RLS
CREATE POLICY "forum_posts_select" ON forum_posts FOR SELECT USING (
  is_hidden = false OR is_admin_or_mod(auth.uid())
);
CREATE POLICY "forum_posts_insert" ON forum_posts FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND NOT is_forum_banned(auth.uid())
  AND NOT (SELECT is_locked FROM forum_threads WHERE id = thread_id)
);
CREATE POLICY "forum_posts_update" ON forum_posts FOR UPDATE USING (
  auth.uid() = author_id OR is_admin_or_mod(auth.uid())
);
CREATE POLICY "forum_posts_delete" ON forum_posts FOR DELETE USING (
  auth.uid() = author_id OR is_admin_or_mod(auth.uid())
);

-- forum_reactions RLS
CREATE POLICY "forum_reactions_select" ON forum_reactions FOR SELECT USING (true);
CREATE POLICY "forum_reactions_insert" ON forum_reactions FOR INSERT WITH CHECK (
  auth.uid() = user_id
);
CREATE POLICY "forum_reactions_delete" ON forum_reactions FOR DELETE USING (
  auth.uid() = user_id
);

-- forum_reports RLS
CREATE POLICY "forum_reports_insert" ON forum_reports FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "forum_reports_select" ON forum_reports FOR SELECT USING (
  is_admin_or_mod(auth.uid())
);
CREATE POLICY "forum_reports_update" ON forum_reports FOR UPDATE USING (
  is_admin_or_mod(auth.uid())
);

-- forum_bans RLS
CREATE POLICY "forum_bans_select" ON forum_bans FOR SELECT USING (
  is_admin_or_mod(auth.uid()) OR auth.uid() = user_id
);
CREATE POLICY "forum_bans_insert" ON forum_bans FOR INSERT WITH CHECK (
  is_admin_or_mod(auth.uid())
);
CREATE POLICY "forum_bans_delete" ON forum_bans FOR DELETE USING (
  is_admin_or_mod(auth.uid())
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- update_updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at triggers
DROP TRIGGER IF EXISTS forum_threads_updated_at ON forum_threads;
CREATE TRIGGER forum_threads_updated_at
  BEFORE UPDATE ON forum_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS forum_posts_updated_at ON forum_posts;
CREATE TRIGGER forum_posts_updated_at
  BEFORE UPDATE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Post count & last_post triggers
CREATE OR REPLACE FUNCTION forum_post_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forum_threads SET
    post_count = post_count + 1,
    last_post_at = NEW.created_at,
    last_post_by = NEW.author_id
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION forum_post_deleted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forum_threads SET
    post_count = GREATEST(post_count - 1, 0)
  WHERE id = OLD.thread_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS forum_post_insert_trigger ON forum_posts;
CREATE TRIGGER forum_post_insert_trigger
  AFTER INSERT ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION forum_post_inserted();

DROP TRIGGER IF EXISTS forum_post_delete_trigger ON forum_posts;
CREATE TRIGGER forum_post_delete_trigger
  AFTER DELETE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION forum_post_deleted();

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_forum_stats()
RETURNS TABLE(thread_count BIGINT, post_count BIGINT) AS $$
  SELECT
    (SELECT count(*) FROM forum_threads) AS thread_count,
    (SELECT count(*) FROM forum_posts) AS post_count;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO forum_sections (name, slug, description, icon, sort_order) VALUES
('Obecná diskuze', 'obecna-diskuze', 'Povídání o všem kolem modelové železnice', '💬', 1),
('Stavba kolejiště', 'stavba-kolejiste', 'Projekty, postupy, materiály', '🏗️', 2),
('Recenze & doporučení', 'recenze-doporuceni', 'Hodnocení modelů, příslušenství a obchodů', '🔍', 3),
('Bazar', 'bazar', 'Prodám, koupím, vyměním', '🛒', 4),
('Poradna', 'poradna', 'Otázky a odpovědi pro začátečníky i pokročilé', '🆘', 5),
('Galerie & videa', 'galerie-videa', 'Sdílejte fotky a videa svých kolejišť', '📸', 6),
('Novinky ze světa', 'novinky-ze-sveta', 'Aktuality, veletrhy, nové modely', '📢', 7)
ON CONFLICT (slug) DO NOTHING;
