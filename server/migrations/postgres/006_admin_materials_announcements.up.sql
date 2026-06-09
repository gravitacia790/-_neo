CREATE TABLE IF NOT EXISTS seminar_materials (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'gl',
  event_id TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seminar_materials_category ON seminar_materials(category, published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seminar_materials_event ON seminar_materials(event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
