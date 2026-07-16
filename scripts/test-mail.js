require('dotenv').config();

const { sendEmail } = require('../server/services/notifier');

const to = process.argv[2] || process.env.MAIL_TEST_TO;

function mask(value) {
  if (!value) return 'MISSING';
  return 'SET';
}

async function main() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((name) => !process.env[name]);

  console.log('[mail:test] SMTP_HOST=' + mask(process.env.SMTP_HOST));
  console.log('[mail:test] SMTP_PORT=' + mask(process.env.SMTP_PORT));
  console.log('[mail:test] SMTP_SECURE=' + mask(process.env.SMTP_SECURE));
  console.log('[mail:test] SMTP_USER=' + mask(process.env.SMTP_USER));
  console.log('[mail:test] SMTP_PASS=' + mask(process.env.SMTP_PASS));
  console.log('[mail:test] MAIL_FROM=' + mask(process.env.MAIL_FROM || process.env.SMTP_USER));

  if (missing.length) {
    throw new Error('Missing SMTP settings: ' + missing.join(', '));
  }
  if (!to) {
    throw new Error('Recipient is required. Run: npm run mail:test -- you@example.com');
  }

  const now = new Date().toISOString();
  const result = await sendEmail(
    to,
    'Test email — Гравитация',
    'This is a test email from Гравитация. Time: ' + now,
    '<p>This is a test email from <strong>Гравитация</strong>.</p><p>Time: ' + now + '</p>'
  );

  if (!result.sent) {
    throw new Error('Email was not sent: ' + (result.reason || 'unknown reason'));
  }
  console.log('[mail:test] Sent to ' + to);
}

main().catch((err) => {
  console.error('[mail:test] Failed: ' + err.message);
  process.exit(1);
});
