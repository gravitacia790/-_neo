const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { getRatingByUserId, setVisibility } = require('../rating');
const { safe } = require('../middleware/safe');

const router = express.Router();

router.get(
  '/me',
  authRequired,
  safe('ratings')((req, res) => {
    res.json({ rating: getRatingByUserId(req.user.id) });
  })
);

const visSchema = z.object({ public: z.boolean() });
router.put(
  '/me/visibility',
  authRequired,
  safe('ratings')((req, res) => {
    const parsed = visSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
    setVisibility(req.user.id, parsed.data.public);
    res.json({ rating: getRatingByUserId(req.user.id) });
  })
);

router.get(
  '/by-id/:id',
  authRequired,
  safe('ratings')((req, res) => {
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Не найдено' });
    const rating = getRatingByUserId(target.id);
    const isOwner = req.user.id === target.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin && !rating.public) {
      return res.json({ rating: null });
    }
    res.json({ rating });
  })
);

module.exports = router;
