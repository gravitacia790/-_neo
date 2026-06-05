const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { loadProfile, loadSchool, savePhoto, saveProfile, saveSchool } = require('../services/profileService');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '');
    cb(null, `u${req.user.id}_${Date.now()}${ext || '.jpg'}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new Error('Только JPEG/PNG/WebP'));
    cb(null, true);
  },
});

function hasAllowedImageSignature(buffer) {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }
  // WEBP: "RIFF....WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }
  return false;
}

const profileSchema = z.object({
  phone: z.string().max(40).optional(),
  telegram: z.string().max(100).optional(),
  experience: z.string().max(5000).optional().default(''),
  interests: z.string().max(5000).optional().default(''),
  isMentor: z.boolean().optional().default(false),
  consent: z.boolean().optional().default(false),
  strengths: z
    .array(z.object({ name: z.string().max(200), val: z.coerce.number().min(0).max(10) }))
    .max(50)
    .optional()
    .default([]),
  skills: z
    .array(z.object({ name: z.string().max(200), level: z.string().max(50) }))
    .max(50)
    .optional()
    .default([]),
  city: z.string().max(200).optional().default(''),
});

const schoolSchema = z.object({
  name: z.string().max(300).optional().default(''),
  address: z.string().max(500).optional().default(''),
  students: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  teachers: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  type: z.string().max(100).optional().default(''),
  buildingCount: z.coerce.number().int().min(0).max(100).optional().nullable(),
  usefulExperience: z.string().max(5000).optional().default(''),
  wantToKnow: z.string().max(5000).optional().default(''),
});

router.get(
  '/',
  authRequired,
  safe('profile')(async (req, res) => {
    const [profile, school] = await Promise.all([loadProfile(req.user.id), loadSchool(req.user.id)]);
    res.json({ profile, school });
  })
);

router.put(
  '/',
  authRequired,
  safe('profile')(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    res.json({ profile: await saveProfile(req.user.id, parsed.data) });
  })
);

router.get(
  '/school',
  authRequired,
  safe('profile')(async (req, res) => {
    res.json({ school: await loadSchool(req.user.id) });
  })
);

router.put(
  '/school',
  authRequired,
  safe('profile')(async (req, res) => {
    var parsed = schoolSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
    res.json({ school: await saveSchool(req.user.id, parsed.data) });
  })
);

router.post('/photo', authRequired, (req, res, _next) => {
  upload.single('photo')(req, res, (err) => {
    (async () => {
      if (err) return res.status(400).json({ error: 'Только JPEG/PNG/WebP, до 1 МБ' });
      if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
      const absPath = path.join(UPLOAD_DIR, req.file.filename);
      const fileBuffer = fs.readFileSync(absPath);
      if (!hasAllowedImageSignature(fileBuffer)) {
        try {
          fs.unlinkSync(absPath);
        } catch (_) {
          // ignore cleanup errors
        }
        return res.status(400).json({ error: 'Некорректный формат файла' });
      }
      res.json(await savePhoto(req.user.id, req.file.filename, UPLOAD_DIR));
    })().catch((dbErr) => {
      console.error('[profile] POST /photo:', dbErr.message);
      if (!res.headersSent) res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    });
  });
});

module.exports = router;
