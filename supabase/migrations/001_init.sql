-- ================================================
-- Lokopolis — Inicializační migrace
-- ================================================
-- NESPOUŠTĚT AUTOMATICKY — zkopírovat do Supabase SQL editoru

-- ------------------------------------------------
-- 1. Tabulky
-- ------------------------------------------------

-- profiles (rozšíření auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'author', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  excerpt TEXT,
  cover_image_url TEXT,
  category_id UUID REFERENCES categories(id),
  author_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------
-- 2. Indexy
-- ------------------------------------------------

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_author ON articles(author_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_comments_article ON comments(article_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_sort ON categories(sort_order);

-- ------------------------------------------------
-- 3. Row Level Security (RLS)
-- ------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles: kdokoliv může číst, uživatel může upravovat svůj vlastní
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Categories: kdokoliv může číst, pouze admin může měnit
CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (true);

CREATE POLICY "categories_admin_insert" ON categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "categories_admin_update" ON categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Articles: veřejné čtení publikovaných, autoři mohou vytvářet a editovat své
CREATE POLICY "articles_select_published" ON articles
  FOR SELECT USING (
    status = 'published'
    OR author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

CREATE POLICY "articles_insert" ON articles
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('author', 'moderator', 'admin'))
  );

CREATE POLICY "articles_update_own" ON articles
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- Comments: kdokoliv může číst publikované, přihlášení mohou přidávat
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (
    status = 'published'
    OR author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

CREATE POLICY "comments_insert" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "comments_update_own" ON comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

CREATE POLICY "comments_delete_own" ON comments
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- ------------------------------------------------
-- 4. Trigger pro updated_at
-- ------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------
-- 5. Trigger pro automatické vytvoření profilu při registraci
-- ------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------
-- 6. Seed data — 12 kategorií
-- ------------------------------------------------

INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
  ('Stavba kolejiště', 'stavba-kolejiste', 'Plánování, podklady, kolejivo a konstrukce kolejišť', '🛤️', 1),
  ('Modelové domy', 'modelove-domy', 'Stavebnice, kitbashing a scratch-building budov', '🏠', 2),
  ('Krajina a zeleň', 'krajina-a-zelen', 'Terén, stromy, tráva, vodní plochy a sezónní efekty', '🌿', 3),
  ('Elektronika', 'elektronika', 'Obvody, napájení, spínání a automatizace', '⚡', 4),
  ('Digitální řízení', 'digitalni-rizeni', 'DCC, dekodéry, centrály a počítačové řízení', '🖥️', 5),
  ('Recenze', 'recenze', 'Hodnocení modelů, příslušenství a nástrojů', '⭐', 6),
  ('Kolejové plány', 'kolejove-plany', 'Návrhy tratí, inspirace a plánování layoutů', '📐', 7),
  ('Nátěry a patina', 'natery-a-patina', 'Stříkání, weathering, patinování a detailing', '🎨', 8),
  ('Osvětlení', 'osvetleni', 'LED, optická vlákna, denní a noční scény', '💡', 9),
  ('3D tisk', '3d-tisk', 'Modelování, tisk a postprocessing pro železnici', '🖨️', 10),
  ('Tipy a triky', 'tipy-a-triky', 'Praktické rady, postupy a life-hacky', '💡', 11),
  ('Ze světa', 'ze-sveta', 'Novinky, výstavy, události a zahraniční scéna', '🌍', 12);
