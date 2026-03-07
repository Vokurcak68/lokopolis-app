-- ============================================================
-- 004_events.sql — Events (Akce)
-- ============================================================

-- Tabulka events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  end_date DATE,
  location TEXT,
  url TEXT,
  cover_image_url TEXT,
  access TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'authenticated')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at (reuse existing function)
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- SELECT: public events → everyone; authenticated events → only logged-in users
CREATE POLICY "events_select_public"
  ON events FOR SELECT
  USING (access = 'public');

CREATE POLICY "events_select_authenticated"
  ON events FOR SELECT
  TO authenticated
  USING (access = 'authenticated');

-- INSERT: only admin
CREATE POLICY "events_insert_admin"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- UPDATE: only admin
CREATE POLICY "events_update_admin"
  ON events FOR UPDATE
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

-- DELETE: only admin
CREATE POLICY "events_delete_admin"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
