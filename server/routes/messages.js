const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { getUnreadCount, listMessages, markAllRead, sendMessage } = require('../services/messagesService');

const router = express.Router();

const messageSchema = z.object({
  toUserId: z.number().int().positive(),
  text: z.string().min(1).max(2000),
});

router.post(
  '/',
  authRequired,
  safe('messages')(async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    const result = await sendMessage(req.user.id, parsed.data.toUserId, parsed.data.text);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.get(
  '/',
  authRequired,
  safe('messages')(async (req, res) => {
    res.json(await listMessages(req.user.id));
  })
);

router.get(
  '/unread',
  authRequired,
  safe('messages')(async (req, res) => {
    res.json(await getUnreadCount(req.user.id));
  })
);

router.put(
  '/read-all',
  authRequired,
  safe('messages')(async (req, res) => {
    res.json(await markAllRead(req.user.id));
  })
);

module.exports = router;
