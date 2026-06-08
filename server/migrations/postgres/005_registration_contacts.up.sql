ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE extra_registrations
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE extra_registrations
  ADD COLUMN IF NOT EXISTS city TEXT;
