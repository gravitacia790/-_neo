const crypto = require('crypto');
const { db } = require('../db');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const { ensureRatingRow } = require('../rating');
const { reindexDirector } = require('./directorsService');

const RESET_TOKEN_EXPIRY_HOURS = 1;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

function getSafeUserById(userId) {
  return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId);
}

async function registerDirector(data) {
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
  if (existing) return { error: 'Пользователь с таким email уже существует', status: 409 };

  const hash = hashPassword(data.password);
  const info = await db
    .prepare(`INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, 'director') RETURNING id`)
    .run(data.email, hash, data.name, data.phone || '');
  await ensureRatingRow(info.lastInsertRowid);
  await reindexDirector(info.lastInsertRowid);

  const user = await getSafeUserById(info.lastInsertRowid);
  return { user, token: signToken(user) };
}

async function loginUser(data) {
  const user = await db
    .prepare(
      'SELECT id, email, name, role, password_hash, failed_login_attempts, locked_until FROM users WHERE email = ?'
    )
    .get(data.email);
  if (!user) return { error: 'Неверный email или пароль', status: 401 };

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return { error: 'Аккаунт временно заблокирован после неудачных попыток входа', status: 429 };
  }

  if (!verifyPassword(data.password, user.password_hash)) {
    const failed = (user.failed_login_attempts || 0) + 1;
    const shouldLock = failed >= MAX_FAILED_LOGIN_ATTEMPTS;
    await db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(
      shouldLock ? 0 : failed,
      shouldLock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60000).toISOString() : null,
      user.id
    );
    return {
      error: shouldLock ? 'Слишком много неудачных попыток. Аккаунт временно заблокирован.' : 'Неверный email или пароль',
      status: shouldLock ? 429 : 401,
    };
  }

  await db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return { user: safeUser, token: signToken(safeUser) };
}

async function createResetToken(email) {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, status: 503, error: 'Сброс пароля временно недоступен. Обратитесь к администратору.' };
  }
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return { ok: true, message: 'Если email найден, ссылка для сброса отправлена' };

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 3600000).toISOString();
  await db
    .prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
    .run(user.id, token, expiresAt);

  const payload = {
    ok: true,
    message: 'Ссылка для сброса отправлена на email',
    expiresAt,
  };
  if (process.env.NODE_ENV !== 'production') payload.token = token;
  return payload;
}

async function resetPassword(token, password) {
  const row = await db
    .prepare(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token = ?
         AND used = 0
         AND expires_at > NOW()`
    )
    .get(token);
  if (!row) return { error: 'Токен недействителен или истёк', status: 400 };

  const hash = hashPassword(password);
  const tx = db.transaction(async (trx) => {
    await trx
      .prepare('UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?')
      .run(hash, row.user_id);
    await trx.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(row.id);
  });
  await tx();
  return { ok: true, message: 'Пароль успешно изменён' };
}

module.exports = {
  createResetToken,
  getSafeUserById,
  loginUser,
  registerDirector,
  resetPassword,
};
