CREATE TABLE IF NOT EXISTS director_ai_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_director_ai_profiles_updated
  ON director_ai_profiles(updated_at);

CREATE TABLE IF NOT EXISTS ai_search_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  matched_director_ids TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
