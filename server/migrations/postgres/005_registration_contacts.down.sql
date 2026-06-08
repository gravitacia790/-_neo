ALTER TABLE event_registrations
  DROP COLUMN IF EXISTS city;

ALTER TABLE extra_registrations
  DROP COLUMN IF EXISTS city;

ALTER TABLE event_registrations
  DROP COLUMN IF EXISTS phone;

ALTER TABLE extra_registrations
  DROP COLUMN IF EXISTS phone;
