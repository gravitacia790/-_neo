-- Привязка аккаунта MAX к профилю директора для доставки уведомлений/кодов.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_user_id BIGINT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_username TEXT;

-- Одноразовые nonce для deep-link привязки (передаются боту как start-payload).
CREATE TABLE IF NOT EXISTS max_link_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nonce TEXT NOT NULL UNIQUE,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_max_link_nonce ON max_link_tokens(nonce);
CREATE INDEX IF NOT EXISTS idx_max_link_user ON max_link_tokens(user_id, used);
CREATE INDEX IF NOT EXISTS idx_profiles_max_user_id ON profiles(max_user_id);
