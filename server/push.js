const { db } = require('./db');

let webPush = null;
let pushConfigured = false;
let missingDependencyLogged = false;

function toBase64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getVapidPublicKey() {
  if (process.env.VAPID_PUBLIC_KEY) return process.env.VAPID_PUBLIC_KEY;
  if (process.env.VAPID_PRIVATE_KEY) {
    // Cannot derive public key without proper tooling; require explicit key pair in prod.
    return '';
  }
  if (process.env.NODE_ENV === 'test') return 'test-vapid-public-key';
  // Dev fallback key marker; push will remain disabled until proper keys provided.
  return '';
}

function ensureWebPushConfigured() {
  if (pushConfigured) return true;
  const vapidSubject = process.env.VAPID_SUBJECT || '';
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) return false;

  if (!webPush) {
    try {
      // Lazy require so test/dev can run without push package configured.
      webPush = require('web-push');
    } catch (_) {
      if (!missingDependencyLogged) {
        missingDependencyLogged = true;
        console.warn('[push] web-push dependency is missing; push delivery disabled');
      }
      return false;
    }
  }
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  pushConfigured = true;
  return true;
}

function getPublicPushConfig() {
  return {
    vapidPublicKey: getVapidPublicKey(),
    enabled:
      !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) &&
      ensureWebPushConfigured(),
  };
}

async function saveSubscription(userId, subscription, userAgent) {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return { ok: false, error: 'Некорректная push-подписка' };
  }
  const endpoint = String(subscription.endpoint);
  const p256dh = String(subscription.keys.p256dh || '');
  const auth = String(subscription.keys.auth || '');
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: 'Некорректная push-подписка' };
  }

  var existing = await db.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (existing && Number(existing.user_id) !== Number(userId)) {
    return { ok: false, error: 'Эта push-подписка уже привязана к другому аккаунту' };
  }

  await db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       last_seen_at = NOW()
     WHERE push_subscriptions.user_id = EXCLUDED.user_id`
  ).run(userId, endpoint, p256dh, auth, userAgent || null);

  return { ok: true };
}

async function removeSubscription(userId, endpoint) {
  if (!endpoint) return { ok: true };
  await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
  return { ok: true };
}

async function sendPushToUser(userId, payload) {
  if (!ensureWebPushConfigured()) return { ok: false, skipped: 'push_not_configured' };
  const rows = await db
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 10')
    .all(userId);
  if (!rows.length) return { ok: true, delivered: 0 };

  let delivered = 0;
  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    };
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload || {}));
      delivered++;
    } catch (err) {
      const status = err && err.statusCode;
      if (status === 404 || status === 410) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint);
      }
    }
  }
  return { ok: true, delivered };
}

async function sendPushToMany(userIds, payload) {
  if (!Array.isArray(userIds) || !userIds.length) return { ok: true, delivered: 0 };
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  let total = 0;
  for (const uid of uniq) {
    const result = await sendPushToUser(uid, payload);
    if (result && result.delivered) total += result.delivered;
  }
  return { ok: true, delivered: total };
}

module.exports = {
  getPublicPushConfig,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
  sendPushToMany,
  toBase64Url,
};
