const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const adminRequired = require('../middleware/adminRequired');
const { safe } = require('../middleware/safe');
const { sendPushToMany } = require('../push');
const { notifyUser } = require('../ws');

const router = express.Router();

router.use(authRequired, adminRequired);

const materialSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(''),
  url: z.string().url().max(2000),
  category: z.enum(['gl', 'internship', 'calendar', 'general']).optional().default('gl'),
  eventId: z.string().max(120).optional().default(''),
  published: z.boolean().optional().default(true),
});

const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  audience: z.string().min(1).max(120).optional().default('all'),
});

function serializeMaterial(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    url: row.url,
    category: row.category,
    eventId: row.event_id || '',
    published: !!row.published,
    createdBy: row.created_by_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAnnouncementRecipients(audience) {
  if (audience === 'directors') {
    return db.prepare("SELECT id FROM users WHERE role = 'director'").all();
  }
  if (audience && audience.indexOf('event:') === 0) {
    const eventId = Number(audience.slice(6));
    if (!Number.isFinite(eventId)) return [];
    return db
      .prepare('SELECT DISTINCT registered_by AS id FROM event_registrations WHERE event_id = ?')
      .all(eventId);
  }
  if (audience && audience.indexOf('category:') === 0) {
    const category = audience.slice(9);
    return db
      .prepare('SELECT DISTINCT registered_by AS id FROM extra_registrations WHERE category = ?')
      .all(category);
  }
  return db.prepare('SELECT id FROM users').all();
}

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

router.get(
  '/overview',
  safe('admin')(async (req, res) => {
    const directors = await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'director'").get();
    const events = await db.prepare('SELECT COUNT(*) AS c FROM events WHERE deleted_at IS NULL').get();
    const eventRegs = await db.prepare('SELECT COUNT(*) AS c FROM event_registrations').get();
    const extraRegs = await db.prepare('SELECT COUNT(*) AS c FROM extra_registrations').get();
    const materials = await db.prepare('SELECT COUNT(*) AS c FROM seminar_materials WHERE published = 1').get();
    const announcements = await db.prepare('SELECT COUNT(*) AS c FROM announcements').get();
    res.json({
      overview: {
        directors: Number(directors.c),
        events: Number(events.c),
        registrations: Number(eventRegs.c) + Number(extraRegs.c),
        materials: Number(materials.c),
        announcements: Number(announcements.c),
      },
    });
  })
);

router.get(
  '/events',
  safe('admin')(async (req, res) => {
    const rows = await db
      .prepare(
        `
        SELECT e.id, e.title, e.date, e.description, e.max_participants, e.created_at,
               u.name AS creator_name, u.email AS creator_email,
               COUNT(r.id) AS registrations_count
        FROM events e
        LEFT JOIN users u ON u.id = e.creator_id
        LEFT JOIN event_registrations r ON r.event_id = e.id
        WHERE e.deleted_at IS NULL
        GROUP BY e.id, e.title, e.date, e.description, e.max_participants, e.created_at, u.name, u.email
        ORDER BY e.created_at DESC
        `
      )
      .all();
    res.json({
      events: rows.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        description: r.description,
        max: r.max_participants,
        creator: r.creator_name || '',
        creatorEmail: r.creator_email || '',
        registrationsCount: Number(r.registrations_count || 0),
        createdAt: r.created_at,
      })),
    });
  })
);

const EXTRA_TITLES = {
  gl: {
    gl1: { title: 'Школа молодого директора', date: 'Май 2026' },
    gl2: { title: 'Лидерские компетенции', date: 'Постоянно' },
    gl3: { title: 'Кейс-чемпионат «Управляю школой»', date: 'До 20 апреля' },
  },
  internship: {
    int1: { title: 'Стажировка в лучших школах МО', date: '15–17 мая' },
    int2: { title: 'Виртуальная стажировка', date: 'Постоянно' },
    int3: { title: 'Заявка на стажировку', date: 'По запросу' },
  },
  calendar: {
    cal1: { title: 'Вебинар «Эффективное бюджетирование»', date: '12 апреля' },
    cal2: { title: 'Форум «Лидеры образования Подмосковья»', date: '25 апреля' },
    cal3: { title: 'Онлайн-марафон «Наставничество в школе»', date: '1–5 мая' },
  },
};

function getExtraMeta(category, eventId) {
  return (EXTRA_TITLES[category] && EXTRA_TITLES[category][eventId]) || { title: eventId, date: '' };
}

function getCategoryLabel(category) {
  if (category === 'gl') return 'Гравитация лидерства';
  if (category === 'internship') return 'Стажировка';
  if (category === 'calendar') return 'Календарь';
  return category;
}

