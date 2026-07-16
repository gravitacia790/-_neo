ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS entity_id BIGINT;

CREATE TABLE IF NOT EXISTS phone_visibility_requests (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_phone_visibility_requests_target_status
  ON phone_visibility_requests(target_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_visibility_requests_requester_target
  ON phone_visibility_requests(requester_id, target_id);
