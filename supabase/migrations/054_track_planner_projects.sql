-- Track Planner projects (cloud saves per user)

CREATE TABLE IF NOT EXISTS track_planner_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS track_planner_projects_user_id_idx ON track_planner_projects(user_id);
CREATE INDEX IF NOT EXISTS track_planner_projects_user_updated_at_idx ON track_planner_projects(user_id, updated_at DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS track_planner_projects_updated_at ON track_planner_projects;
CREATE TRIGGER track_planner_projects_updated_at
  BEFORE UPDATE ON track_planner_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE track_planner_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS track_planner_projects_select_own ON track_planner_projects;
CREATE POLICY track_planner_projects_select_own ON track_planner_projects
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS track_planner_projects_insert_own ON track_planner_projects;
CREATE POLICY track_planner_projects_insert_own ON track_planner_projects
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS track_planner_projects_update_own ON track_planner_projects;
CREATE POLICY track_planner_projects_update_own ON track_planner_projects
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS track_planner_projects_delete_own ON track_planner_projects;
CREATE POLICY track_planner_projects_delete_own ON track_planner_projects
  FOR DELETE USING (user_id = auth.uid());
