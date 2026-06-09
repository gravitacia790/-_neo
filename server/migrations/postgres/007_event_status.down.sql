DROP INDEX IF EXISTS idx_events_status_created;

ALTER TABLE events DROP COLUMN IF EXISTS updated_at;
ALTER TABLE events DROP COLUMN IF EXISTS status;
