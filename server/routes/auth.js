const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const authRequired = require('../middleware/authRequired');
const { ensureRatingRow } = require('../rating');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional().default(''),
  password: z.string().min(6).max(200)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
  const { name, email, phone, password } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

  const hash = hashPassword(password);
  const info = db.prepare(
    `INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, 'director')`
  ).run(email, hash, name, phone || '');
  const userId = info.lastInsertRowid;
  ensureRatingRow(userId);

  const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId);
  const token = signToken(user);
  res.json({ token, user });
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
  const { email, password } = parsed.data;

  const user = db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  const safe = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = signToken(safe);
  res.json({ token, user: safe });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
