CREATE INDEX IF NOT EXISTS idx_director_favorites_user_director_created
ON director_favorites(user_id, director_id, created_at);

