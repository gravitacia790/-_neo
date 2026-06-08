const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { getPublicPushConfig, saveSubscription, removeSubscription } = require('../push');

const router = express.Router();

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(16).max(1024),
      auth: z.string().min(8).max(256),
    }),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

router.get(
  '/config',
  safe('push')(async (req, res) => {
    res.json(getPublicPushConfig());
  })
);

router.post(
  '/subscribe',
  authRequired,
  safe('push')(async (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Некорректная push-подписка', details: parsed.error.issues });
    }
    const result = await saveSubscription(req.user.id, parsed.data.subscription, req.headers['user-agent'] || '');
    if (!result.ok) return res.status(400).json({ error: result.error || 'Некорректная подписка' });
    res.json({ ok: true });
  })
);

router.post(
  '/unsubscribe',
  authRequired,
  safe('push')(async (req, res) => {
    const parsed = unsubscribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректный endpoint', details: parsed.error.issues });
    await removeSubscription(req.user.id, parsed.data.endpoint);
    res.json({ ok: true });
  })
);

module.exports = router;
