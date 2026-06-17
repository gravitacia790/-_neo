const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { createLinkToken, handleBotStarted, getLinkStatus, unlink } = require('../services/maxService');
const logger = require('../logger');

const router = express.Router();

// Статус привязки (включена ли интеграция, привязан ли аккаунт).
router.get(
  '/status',
  authRequired,
  safe('max')(async (req, res) => {
    res.json(await getLinkStatus(req.user.id));
  })
);

// Старт привязки: выдаёт deep-link с одноразовым nonce.
router.post(
  '/link',
  authRequired,
  safe('max')(async (req, res) => {
    const result = await createLinkToken(req.user.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.post(
  '/unlink',
  authRequired,
  safe('max')(async (req, res) => {
    res.json(await unlink(req.user.id));
  })
);

const webhookSchema = z.object({
  update_type: z.string(),
  payload: z.string().optional(),
  user: z
    .object({
      user_id: z.union([z.number(), z.string()]),
      name: z.string().optional(),
      username: z.string().optional(),
    })
    .optional(),
});

// Webhook от MAX. Без авторизации пользователя, но защищён общим секретом.
// CSRF для этого пути отключён (см. server/middleware/csrf.js).
router.post(
  '/webhook',
  safe('max')(async (req, res) => {
    const secret = process.env.MAX_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'not_configured' });
    const provided = req.get('x-max-webhook-secret') || req.query.secret;
    if (provided !== secret) return res.status(403).json({ error: 'forbidden' });

    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) return res.json({ ok: true });

    const update = parsed.data;
    if (update.update_type === 'bot_started') {
      const user = update.user ? { ...update.user, user_id: Number(update.user.user_id) } : null;
      try {
        await handleBotStarted(update.payload, user);
      } catch (err) {
        logger.warn('max.webhook_handle_failed', { message: err.message });
      }
    }
    // Всегда 200, чтобы MAX не ретраил бесконечно.
    res.json({ ok: true });
  })
);

module.exports = router;
