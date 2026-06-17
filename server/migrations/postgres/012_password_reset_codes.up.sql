-- OTP-коды восстановления пароля: код хранится только в виде sha256-хэша.
-- token остаётся непрозрачным id записи (NOT NULL/UNIQUE), code_hash — проверяемый код.
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS channel TEXT;
CREATE INDEX IF NOT EXISTS idx_reset_user_active ON password_reset_tokens(user_id, used, created_at DESC);
