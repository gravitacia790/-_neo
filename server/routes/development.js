const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const development = require('../services/developmentService');
const { generatePlan } = require('../services/developmentAiService');

const router = express.Router();

const trackSchema = z.object({
  title: z.string().min(2).max(180),
  focusArea: z.string().max(300).optional(),
  outcome: z.string().max(1000).optional(),
  targetDate: z.string().max(20).optional().nullable(),
});
const actionSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(2000).optional(),
  weekNumber: z.coerce.number().int().min(1).max(12).optional(),
});
const actionStatusSchema = z.object({ status: z.enum(['planned', 'completed']) });
const reflectionSchema = z.object({ content: z.string().min(2).max(4000), actionId: z.coerce.number().int().positive().optional().nullable() });
const planSchema = z.object({ request: z.string().min(8).max(2000) });

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get('/', authRequired, safe('development')(async (req, res) => {
  res.json(await development.getDashboard(req.user.id));
}));

router.post('/tracks', authRequired, safe('development')(async (req, res) => {
  const parsed = trackSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Проверьте название и описание цели.' });
  res.status(201).json({ track: await development.createTrack(req.user.id, parsed.data) });
}));

router.post('/tracks/:id/actions', authRequired, safe('development')(async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = actionSchema.safeParse(req.body || {});
  if (!id || !parsed.success) return res.status(400).json({ error: 'Проверьте описание практики.' });
  const track = await development.addAction(req.user.id, id, parsed.data);
  if (!track) return res.status(404).json({ error: 'Трек развития не найден.' });
  res.status(201).json({ track });
}));

router.patch('/actions/:id', authRequired, safe('development')(async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = actionStatusSchema.safeParse(req.body || {});
  if (!id || !parsed.success) return res.status(400).json({ error: 'Некорректный статус практики.' });
  const track = await development.updateAction(req.user.id, id, parsed.data.status);
  if (!track) return res.status(404).json({ error: 'Практика не найдена.' });
  res.json({ track });
}));

router.post('/tracks/:id/reflections', authRequired, safe('development')(async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = reflectionSchema.safeParse(req.body || {});
  if (!id || !parsed.success) return res.status(400).json({ error: 'Напишите рефлексию немного подробнее.' });
  const dashboard = await development.addReflection(req.user.id, id, parsed.data.content, parsed.data.actionId);
  if (!dashboard) return res.status(404).json({ error: 'Трек развития не найден.' });
  res.status(201).json(dashboard);
}));

router.post('/ai-plan', authRequired, safe('development')(async (req, res) => {
  const parsed = planSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Опишите задачу чуть подробнее.' });
  const plan = await generatePlan(req.user, parsed.data.request);
  res.status(201).json({ track: await development.createPlan(req.user.id, plan) });
}));

module.exports = router;
