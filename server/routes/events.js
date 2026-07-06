const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { cancelEventRegistration, createEvent, deleteEvent, listEvents, registerForEvent, updateEvent } = require('../services/eventService');

const router = express.Router();

const createSchema = z.object({
  title: z.string().min(1).max(300),
  date: z.string().min(1).max(120),
  description: z.string().min(1).max(5000),
  max: z.coerce.number().int().min(1).max(100000).optional().default(999),
  isSpeaker: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  employeeName: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  schoolName: z.string().min(1).max(300),
  phone: z.string().max(40).optional().default(''),
  city: z.string().max(200).optional().default(''),
});
const updateSchema = z.object({
  title: z.string().min(1).max(300),
  date: z.string().min(1).max(120),
  description: z.string().min(1).max(5000),
  max: z.coerce.number().int().min(1).max(100000),
  status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
});
const eventIdSchema = z.coerce.number().int().positive();
const registrationIdSchema = z.coerce.number().int().positive();

router.get(
  '/',
  authRequired,
  safe('events')(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    res.json(await listEvents(req.user, page, limit));
  })
);

router.post(
  '/',
  authRequired,
  safe('events')(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    res.json(await createEvent(req.user, parsed.data));
  })
);

router.post(
  '/:id/register',
  authRequired,
  safe('events')(async (req, res) => {
    const parsedId = eventIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ error: 'Некорректный ID мероприятия' });
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const result = await registerForEvent(req.user, parsedId.data, parsed.data);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.put(
  '/:id',
  authRequired,
  safe('events')(async (req, res) => {
    const parsedId = eventIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ error: 'Некорректный ID мероприятия' });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    const result = await updateEvent(req.user, parsedId.data, parsed.data);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.delete(
  '/:id/registrations/:registrationId',
  authRequired,
  safe('events')(async (req, res) => {
    const parsedId = eventIdSchema.safeParse(req.params.id);
    const parsedRegistrationId = registrationIdSchema.safeParse(req.params.registrationId);
    if (!parsedId.success || !parsedRegistrationId.success) {
      return res.status(400).json({ error: 'Некорректный ID регистрации' });
    }
    const result = await cancelEventRegistration(req.user, parsedId.data, parsedRegistrationId.data);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.delete(
  '/:id',
  authRequired,
  safe('events')(async (req, res) => {
    const parsedId = eventIdSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ error: 'Некорректный ID мероприятия' });
    const result = await deleteEvent(req.user, parsedId.data);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

module.exports = router;
