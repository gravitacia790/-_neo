const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { addActivity } = require('../rating');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `u${req.user.id}_${Date.now()}${ext || '.jpg'}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new Error('Только JPEG/PNG/WebP'));
    cb(null, true);
  }
});

const profileSchema = z.object({
  phone: z.string().max(40).optional(),
  experience: z.string().max(5000).optional().default(''),
  interests: z.string().max(5000).optional().default(''),
  isMentor: z.boolean().optional().default(false),
  consent: z.boolean().optional().default(false),
  strengths: z.array(z.object({ name: z.string().max(200), val: z.coerce.number().min(0).max(10) })).max(50).optional().default([]),
  skills: z.array(z.object({ name: z.string().max(200), level: z.string().max(50) })).max(50).optional().default([]),
  city: z.string().max(200).optional().default('')
});

const schoolSchema = z.object({
  name: z.string().max(300).optional().default(''),
  address: z.string().max(500).optional().default(''),
  students: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  teachers: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  type: z.string().max(100).optional().default(''),
  buildingCount: z.coerce.number().int().min(0).max(100).optional().nullable(),
  usefulExperience: z.string().max(5000).optional().default(''),
  wantToKnow: z.string().max(5000).optional().default('')
});

function loadProfile(userId) {
  const user = db.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').get(userId);
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || {};
  return {
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    experience: profile.experience || '',
    interests: profile.interests || '',
    isMentor: !!profile.is_mentor,
    consent: !!profile.consent,
    photo: profile.photo || null,
    strengths: profile.strengths ? JSON.parse(profile.strengths) : [],
    skills: profile.skills ? JSON.parse(profile.skills) : [],
    tags: profile.tags ? JSON.parse(profile.tags) : [],
    city: profile.city || ''
  };
}

function loadSchool(userId) {
  const s = db.prepare('SELECT * FROM schools WHERE user_id = ?').get(userId);
  if (!s) return { name: '', address: '', students: null, teachers: null, type: '', buildingCount: null, usefulExperience: '', wantToKnow: '' };
  return {
    name: s.name || '', address: s.address || '',
    students: s.students, teachers: s.teachers,
    type: s.type || '', buildingCount: s.building_count,
    usefulExperience: s.useful_experience || '',
    wantToKnow: s.want_to_know || ''
  };
}

router.get('/', authRequired, (req, res) => {
  res.json({ profile: loadProfile(req.user.id), school: loadSchool(req.user.id) });
});

router.put('/', authRequired, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
  const p = parsed.data;

  if (p.phone !== undefined) {
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(p.phone, req.user.id);
  }

  const exists = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(req.user.id);
  if (exists) {
    db.prepare(
      `UPDATE profiles SET experience=?, interests=?, is_mentor=?, consent=?, strengths=?, skills=?, city=?, updated_at=datetime('now')
       WHERE user_id = ?`
    ).run(
      p.experience, p.interests, p.isMentor ? 1 : 0, p.consent ? 1 : 0,
      JSON.stringify(p.strengths), JSON.stringify(p.skills), p.city, req.user.id
    );
  } else {
    db.prepare(
      `INSERT INTO profiles (user_id, experience, interests, is_mentor, consent, strengths, skills, city)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id, p.experience, p.interests, p.isMentor ? 1 : 0, p.consent ? 1 : 0,
      JSON.stringify(p.strengths), JSON.stringify(p.skills), p.city
    );
  }

  addActivity(req.user.id, 'profile_update', 'Обновил профиль', 5);
  res.json({ profile: loadProfile(req.user.id) });
});

router.get('/school', authRequired, (req, res) => {
  res.json({ school: loadSchool(req.user.id) });
});

router.put('/school', authRequired, (req, res) => {
  const parsed = schoolSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
  const s = parsed.data;
  const exists = db.prepare('SELECT user_id FROM schools WHERE user_id = ?').get(req.user.id);
  if (exists) {
    db.prepare(
      `UPDATE schools SET name=?, address=?, students=?, teachers=?, type=?, building_count=?, useful_experience=?, want_to_know=?, updated_at=datetime('now')
       WHERE user_id = ?`
    ).run(s.name, s.address, s.students, s.teachers, s.type, s.buildingCount, s.usefulExperience, s.wantToKnow, req.user.id);
  } else {
    db.prepare(
      `INSERT INTO schools (user_id, name, address, students, teachers, type, building_count, useful_experience, want_to_know)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, s.name, s.address, s.students, s.teachers, s.type, s.buildingCount, s.usefulExperience, s.wantToKnow);
  }
  res.json({ school: loadSchool(req.user.id) });
});

router.post('/photo', authRequired, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    const url = '/uploads/' + req.file.filename;

    // удалим старое фото
    const old = db.prepare('SELECT photo FROM profiles WHERE user_id = ?').get(req.user.id);
    const exists = !!old;
    if (exists && old.photo && old.photo.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(old.photo));
      fs.unlink(oldPath, () => {});
    }
    if (exists) {
      db.prepare('UPDATE profiles SET photo = ? WHERE user_id = ?').run(url, req.user.id);
    } else {
      db.prepare('INSERT INTO profiles (user_id, photo) VALUES (?, ?)').run(req.user.id, url);
    }
    res.json({ photo: url });
  });
});

module.exports = router;