router.get(
  '/registrations',
  safe('admin')(async (req, res) => {
    const eventRows = await db
      .prepare(
        `
        SELECT 'event' AS source, e.title AS event_title, e.date AS event_date,
               r.employee_name, r.position, r.school_name, r.phone, r.city, r.registered_at,
               u.name AS registered_by_name, u.email AS registered_by_email
        FROM event_registrations r
        JOIN events e ON e.id = r.event_id
        LEFT JOIN users u ON u.id = r.registered_by
        WHERE e.deleted_at IS NULL
        ORDER BY r.registered_at DESC
        `
      )
      .all();

    const extraRows = await db
      .prepare(
        `
        SELECT r.category, r.event_id, r.employee_name, r.position, r.school_name,
               r.phone, r.city, r.registered_at,
               u.name AS registered_by_name, u.email AS registered_by_email
        FROM extra_registrations r
        LEFT JOIN users u ON u.id = r.registered_by
        ORDER BY r.registered_at DESC
        `
      )
      .all();

    const registrations = eventRows
      .map((r) => ({
        source: 'Мероприятие',
        eventTitle: r.event_title,
        eventDate: r.event_date,
        participantName: r.employee_name,
        position: r.position,
        schoolName: r.school_name,
        phone: r.phone || '',
        city: r.city || '',
        registeredBy: r.registered_by_name || '',
        registeredByEmail: r.registered_by_email || '',
        registeredAt: r.registered_at,
      }))
      .concat(
        extraRows.map((r) => {
          const meta = getExtraMeta(r.category, r.event_id);
          return {
            source: getCategoryLabel(r.category),
            eventTitle: meta.title,
            eventDate: meta.date,
            participantName: r.employee_name,
            position: r.position,
            schoolName: r.school_name,
            phone: r.phone || '',
            city: r.city || '',
            registeredBy: r.registered_by_name || '',
            registeredByEmail: r.registered_by_email || '',
            registeredAt: r.registered_at,
          };
        })
      )
      .sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));

    res.json({ registrations });
  })
);

router.get(
  '/materials',
  safe('admin')(async (req, res) => {
    const rows = await db
      .prepare(
        `
        SELECT m.*, u.name AS created_by_name
        FROM seminar_materials m
        LEFT JOIN users u ON u.id = m.created_by
        ORDER BY m.created_at DESC
        `
      )
      .all();
    res.json({ materials: rows.map(serializeMaterial) });
  })
);

router.post(
  '/materials',
  safe('admin')(async (req, res) => {
    const parsed = materialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    const data = parsed.data;
    const info = await db
      .prepare(
        `INSERT INTO seminar_materials (title, description, url, category, event_id, created_by, published)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
      )
      .run(data.title, data.description, data.url, data.category, data.eventId || null, req.user.id, data.published ? 1 : 0);
    const row = await db
      .prepare(
        `SELECT m.*, u.name AS created_by_name
         FROM seminar_materials m
         LEFT JOIN users u ON u.id = m.created_by
         WHERE m.id = ?`
      )
      .get(info.lastInsertRowid);
    res.json({ material: serializeMaterial(row) });
  })
);

router.put(
  '/materials/:id',
  safe('admin')(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Некорректный ID материала' });
    const parsed = materialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    const data = parsed.data;
    const result = await db
      .prepare(
        `UPDATE seminar_materials
         SET title = ?, description = ?, url = ?, category = ?, event_id = ?, published = ?, updated_at = NOW()
         WHERE id = ?`
      )
      .run(data.title, data.description, data.url, data.category, data.eventId || null, data.published ? 1 : 0, id);
    if (!result.rowCount) return res.status(404).json({ error: 'Материал не найден' });
    const row = await db
      .prepare(
        `SELECT m.*, u.name AS created_by_name
         FROM seminar_materials m
         LEFT JOIN users u ON u.id = m.created_by
         WHERE m.id = ?`
      )
      .get(id);
    res.json({ material: serializeMaterial(row) });
  })
);

router.delete(
  '/materials/:id',
  safe('admin')(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Некорректный ID материала' });
    await db.prepare('DELETE FROM seminar_materials WHERE id = ?').run(id);
    res.json({ ok: true });
  })
);

router.post(
  '/announcements',
  safe('admin')(async (req, res) => {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    const data = parsed.data;
    const recipients = await getAnnouncementRecipients(data.audience);
    const recipientIds = Array.from(new Set(recipients.map((r) => r.id).filter(Boolean)));

    const info = await db
      .prepare(
        `INSERT INTO announcements (title, message, audience, created_by, sent_at)
         VALUES (?, ?, ?, ?, NOW()) RETURNING id`
      )
      .run(data.title, data.message, data.audience, req.user.id);

    for (const userId of recipientIds) {
      await db
        .prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)')
        .run(userId, 'admin_announcement', data.title, data.message);
      notifyUser(userId, 'admin_announcement', {
        announcementId: info.lastInsertRowid,
        title: data.title,
        message: data.message,
      });
    }

    await sendPushToMany(recipientIds, {
      type: 'admin_announcement',
      title: data.title,
      body: data.message,
      url: '/',
      tag: `admin_announcement:${info.lastInsertRowid}`,
    });

    res.json({ ok: true, announcementId: info.lastInsertRowid, recipients: recipientIds.length });
  })
);

module.exports = router;
