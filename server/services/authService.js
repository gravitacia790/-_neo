const crypto = require('crypto');
const { db } = require('../db');
const logger = require('../logger');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const { ensureRatingRow } = require('../rating');
const { sendPasswordResetCode } = require('./notifier');
const { insertNotificationsForUsers, notifyUser } = require('../ws');
const { sendPushToMany } = require('../push');

const RESET_CODE_EXPIRY_MINUTES = 10;
const MAX_RESET_CODE_ATTEMPTS = 5;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function getSafeUserById(userId) {
  return db.prepare('SELECT id, email, name, role, approval_status FROM users WHERE id = ?').get(userId);
}

async function notifyAdminsAboutRegistration(user) {
  try {
    const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    const adminIds = admins.map((admin) => admin.id);
    if (!adminIds.length) return;
    const title = 'Новая заявка на регистрацию';
    const message = `${user.name} (${user.email}) ожидает подтверждения`;
    await insertNotificationsForUsers(adminIds, 'registration_pending', title, message);
    adminIds.forEach((adminId) => {
      notifyUser(adminId, 'registration_pending', {
        title,
        message,
        applicantId: user.id,
      });
    });
    await sendPushToMany(adminIds, {
      title,
      body: message,
      url: '/?tab=admin',
    });
  } catch (err) {
    logger.warn('auth.registration_admin_notification_failed', { message: err.message });
  }
}

async function registerDirector(data) {
  const existing = await db.prepare('SELECT id, approval_status FROM users WHERE email = ?').get(data.email);
  if (existing) return { error: 'Пользователь с таким email уже существует', status: 409 };

  const hash = hashPassword(data.password);
  const info = await db
    .prepare(
      `INSERT INTO users (email, password_hash, name, phone, role, approval_status)
       VALUES (?, ?, ?, ?, 'director', 'pending')
       RETURNING id`
    )
    .run(data.email, hash, data.name, data.phone || '');
  await ensureRatingRow(info.lastInsertRowid);

  const user = await getSafeUserById(info.lastInsertRowid);
  await notifyAdminsAboutRegistration(user);
  return {
    user,
    pendingApproval: true,
    message: 'Заявка отправлена администратору. Вход станет доступен после подтверждения.',
  };
}

async function loginUser(data) {
  const user = await db
    .prepare(
      `SELECT id, email, name, role, password_hash, failed_login_attempts, locked_until, approval_status
       FROM users
       WHERE email = ?`
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

  if (user.role !== 'admin' && user.approval_status !== 'approved') {
    if (user.approval_status === 'rejected') {
      return { error: 'Заявка на регистрацию отклонена. Обратитесь к администратору.', status: 403 };
    }
    return { error: 'Заявка ожидает подтверждения администратора.', status: 403 };
  }

  await db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return { user: safeUser, token: signToken(safeUser) };
}

// Универсальный ответ — не раскрываем, существует ли аккаунт (анти-энумерация).
const RESET_GENERIC_MESSAGE = 'Если аккаунт с таким email существует, код отправлен';

async function createResetCode(email) {
  const user = await db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  const payload = { ok: true, message: RESET_GENERIC_MESSAGE };
  if (!user) return payload;

  // Гасим прежние активные коды этого пользователя — действителен только последний.
  await db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

  const code = generateOtpCode();
  const token = crypto.randomBytes(32).toString('hex'); // непрозрачный id записи
  const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60000).toISOString();
  await db
    .prepare(
      'INSERT INTO password_reset_tokens (user_id, token, code_hash, expires_at, channel) VALUES (?, ?, ?, ?, ?)'
    )
    .run(user.id, token, hashCode(code), expiresAt, 'email');

  const maxRow = await db.prepare('SELECT max_user_id FROM profiles WHERE user_id = ?').get(user.id);
  const maxUserId = maxRow && maxRow.max_user_id ? maxRow.max_user_id : null;
  try {
    await sendPasswordResetCode({ email: user.email, maxUserId }, code, RESET_CODE_EXPIRY_MINUTES);
  } catch (err) {
    logger.warn('auth.reset_code_send_failed', { message: err.message });
  }

  // Вне production отдаём код в ответе, чтобы dev/тесты работали без SMTP.
  if (process.env.NODE_ENV !== 'production') payload.code = code;
  return payload;
}

async function resetPasswordWithCode(email, code, password) {
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return { error: 'Неверный код или email', status: 400 };

  const row = await db
    .prepare(
      `SELECT id, code_hash, attempts
       FROM password_reset_tokens
       WHERE user_id = ?
         AND used = 0
         AND code_hash IS NOT NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(user.id);
  if (!row) return { error: 'Код недействителен или истёк', status: 400 };

  if (row.attempts >= MAX_RESET_CODE_ATTEMPTS) {
    await db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(row.id);
    return { error: 'Превышено число попыток. Запросите новый код.', status: 429 };
  }

  const provided = hashCode(code);
  const match =
    row.code_hash &&
    row.code_hash.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(provided));
  if (!match) {
    await db.prepare('UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    return { error: 'Неверный код', status: 400 };
  }

  const hash = hashPassword(password);
  const tx = db.transaction(async (trx) => {
    await trx
      .prepare('UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?')
      .run(hash, user.id);
    await trx.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(row.id);
  });
  await tx();
  return { ok: true, message: 'Пароль успешно изменён' };
}

module.exports = {
  createResetCode,
  getSafeUserById,
  loginUser,
  registerDirector,
  resetPasswordWithCode,
};
