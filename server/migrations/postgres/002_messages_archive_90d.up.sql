CREATE TABLE IF NOT EXISTS messages_archive (
  archive_id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL,
  from_user_id BIGINT NOT NULL,
  to_user_id BIGINT NOT NULL,
  text TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_archive_message_id
  ON messages_archive(message_id);

CREATE INDEX IF NOT EXISTS idx_messages_archive_to_created
  ON messages_archive(to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_archive_from_created
  ON messages_archive(from_user_id, created_at DESC);
