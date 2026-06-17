CREATE INDEX IF NOT EXISTS idx_events_public_created
  ON events(status, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_regs_registered_by
  ON event_registrations(registered_by, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_extra_regs_registered_by
  ON extra_registrations(registered_by, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_to_read_created
  ON messages(to_user_id, read, created_at DESC);
