const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const adminRequired = require('../middleware/adminRequired');
const { safe } = require('../middleware/safe');
const aiSearchService = require('../services/aiSearchService');
const aiAssistantService = require('../services/aiAssistantService');

const router = express.Router();

const searchSchema = z.object({
  query: z.string().min(8).max(1000),
});

const conversationSchema = z.object({
  title: z.string().max(100).optional(),
});

const messageSchema = z.object({
  content: z.string().min(2).max(4000),
});

const chatSchema = z.object({
  conversationId: z.coerce.number().int().positive().nullable().optional(),
  content: z.string().min(2).max(4000),
});

function parseId(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

router.get(
  '/conversations',
  authRequired,
  safe('ai')(async (req, res) => {
    res.json({ conversations: await aiAssistantService.listConversations(req.user.id) });
  })
);

router.post(
  '/conversations',
  authRequired,
  safe('ai')(async (req, res) => {
    const parsed = conversationSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Некорректное название разговора' });
    res.status(201).json({ conversation: await aiAssistantService.createConversation(req.user.id, parsed.data.title) });
  })
);

router.get(
  '/conversations/:id/messages',
  authRequired,
  safe('ai')(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Некорректный идентификатор разговора' });
    const result = await aiAssistantService.listMessages(req.user.id, id);
    if (!result) return res.status(404).json({ error: 'Разговор не найден' });
    res.json(result);
  })
);

router.post(
  '/conversations/:id/messages',
  authRequired,
  safe('ai')(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Некорректный идентификатор разговора' });
    const parsed = messageSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Напишите сообщение подробнее' });
    try {
      res.json(await aiAssistantService.sendMessage(req.user, id, parsed.data.content));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'AI-ассистент временно недоступен' });
    }
  })
);

router.post(
  '/chat',
  authRequired,
  safe('ai')(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Напишите сообщение подробнее' });
    try {
      res.json(await aiAssistantService.sendMessage(req.user, parsed.data.conversationId || null, parsed.data.content));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'AI-ассистент временно недоступен' });
    }
  })
);

router.post(
  '/search',
  authRequired,
  safe('ai')(async (req, res) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Опишите задачу подробнее' });
    try {
      res.json(await aiSearchService.searchDirectors(req.user, parsed.data.query));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'AI-поиск временно недоступен' });
    }
  })
);

router.post(
  '/reindex/me',
  authRequired,
  safe('ai')(async (req, res) => {
    res.json(await aiSearchService.reindexDirectorAi(req.user.id));
  })
);

router.post(
  '/reindex-all',
  authRequired,
  adminRequired,
  safe('ai')(async (req, res) => {
    try {
      await aiSearchService.ensureAiIndex();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'AI-индекс временно недоступен' });
    }
  })
);

module.exports = router;
