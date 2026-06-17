// Канал доставки внешних уведомлений (email сейчас, MAX — следующим шагом).
// SMTP читается из окружения; если он не задан — отправка тихо пропускается
// (dev/test работают без почты, код возвращается в ответе вне production).
const logger = require('../logger');

let nodemailer = null;
try {
  // отложенный require, чтобы отсутствие пакета не валило процесс в окружениях без почты
  nodemailer = require('nodemailer');
} catch (_) {
  nodemailer = null;
}

let transporter = null;
let transporterInitialized = false;

function getTransporter() {
  if (transporterInitialized) return transporter;
  transporterInitialized = true;
  const host = process.env.SMTP_HOST;
  if (!host || !nodemailer) {
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

function emailConfigured() {
  return !!(process.env.SMTP_HOST && nodemailer);
}

async function sendEmail(to, subject, text, html) {
  const t = getTransporter();
  if (!t) {
    logger.warn('notifier.email_skipped_no_smtp', { to });
    return { sent: false, reason: 'smtp_not_configured' };
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to, subject, text, html });
  logger.info('notifier.email_sent', { to, subject });
  return { sent: true };
}

function resetCodeEmail(code, minutes) {
  const subject = 'Код восстановления пароля — Гравитация';
  const text =
    `Ваш код для восстановления пароля: ${code}\n\n` +
    `Код действует ${minutes} минут. Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">` +
    `<h2 style="color:#1a1a1a;">Восстановление пароля</h2>` +
    `<p>Ваш код для восстановления пароля:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#a01b2c;">${code}</p>` +
    `<p style="color:#666;font-size:13px;">Код действует ${minutes} минут. ` +
    `Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>` +
    `</div>`;
  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function registrationDecisionEmail(name, status) {
  const approved = status === 'approved';
  const safeName = escapeHtml(name);
  const subject = approved
    ? 'Регистрация подтверждена — Гравитация'
    : 'Решение по заявке — Гравитация';
  const text = approved
    ? `${name}, ваша регистрация в приложении «Гравитация» подтверждена. Теперь вы можете войти, используя свой email и пароль.`
    : `${name}, заявка на регистрацию в приложении «Гравитация» отклонена. Для уточнения причины обратитесь к администратору проекта.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">` +
    `<h2 style="color:#1a1a1a;">${approved ? 'Регистрация подтверждена' : 'Заявка отклонена'}</h2>` +
    `<p>${safeName}, ${
      approved
        ? 'ваша регистрация в приложении «Гравитация» подтверждена.'
        : 'ваша заявка на регистрацию в приложении «Гравитация» отклонена.'
    }</p>` +
    `<p>${
      approved
        ? 'Теперь вы можете войти, используя свой email и пароль.'
        : 'Для уточнения причины обратитесь к администратору проекта.'
    }</p>` +
    `</div>`;
  return { subject, text, html };
}

async function sendRegistrationDecision(targets, status) {
  if (!targets || !targets.email) return { sent: false, reason: 'email_missing' };
  const tpl = registrationDecisionEmail(targets.name || 'Здравствуйте', status);
  try {
    return await sendEmail(targets.email, tpl.subject, tpl.text, tpl.html);
  } catch (err) {
    logger.warn('notifier.registration_decision_email_failed', {
      message: err.message,
      status,
    });
    return { sent: false, reason: 'send_failed' };
  }
}

// targets: { email, maxUserId } — каналы доставки кода. Возвращает true, если код
// доставлен хотя бы одним каналом.
async function sendPasswordResetCode(targets, code, minutes) {
  let delivered = false;
  if (targets && targets.email) {
    const tpl = resetCodeEmail(code, minutes);
    try {
      const res = await sendEmail(targets.email, tpl.subject, tpl.text, tpl.html);
      if (res.sent) delivered = true;
    } catch (err) {
      logger.warn('notifier.reset_code_email_failed', { message: err.message });
    }
  }
  if (targets && targets.maxUserId) {
    const { sendMaxMessage } = require('./maxService');
    try {
      const text = `Код восстановления пароля «Гравитация»: ${code}\nДействует ${minutes} минут.`;
      const res = await sendMaxMessage(targets.maxUserId, text);
      if (res.sent) delivered = true;
    } catch (err) {
      logger.warn('notifier.reset_code_max_failed', { message: err.message });
    }
  }
  return delivered;
}

module.exports = {
  sendEmail,
  sendPasswordResetCode,
  sendRegistrationDecision,
  emailConfigured,
};
