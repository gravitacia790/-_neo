// Интеграция с мессенджером MAX: отправка сообщений ботом и привязка аккаунта.
// Привязка идёт по nonce через deep-link: пользователь открывает бота с payload,
// бот шлёт webhook bot_started -> сопоставляем nonce -> сохраняем max_user_id в профиле.
const crypto = require('crypto');
const { db } = require('../db');
const logger = require('../logger');

const LINK_TOKEN_TTL_MINUTES = 15;

function maxConfigured() {
  return !!process.env.MAX_BOT_TOKEN;
}

function apiBase() {
  return (process.env.MAX_API_BASE || 'https://platform-api.max.ru').replace(/\/+$/, '');
}

function botName() {
  return process.env.MAX_BOT_NAME || '';
}

// Отправка сообщения пользователю: POST /messages?user_id=<id>, токен в заголовке Authorization.
async function sendMaxMessage(maxUserId, text) {
  if (!maxConfigured()) {
    logger.warn('max.send_skipped_no_token', { maxUserId });
    return { sent: false, reason: 'not_configured' };
  }
  if (!maxUserId) return { sent: false, reason: 'no_recipient' };

  const url = `${apiBase()}/messages?user_id=${encodeURIComponent(maxUserId)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: process.env.MAX_BOT_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn('max.send_failed', { status: res.status, detail: detail.slice(0, 200) });
      return { sent: false, reason: `http_${res.status}` };
    }
    logger.info('max.message_sent', { maxUserId });
    return { sent: true };
  } catch (err) {
    logger.warn('max.send_error', { message: err.message });
    return { sent: false, reason: 'network' };
  }
}

async function getMaxUserId(userId) {
  const row = await db.prepare('SELECT max_user_id FROM profiles WHERE user_id = ?').get(userId);
  return row && row.max_user_id ? row.max_user_id : null;
}

// Создаёт одноразовый nonce и возвращает deep-link для привязки.
async function createLinkToken(userId) {
  if (!maxConfigured() || !botName()) {
    return { error: 'Интеграция с MAX не настроена', status: 503 };
  }
  await db.prepare('UPDATE max_link_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(userId);
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60000).toISOString();
  await db
    .prepare('INSERT INTO max_link_tokens (user_id, nonce, expires_at) VALUES (?, ?, ?)')
    .run(userId, nonce, expiresAt);
  return {
    deepLink: `https://max.ru/${botName()}?start=${nonce}`,
    expiresAt,
  };
}

// Обработка webhook bot_started: payload = nonce, user — отправитель в MAX.
async function handleBotStarted(payload, maxUser) {
  const nonce = (payload || '').toString().trim();
  const maxUserId = maxUser && maxUser.user_id;
  if (!nonce || !maxUserId) return { ok: false, reason: 'bad_payload' };

  const row = await db
    .prepare('SELECT id, user_id FROM max_link_tokens WHERE nonce = ? AND used = 0 AND expires_at > NOW()')
    .get(nonce);
  if (!row) {
    await sendMaxMessage(maxUserId, 'Ссылка для привязки недействительна или истекла. Запросите новую в приложении «Гравитация».');
    return { ok: false, reason: 'invalid_nonce' };
  }

  // Защита от перехвата: один аккаунт MAX — один профиль.
  const taken = await db
    .prepare('SELECT user_id FROM profiles WHERE max_user_id = ? AND user_id != ?')
    .get(maxUserId, row.user_id);
  if (taken) {
    await sendMaxMessage(maxUserId, 'Этот аккаунт MAX уже привязан к другому профилю.');
    return { ok: false, reason: 'already_linked_elsewhere' };
  }

  const username = (maxUser.username || maxUser.name || '').toString().slice(0, 200);
  const exists = await db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(row.user_id);
  if (exists) {
    await db
      .prepare('UPDATE profiles SET max_user_id = ?, max_username = ?, updated_at = NOW() WHERE user_id = ?')
      .run(maxUserId, username, row.user_id);
  } else {
    await db
      .prepare('INSERT INTO profiles (user_id, max_user_id, max_username) VALUES (?, ?, ?)')
      .run(row.user_id, maxUserId, username);
  }
  await db.prepare('UPDATE max_link_tokens SET used = 1 WHERE id = ?').run(row.id);

  await sendMaxMessage(maxUserId, 'Аккаунт MAX успешно привязан к «Гравитации». Сюда будут приходить коды и уведомления.');
  logger.info('max.account_linked', { userId: row.user_id, maxUserId });
  return { ok: true };
}

async function getLinkStatus(userId) {
  const row = await db.prepare('SELECT max_user_id, max_username FROM profiles WHERE user_id = ?').get(userId);
  return {
    enabled: maxConfigured() && !!botName(),
    linked: !!(row && row.max_user_id),
    maxUsername: row && row.max_username ? row.max_username : null,
  };
}

async function unlink(userId) {
  await db
    .prepare('UPDATE profiles SET max_user_id = NULL, max_username = NULL, updated_at = NOW() WHERE user_id = ?')
    .run(userId);
  return { ok: true };
}

module.exports = {
  maxConfigured,
  sendMaxMessage,
  getMaxUserId,
  createLinkToken,
  handleBotStarted,
  getLinkStatus,
  unlink,
};
