import { NextResponse } from "next/server";
import { Client } from "pg";

const MIGRATION_SQL = `
-- === PROFILES ===
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'author', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === CATEGORIES ===
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === ARTICLES ===
CREATE TABLE IF NOT EXISTS articles (
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

-- === COMMENTS ===
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- === ENABLE RLS ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- === RLS POLICIES ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_read_all') THEN
    CREATE POLICY profiles_read_all ON profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'categories_read_all') THEN
    CREATE POLICY categories_read_all ON categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'articles_read_published') THEN
    CREATE POLICY articles_read_published ON articles FOR SELECT USING (status = 'published' OR auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'articles_insert_auth') THEN
    CREATE POLICY articles_insert_auth ON articles FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'articles_update_own') THEN
    CREATE POLICY articles_update_own ON articles FOR UPDATE USING (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_read_all') THEN
    CREATE POLICY comments_read_all ON comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_insert_auth') THEN
    CREATE POLICY comments_insert_auth ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

-- === TRIGGER: updated_at ===
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_profiles') THEN
    CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_articles') THEN
    CREATE TRIGGER set_updated_at_articles BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- === TRIGGER: auto-create profile on signup ===
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$ BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;

-- === SEED: Categories ===
INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
  ('Stavba kolejiště', 'stavba-kolejiste', 'Plánování, podklady, kolejivo a konstrukce kolejišť', '🏗️', 1),
  ('Recenze modelů', 'recenze', 'Hodnocení modelů, příslušenství a nástrojů', '🔍', 2),
  ('Návody & tipy', 'navody-a-tipy', 'Praktické rady, postupy a life-hacky', '🔧', 3),
  ('Krajina & scenérie', 'krajina-a-zelen', 'Terén, stromy, tráva, vodní plochy a sezónní efekty', '🎨', 4),
  ('Digitalizace', 'digitalni-rizeni', 'DCC, dekodéry, centrály a počítačové řízení', '⚡', 5),
  ('Přestavby', 'prestavby', 'Úpravy a konverze modelů', '🚃', 6),
  ('Kolejové plány', 'kolejove-plany', 'Návrhy tratí, inspirace a plánování layoutů', '📐', 7),
  ('Modelové domy', 'modelove-domy', 'Stavebnice, kitbashing a scratch-building budov', '🏠', 8),
  ('Nátěry & patina', 'natery-a-patina', 'Stříkání, weathering, patinování a detailing', '🖌️', 9),
  ('Osvětlení', 'osvetleni', 'LED, optická vlákna, denní a noční scény', '💡', 10),
  ('3D tisk', '3d-tisk', 'Modelování, tisk a postprocessing pro železnici', '🖨️', 11),
  ('Ze světa', 'ze-sveta', 'Novinky, výstavy, události a zahraniční scéna', '🌍', 12)
ON CONFLICT (slug) DO NOTHING;
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "lokopolis2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  }

  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
  const dbPassword = process.env.DB_PASSWORD || "01Vok412@@@@";

  const client = new Client({
    host: "db." + projectRef + ".supabase.co",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(MIGRATION_SQL);

    const catRes = await client.query("SELECT count(*) as c FROM categories");
    const tabRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );

    await client.end();

    return NextResponse.json({
      success: true,
      categories: catRes.rows[0].c,
      tables: tabRes.rows.map((r: { table_name: string }) => r.table_name),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await client.end().catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
