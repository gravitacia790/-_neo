const { db } = require('../db');
const { notifyUser } = require('../ws');
const { sendPushToUser } = require('../push');

const MESSAGE_RETENTION_DAYS = 90;
const ARCHIVE_SWEEP_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 5 * 60 * 1000;
let lastArchiveSweepAt = 0;

async function archiveExpiredMessages() {
  const now = Date.now();
  if (now - lastArchiveSweepAt < ARCHIVE_SWEEP_MIN_INTERVAL_MS) return;
  lastArchiveSweepAt = now;

  await db.transaction(async (trx) => {
    await trx.exec(`
      INSERT INTO messages_archive (message_id, from_user_id, to_user_id, text, read, created_at, archived_at)
      SELECT m.id, m.from_user_id, m.to_user_id, m.text, m.read, m.created_at, NOW()
      FROM messages m
      WHERE m.created_at < NOW() - INTERVAL '${MESSAGE_RETENTION_DAYS} days'
      ON CONFLICT (message_id) DO NOTHING
    `);
    await trx.exec(`
      DELETE FROM messages
      WHERE created_at < NOW() - INTERVAL '${MESSAGE_RETENTION_DAYS} days'
    `);
  })();
}

async function sendMessage(fromUserId, toUserId, text) {
  await archiveExpiredMessages();
  const target = await db
    .prepare("SELECT id FROM users WHERE id = ? AND (role = 'admin' OR approval_status = 'approved')")
    .get(toUserId);
  if (!target) return { error: 'Пользователь не найден', status: 404 };
  if (toUserId === fromUserId) return { error: 'Нельзя отправить сообщение себе', status: 400 };

  await db.prepare('INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)').run(
    fromUserId,
    toUserId,
    text
  );
  const sender = await db.prepare('SELECT name FROM users WHERE id = ?').get(fromUserId);
  const senderName = sender ? sender.name : 'Новый пользователь';
  notifyUser(toUserId, 'message_new', {
    fromUserId,
    toUserId,
    fromName: senderName,
    preview: String(text).slice(0, 120),
  });
  await sendPushToUser(toUserId, {
    type: 'message_new',
    title: 'Новое сообщение',
    body: `${senderName}: ${String(text).slice(0, 120)}`,
    url: '/',
    tag: `message:${toUserId}`,
  });
  return { ok: true, message: 'Сообщение отправлено' };
}

async function listMessages(userId) {
  await archiveExpiredMessages();
  const messages = await db
    .prepare(
      `SELECT m.id, m.from_user_id, m.to_user_id, m.text, m.read, m.created_at,
              u_from.name AS from_name, u_to.name AS to_name
       FROM messages m
       JOIN users u_from ON u_from.id = m.from_user_id
       JOIN users u_to ON u_to.id = m.to_user_id
       WHERE m.from_user_id = ? OR m.to_user_id = ?
       ORDER BY m.created_at DESC
       LIMIT 100`
    )
    .all(userId, userId);
  return { messages };
}

async function getUnreadCount(userId) {
  await archiveExpiredMessages();
  const unread = await db.prepare('SELECT COUNT(*) AS c FROM messages WHERE to_user_id = ? AND read = 0').get(userId);
  return { unread: Number(unread.c) };
}

async function markAllRead(userId) {
  await archiveExpiredMessages();
  await db.prepare('UPDATE messages SET read = 1 WHERE to_user_id = ? AND read = 0').run(userId);
  return { ok: true };
}

module.exports = { getUnreadCount, listMessages, markAllRead, sendMessage };
