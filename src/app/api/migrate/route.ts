import { NextResponse } from "next/server";

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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      error: "Missing env vars",
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceKey,
    }, { status: 500 });
  }

  // Use Supabase's built-in pg_net or direct SQL via PostgREST's /rest/v1/rpc
  // First, create an exec_sql function, then use it
  const createFnRes = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: "SELECT 1" }),
  });

  // If rpc/query doesn't exist, we need to use the SQL endpoint directly
  // Supabase has a /pg endpoint for service role
  const sqlRes = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  // The actual way: use the Supabase Management API pg endpoint
  // But that needs a different token. Let's try the raw SQL approach via
  // creating an rpc function first using the service role key.

  // Step 1: Create a helper function via PostgREST
  // Actually, the simplest way is to use the Supabase client's .rpc()
  // but we need the function to exist first.

  // Let's try a completely different approach: use the pooler with transaction mode
  try {
    const { Client } = await import("pg");

    // Try multiple connection methods
    const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
    const password = process.env.DB_PASSWORD || "01Vok412@@@@";

    const connectionStrings = [
      // Session mode pooler
      `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`,
      // Transaction mode pooler
      `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`,
      // Direct
      `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`,
    ];

    let lastError = "";
    for (const connStr of connectionStrings) {
      try {
        const client = new Client({ connectionString: connStr });
        await client.connect();
        await client.query(MIGRATION_SQL);

        const catRes = await client.query("SELECT count(*) as c FROM categories");
        const tabRes = await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        );

        await client.end();

        return NextResponse.json({
          success: true,
          method: connStr.includes("pooler") ? "pooler" : "direct",
          categories: catRes.rows[0].c,
          tables: tabRes.rows.map((r: { table_name: string }) => r.table_name),
        });
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
        continue;
      }
    }

    return NextResponse.json({
      error: "All connection methods failed",
      lastError,
      debug: { projectRef, rpcTest: createFnRes.status, restTest: sqlRes.status },
    }, { status: 500 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
