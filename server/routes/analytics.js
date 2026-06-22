const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { db } = require('../db');

const router = express.Router();

// Приём событий аналитики от клиента (просмотры вкладок). Лёгкая вставка;
// злоупотребление ограничено общим apiLimiter на /api.
const eventSchema = z.object({
  type: z.enum(['tab_view']),
  meta: z.string().max(60).optional().default(''),
});

router.post(
  '/event',
  authRequired,
  safe('analytics')(async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректное событие' });
    await db
      .prepare('INSERT INTO analytics_events (user_id, type, meta) VALUES (?, ?, ?)')
      .run(req.user.id, parsed.data.type, parsed.data.meta);
    res.json({ ok: true });
  })
);

module.exports = router;
