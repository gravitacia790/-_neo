const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const adminRequired = require('../middleware/adminRequired');
const { safe } = require('../middleware/safe');
const aiSearchService = require('../services/aiSearchService');

const router = express.Router();

const searchSchema = z.object({
  query: z.string().min(8).max(1000),
});

router.post(
  '/search',
  authRequired,
  safe('ai')(async (req, res) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Опишите задачу подробнее' });
    try {
      res.json(await aiSearchService.searchDirectors(req.user, parsed.data.query));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'AI-поиск временно недоступен' });
    }
  })
);

router.post(
  '/reindex/me',
  authRequired,
  safe('ai')(async (req, res) => {
    res.json(await aiSearchService.reindexDirectorAi(req.user.id));
  })
);

router.post(
  '/reindex-all',
  authRequired,
  adminRequired,
  safe('ai')(async (req, res) => {
    try {
      await aiSearchService.ensureAiIndex();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'AI-индекс временно недоступен' });
    }
  })
);

module.exports = router;
