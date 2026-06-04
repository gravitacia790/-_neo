const express = require('express');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const adminRequired = require('../middleware/adminRequired');
const { safe } = require('../middleware/safe');

const router = express.Router();

router.use(authRequired, adminRequired);

router.get(
  '/users',
  safe('admin')(async (req, res) => {
    const rows = await db
      .prepare(
        `
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           COALESCE(r.total_score, 0) AS total_score,
           COALESCE(r.is_public, 0) AS is_public
    FROM users u
    LEFT JOIN ratings r ON r.user_id = u.id
    WHERE u.role != 'admin'
    ORDER BY total_score DESC, u.name
  `
      )
      .all();
    const userIds = rows.map((r) => r.id);
    const lastActs = {};
    if (userIds.length) {
      const placeholders = userIds.map(() => '?').join(',');
      const acts = await db
        .prepare(
          `SELECT user_id, description, points, created_at FROM rating_activities
       WHERE user_id IN (${placeholders}) ORDER BY created_at DESC`
        )
        .all(...userIds);
      for (const a of acts) {
        if (!lastActs[a.user_id]) lastActs[a.user_id] = [];
        if (lastActs[a.user_id].length < 3) lastActs[a.user_id].push(a);
      }
    }
    res.json({
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        totalScore: r.total_score,
        public: !!r.is_public,
        createdAt: r.created_at,
        lastActivities: (lastActs[r.id] || []).map((a) => ({
          description: a.description,
          points: a.points,
          date: a.created_at,
        })),
      })),
    });
  })
);

module.exports = router;
