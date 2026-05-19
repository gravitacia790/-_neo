const { db } = require('./db');

function ensureRatingRow(userId) {
  db.prepare('INSERT OR IGNORE INTO ratings (user_id, total_score, is_public) VALUES (?, 0, 0)').run(userId);
}

function addActivity(userId, type, description, points) {
  if (!userId) return;
  ensureRatingRow(userId);
  const tx = db.transaction(() => {
    db.prepare('UPDATE ratings SET total_score = total_score + ? WHERE user_id = ?').run(points, userId);
    db.prepare(
      'INSERT INTO rating_activities (user_id, type, description, points) VALUES (?, ?, ?, ?)'
    ).run(userId, type, description, points);
    // оставим только 20 последних
    db.prepare(
      `DELETE FROM rating_activities WHERE user_id = ? AND id NOT IN (
        SELECT id FROM rating_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
      )`
    ).run(userId, userId);
  });
  tx();
}

function getRatingByUserId(userId) {
  ensureRatingRow(userId);
  const row = db.prepare('SELECT total_score, is_public FROM ratings WHERE user_id = ?').get(userId);
  const activities = db.prepare(
    'SELECT type, description, points, created_at FROM rating_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(userId);
  return {
    totalScore: row ? row.total_score : 0,
    public: row ? !!row.is_public : false,
    activities: activities.map(a => ({
      type: a.type, description: a.description, points: a.points, date: a.created_at
    }))
  };
}

function setVisibility(userId, isPublic) {
  ensureRatingRow(userId);
  db.prepare('UPDATE ratings SET is_public = ? WHERE user_id = ?').run(isPublic ? 1 : 0, userId);
}

module.exports = { addActivity, getRatingByUserId, setVisibility, ensureRatingRow };
