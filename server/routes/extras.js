const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const authRequired = require('../middleware/authRequired');
const { addActivity } = require('../rating');
const { safe } = require('../middleware/safe');

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
});

router.get(
  '/:category',
  authRequired,
  safe('extras')((req, res) => {
    const cat = req.params.category;
    if (!CATALOG[cat]) return res.status(404).json({ error: 'Категория не найдена' });
    const items = CATALOG[cat].map((item) => {
      const regs = db
        .prepare(
          'SELECT employee_name, position, school_name, registered_at FROM extra_registrations WHERE category = ? AND event_id = ? ORDER BY registered_at'
        )
        .all(cat, item.id);
      return {
        ...item,
        registrations: regs.map((r) => ({
          employeeName: r.employee_name,
          position: r.position,
          schoolName: r.school_name,
          registeredAt: r.registered_at,
        })),
      };
    });
    res.json({ items });
  })
);

router.post(
  '/:category/:eventId/register',
  authRequired,
  safe('extras')((req, res) => {
    const cat = req.params.category;
    if (!CATALOG[cat]) return res.status(404).json({ error: 'Категория не найдена' });
    const item = CATALOG[cat].find((e) => e.id === req.params.eventId);
    if (!item) return res.status(404).json({ error: 'Событие не найдено' });
    const parsed = regSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
    const { employeeName, position, schoolName } = parsed.data;
    db.prepare(
      `INSERT INTO extra_registrations (category, event_id, employee_name, position, school_name, registered_by)
     VALUES (?, ?, ?, ?, ?, ?)`
    ).run(cat, item.id, employeeName, position, schoolName, req.user.id);
    addActivity(req.user.id, 'participation', `Зарегистрировал(а) ${employeeName} на "${item.title}" (${cat})`, 2);
    res.json({ ok: true });
  })
);

module.exports = router;
