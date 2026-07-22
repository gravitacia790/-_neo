CREATE TABLE IF NOT EXISTS development_tracks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  focus_area TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS development_actions (
  id BIGSERIAL PRIMARY KEY,
  track_id BIGINT NOT NULL REFERENCES development_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  week_number INTEGER NOT NULL DEFAULT 1 CHECK (week_number BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS development_reflections (
  id BIGSERIAL PRIMARY KEY,
  track_id BIGINT NOT NULL REFERENCES development_tracks(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_id BIGINT REFERENCES development_actions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_development_tracks_user_status ON development_tracks(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_development_actions_track_week ON development_actions(track_id, week_number, id);
CREATE INDEX IF NOT EXISTS idx_development_reflections_track_created ON development_reflections(track_id, created_at DESC);
