DROP INDEX IF EXISTS idx_profiles_max_user_id;
DROP INDEX IF EXISTS idx_max_link_user;
DROP INDEX IF EXISTS idx_max_link_nonce;
DROP TABLE IF EXISTS max_link_tokens;
ALTER TABLE profiles DROP COLUMN IF EXISTS max_username;
ALTER TABLE profiles DROP COLUMN IF EXISTS max_user_id;
