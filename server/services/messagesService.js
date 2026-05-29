const { db } = require('../db');

function sendMessage(fromUserId, toUserId, text) {
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(toUserId);
  if (!target) return { error: 'Пользователь не найден', status: 404 };
  if (toUserId === fromUserId) return { error: 'Нельзя отправить сообщение себе', status: 400 };

  db.prepare('INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)').run(fromUserId, toUserId, text);
  return { ok: true, message: 'Сообщение отправлено' };
}

function listMessages(userId) {
  const messages = db
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

function getUnreadCount(userId) {
  const unread = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE to_user_id = ? AND read = 0').get(userId).c;
  return { unread };
}

function markAllRead(userId) {
  db.prepare('UPDATE messages SET read = 1 WHERE to_user_id = ? AND read = 0').run(userId);
  return { ok: true };
}

module.exports = { getUnreadCount, listMessages, markAllRead, sendMessage };
