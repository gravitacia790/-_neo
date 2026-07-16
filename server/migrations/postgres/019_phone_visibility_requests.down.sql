DROP TABLE IF EXISTS phone_visibility_requests;
ALTER TABLE notifications
  DROP COLUMN IF EXISTS entity_id;
