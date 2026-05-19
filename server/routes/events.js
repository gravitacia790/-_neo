const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { addActivity } = require('../rating');

const router = express.Router();

const createSchema = z.object({
  title: z.string().min(1).max(300),
  date: z.string().min(1).max(120),
  description: z.string().min(1).max(5000),
  max: z.coerce.number().int().min(1).max(100000).optional().default(999),
  isSpeaker: z.boolean().optional().default(false)
});

const registerSchema = z.object({
  employeeName: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  schoolName: z.string().min(1).max(300)
});

function eventWithRegs(eventRow) {
  const regs = db.prepare(
    'SELECT employee_name, position, school_name, registered_at FROM event_registrations WHERE event_id = ? ORDER BY registered_at'
  ).all(eventRow.id);
  const creator = db.prepare(
    `SELECT u.name, s.name AS school_name, u.email
     FROM users u LEFT JOIN schools s ON s.user_id = u.id
     WHERE u.id = ?`
  ).get(eventRow.creator_id);
  return {
    id: eventRow.id,
    title: eventRow.title,
    date: eventRow.date,
    description: eventRow.description,
    max: eventRow.max_participants,
    creator: creator ? creator.name : 'Неизвестно',
    creatorSchool: creator ? (creator.school_name || 'Школа не указана') : '',
    creatorEmail: creator ? creator.email : '',
    creatorId: eventRow.creator_id,
    registrations: regs.map(r => ({
      employeeName: r.employee_name,
      position: r.position,
      schoolName: r.school_name,
      registeredAt: r.registered_at
    }))
  };
}

router.get('/', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
  res.json({ events: rows.map(eventWithRegs) });
});

router.post('/', authRequired, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
  const { title, date, description, max, isSpeaker } = parsed.data;
  const info = db.prepare(
    'INSERT INTO events (title, date, description, max_participants, creator_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, date, description, max, req.user.id);

  addActivity(req.user.id, 'create_event', `Создал мероприятие "${title}"`, 10);
  if (isSpeaker) addActivity(req.user.id, 'speaker', `Выступил спикером на "${title}"`, 15);

  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.json({ event: eventWithRegs(row) });
});

router.post('/:id/register', authRequired, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Мероприятие не найдено' });
  const count = db.prepare('SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ?').get(ev.id).c;
  if (count >= ev.max_participants) return res.status(409).json({ error: 'Максимум участников' });

  const { employeeName, position, schoolName } = parsed.data;
  db.prepare(
    'INSERT INTO event_registrations (event_id, employee_name, position, school_name, registered_by) VALUES (?, ?, ?, ?, ?)'
  ).run(ev.id, employeeName, position, schoolName, req.user.id);
  addActivity(req.user.id, 'participation', `Зарегистрировал ${employeeName} на "${ev.title}"`, 2);
  res.json({ event: eventWithRegs(ev) });
});

router.delete('/:id', authRequired, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Не найдено' });
  if (ev.creator_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Удалять можно только свои мероприятия' });
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(ev.id);
  res.json({ ok: true });
});

module.exports = router;
