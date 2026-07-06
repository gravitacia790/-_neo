// Локальный запуск для preview-проверки: БД pg-mem в памяти (демо-директора),
// без внешнего PostgreSQL и без чтения боевого .env (NODE_ENV=test задаётся до require).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'preview-jwt-secret-at-least-32-characters-long';
process.env.REDIS_URL = '';
// Сид админа для проверки админ-панели в preview.
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gravitacia.ru';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'previewadmin123';
const PORT = process.env.PORT || 3000;

(async () => {
  const { init } = require('../server/db');
  await init();
  const { createApp } = require('../server.js');
  const http = require('http');
  const app = createApp();
  const server = http.createServer(app);
  const { init: initWs } = require('../server/ws');
  await initWs(server);
  server.listen(PORT, () => console.log('[preview] listening on http://localhost:' + PORT));
})().catch((err) => {
  console.error('[preview] failed:', err.message);
  process.exit(1);
});
