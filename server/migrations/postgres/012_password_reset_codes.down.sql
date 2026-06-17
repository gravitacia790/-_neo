DROP INDEX IF EXISTS idx_reset_user_active;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS channel;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS attempts;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS code_hash;
