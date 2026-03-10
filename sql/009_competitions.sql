-- 009: Competitions (Kolejiště měsíce)

-- Soutěže
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  month TEXT NOT NULL, -- format: '2026-03'
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'voting', 'finished')),
  prize TEXT,
  winner_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Přihlášky do soutěže
CREATE TABLE competition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  scale TEXT,
  dimensions TEXT,
  landscape TEXT,
  vote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

-- Foreign key pro winner_id (competition_entries musí existovat)
ALTER TABLE competitions ADD CONSTRAINT fk_winner FOREIGN KEY (winner_id) REFERENCES competition_entries(id) ON DELETE SET NULL;

-- Hlasy
CREATE TABLE competition_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_id, user_id) -- 1 vote per user per competition
);

-- Trigger: update vote_count on entries
CREATE OR REPLACE FUNCTION update_entry_vote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE competition_entries SET vote_count = vote_count + 1 WHERE id = NEW.entry_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE competition_entries SET vote_count = vote_count - 1 WHERE id = OLD.entry_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vote_count
AFTER INSERT OR DELETE ON competition_votes
FOR EACH ROW EXECUTE FUNCTION update_entry_vote_count();

-- RLS
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_votes ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "competitions_read" ON competitions FOR SELECT USING (true);
CREATE POLICY "entries_read" ON competition_entries FOR SELECT USING (true);
CREATE POLICY "votes_read" ON competition_votes FOR SELECT USING (true);

-- Admin can manage competitions
CREATE POLICY "competitions_admin" ON competitions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Authenticated users can create entries
CREATE POLICY "entries_insert" ON competition_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update" ON competition_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "entries_delete" ON competition_entries FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Authenticated users can vote (not for themselves)
CREATE POLICY "votes_insert" ON competition_votes FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  NOT EXISTS (SELECT 1 FROM competition_entries WHERE id = entry_id AND user_id = auth.uid())
);
CREATE POLICY "votes_delete" ON competition_votes FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_entries_competition ON competition_entries(competition_id);
CREATE INDEX idx_entries_votes ON competition_entries(competition_id, vote_count DESC);
CREATE INDEX idx_votes_entry ON competition_votes(entry_id);
CREATE INDEX idx_votes_user_comp ON competition_votes(competition_id, user_id);
CREATE INDEX idx_competitions_status ON competitions(status);
