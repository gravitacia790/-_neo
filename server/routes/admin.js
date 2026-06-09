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

module.exports = router;
