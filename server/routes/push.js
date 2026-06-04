const express = require('express');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { getPublicPushConfig, saveSubscription, removeSubscription } = require('../push');

const router = express.Router();

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
    const result = await saveSubscription(
      req.user.id,
      req.body && req.body.subscription,
      req.headers['user-agent'] || ''
    );
    if (!result.ok) return res.status(400).json({ error: result.error || 'Некорректная подписка' });
    res.json({ ok: true });
  })
);

router.post(
  '/unsubscribe',
  authRequired,
  safe('push')(async (req, res) => {
    await removeSubscription(req.user.id, req.body && req.body.endpoint);
    res.json({ ok: true });
  })
);

module.exports = router;
