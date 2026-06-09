const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { addActivity } = require('../rating');
const { safe } = require('../middleware/safe');
const { broadcastAndInsert } = require('../ws');
const { sendPushToMany } = require('../push');

const router = express.Router();

const CATALOG = {
  gl: [
    {
      id: 'gl1',
      title: 'Школа молодого директора',
      description: 'Программа наставничества для начинающих руководителей. Запись на курс откроется в мае.',
      date: 'Май 2026',
    },
    {
      id: 'gl2',
      title: 'Лидерские компетенции',
      description: 'Самодиагностика, развитие эмоционального интеллекта, стратегическое мышление.',
      date: 'Постоянно',
    },
    {
      id: 'gl3',
      title: 'Кейс-чемпионат «Управляю школой»',
      description: 'Решаем реальные задачи из практики директоров. Приём заявок до 20 апреля.',
      date: 'До 20 апреля',
    },
  ],
  internship: [
    {
      id: 'int1',
      title: 'Стажировка в лучших школах МО',
      description: 'Возможность посетить школы-лидеры, перенять опыт. Ближайшая стажировка: 15–17 мая.',
      date: '15–17 мая',
    },
    {
      id: 'int2',
      title: 'Виртуальная стажировка',
      description: 'Онлайн-модули по управлению качеством, цифровым инструментам, работе с родителями.',
      date: 'Постоянно',
    },
    {
      id: 'int3',
      title: 'Заявка на стажировку',
      description: 'Оставьте заявку в личном кабинете, и мы подберём подходящую программу.',
      date: 'По запросу',
    },
  ],
  calendar: [
    {
      id: 'cal1',
      title: 'Вебинар «Эффективное бюджетирование»',
      description: 'Спикер: Елена Громова, директор гимназии №11.',
      date: '12 апреля',
    },
    {
      id: 'cal2',
      title: 'Форум «Лидеры образования Подмосковья»',
      description: 'Очный форум в Химках. Участие бесплатное по предварительной записи.',
      date: '25 апреля',
    },
    {
      id: 'cal3',
      title: 'Онлайн-марафон «Наставничество в школе»',
      description: 'Практические инструменты для наставников и молодых педагогов.',
      date: '1–5 мая',
    },
  ],
};

const regSchema = z.object({
  employeeName: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  schoolName: z.string().min(1).max(300),
  phone: z.string().max(40).optional().default(''),
  city: z.string().max(200).optional().default(''),
});

router.get(
  '/:category',
  authRequired,
  safe('extras')(async (req, res) => {
    const cat = req.params.category;
    if (!CATALOG[cat]) return res.status(404).json({ error: 'Категория не найдена' });
    const items = await Promise.all(CATALOG[cat].map(async (item) => {
      const regs = await db
        .prepare(
          'SELECT id, employee_name, position, school_name, phone, city, registered_by, registered_at FROM extra_registrations WHERE category = ? AND event_id = ? ORDER BY registered_at'
        )
        .all(cat, item.id);
      return {
        ...item,
        registrations: regs.map((r) => ({
          id: r.id,
          employeeName: r.employee_name,
          position: r.position,
          schoolName: r.school_name,
          phone: r.phone || '',
          city: r.city || '',
          registeredBy: r.registered_by,
          registeredAt: r.registered_at,
        })),
      };
    }));
    res.json({ items });
  })
);

router.post(
  '/:category/:eventId/register',
  authRequired,
  safe('extras')(async (req, res) => {
    const cat = req.params.category;
    if (!CATALOG[cat]) return res.status(404).json({ error: 'Категория не найдена' });
    const item = CATALOG[cat].find((e) => e.id === req.params.eventId);
    if (!item) return res.status(404).json({ error: 'Событие не найдено' });
    const parsed = regSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
    const { employeeName, position, schoolName, phone, city } = parsed.data;
    await db.prepare(
      `INSERT INTO extra_registrations (category, event_id, employee_name, position, school_name, phone, city, registered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(cat, item.id, employeeName, position, schoolName, phone || '', city || '', req.user.id);
    await addActivity(req.user.id, 'participation', `Зарегистрировал(а) ${employeeName} на "${item.title}" (${cat})`, 2);
    const typeMap = {
      gl: 'gl_registered',
      internship: 'internship_registered',
      calendar: 'calendar_registered',
    };
    const titleMap = {
      gl: 'Новая регистрация в ГЛ',
      internship: 'Новая регистрация в стажировке',
      calendar: 'Новая регистрация в календарном событии',
    };
    const eventType = typeMap[cat] || 'extras_registered';
    const notifTitle = titleMap[cat] || 'Новая регистрация';
    const notifMessage = `${employeeName} зарегистрирован(а) на "${item.title}"`;
    await broadcastAndInsert(eventType, notifTitle, notifMessage, req.user.id);
    const recipients = await db.prepare('SELECT id FROM users WHERE id != ?').all(req.user.id);
    await sendPushToMany(
      recipients.map((r) => r.id),
      {
        type: eventType,
        title: notifTitle,
        body: notifMessage,
        url: '/',
        tag: `${eventType}:${cat}:${item.id}`,
      }
    );
    res.json({ ok: true });
  })
);

router.delete(
  '/:category/:eventId/registrations/:registrationId',
  authRequired,
  safe('extras')(async (req, res) => {
    const cat = req.params.category;
    if (!CATALOG[cat]) return res.status(404).json({ error: 'Категория не найдена' });
    const item = CATALOG[cat].find((e) => e.id === req.params.eventId);
    if (!item) return res.status(404).json({ error: 'Событие не найдено' });
    const registrationId = Number(req.params.registrationId);
    if (!Number.isInteger(registrationId) || registrationId <= 0) return res.status(400).json({ error: 'Некорректный ID регистрации' });
    const row = await db
      .prepare('SELECT id, employee_name, registered_by FROM extra_registrations WHERE id = ? AND category = ? AND event_id = ?')
      .get(registrationId, cat, item.id);
    if (!row) return res.status(404).json({ error: 'Регистрация не найдена' });
    if (req.user.role !== 'admin' && row.registered_by !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав для отмены регистрации' });
    }
    await db.prepare('DELETE FROM extra_registrations WHERE id = ?').run(row.id);
    await addActivity(req.user.id, 'cancel_participation', `Отменил(а) регистрацию ${row.employee_name} на "${item.title}" (${cat})`, 0);
    res.json({ ok: true });
  })
);

module.exports = router;
