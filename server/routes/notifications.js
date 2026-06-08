const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');

const router = express.Router();
const markReadSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).max(200).optional().default([]),
});

router.get('/', authRequired, safe('notifications')(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const offset = (page - 1) * limit;

  const totalRow = await db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?')
    .get(req.user.id);
  const total = Number(totalRow.c);

  const unreadRow = await db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(req.user.id);
  const unread = Number(unreadRow.c);

  const items = await db
    .prepare(
      'SELECT id, type, title, message, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    .all(req.user.id, limit, offset);

  res.json({
    items,
    unread,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

router.put('/read', authRequired, safe('notifications')(async (req, res) => {
  const parsed = markReadSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
  const ids = parsed.data.ids;
  if (Array.isArray(ids) && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    await db.prepare(
      `UPDATE notifications SET read = 1 WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, req.user.id);
  }
  res.json({ ok: true });
}));

router.put('/read-all', authRequired, safe('notifications')(async (req, res) => {
  await db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
