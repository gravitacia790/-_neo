const { db } = require('./db');

async function ensureRatingRow(userId) {
  await db
    .prepare(
      'INSERT INTO ratings (user_id, total_score, is_public) VALUES (?, 0, 0) ON CONFLICT (user_id) DO NOTHING'
    )
    .run(userId);
}

async function addActivity(userId, type, description, points) {
  if (!userId) return;
  await ensureRatingRow(userId);
  const tx = db.transaction(async (trx) => {
    await trx.prepare('UPDATE ratings SET total_score = total_score + ? WHERE user_id = ?').run(points, userId);
    await trx
      .prepare('INSERT INTO rating_activities (user_id, type, description, points) VALUES (?, ?, ?, ?)')
      .run(
      userId,
      type,
      description,
      points
    );
    // оставим только 20 последних
    await trx.prepare(
      `DELETE FROM rating_activities WHERE user_id = ? AND id NOT IN (
        SELECT id FROM rating_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
      )`
    ).run(userId, userId);
  });
  await tx();
}

async function getRatingByUserId(userId) {
  await ensureRatingRow(userId);
  const row = await db.prepare('SELECT total_score, is_public FROM ratings WHERE user_id = ?').get(userId);
  const activities = await db
    .prepare(
      'SELECT type, description, points, created_at FROM rating_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
    )
    .all(userId);
  return {
    totalScore: row ? row.total_score : 0,
    public: row ? !!row.is_public : false,
    activities: activities.map((a) => ({
      type: a.type,
      description: a.description,
      points: a.points,
      date: a.created_at,
    })),
  };
}

async function setVisibility(userId, isPublic) {
  await ensureRatingRow(userId);
  await db.prepare('UPDATE ratings SET is_public = ? WHERE user_id = ?').run(isPublic ? 1 : 0, userId);
}

module.exports = { addActivity, getRatingByUserId, setVisibility, ensureRatingRow };
