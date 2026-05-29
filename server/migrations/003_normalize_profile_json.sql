CREATE TABLE IF NOT EXISTS profile_strengths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_strengths_user ON profile_strengths(user_id);

CREATE TABLE IF NOT EXISTS profile_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'Средний',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_skills_user ON profile_skills(user_id);

CREATE TABLE IF NOT EXISTS profile_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_tags_user ON profile_tags(user_id);

-- Миграция данных из JSON-колонок в новые таблицы
INSERT OR IGNORE INTO profile_strengths (user_id, name, value)
  SELECT user_id, json_extract(value, '$.name'), json_extract(value, '$.val')
  FROM profiles, json_each(profiles.strengths);

INSERT OR IGNORE INTO profile_skills (user_id, name, level)
  SELECT user_id, json_extract(value, '$.name'), json_extract(value, '$.level')
  FROM profiles, json_each(profiles.skills);

INSERT OR IGNORE INTO profile_tags (user_id, tag)
  SELECT user_id, value
  FROM profiles, json_each(profiles.tags);
