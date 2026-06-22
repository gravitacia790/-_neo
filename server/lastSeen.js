// Обновление users.last_seen_at с троттлингом: чтобы не писать в БД на каждый
// запрос, в памяти держим время последнего обновления по пользователю и реально
// шлём UPDATE не чаще раза в THROTTLE_MS. Условие в SQL дополнительно защищает
// от частых записей при нескольких инстансах. Fire-and-forget — не блокирует запрос.
const { db } = require('./db');
const logger = require('./logger');

const THROTTLE_MS = 10 * 60 * 1000;
const lastTouch = new Map();

function touchLastSeen(userId) {
  if (!userId) return;
  const now = Date.now();
  if (now - (lastTouch.get(userId) || 0) < THROTTLE_MS) return;
  lastTouch.set(userId, now);
  db.prepare(
    "UPDATE users SET last_seen_at = NOW() WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '5 minutes')"
  )
    .run(userId)
    .catch((err) => logger.warn('last_seen.update_failed', { message: err.message }));
}

module.exports = { touchLastSeen };
