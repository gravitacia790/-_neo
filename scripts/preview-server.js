// Запуск сервера для preview-панели с in-memory БД (pg-mem), без реального PostgreSQL.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'preview-jwt-secret-at-least-32-characters-long';
process.env.REDIS_URL = '';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@preview.ru';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'preview-admin-123';
const { createApp } = require('../server.js');
const http = require('http');

(async () => {
  const { init } = require('../server/db');
  await init();
  const app = createApp();
  const server = http.createServer(app);
  const { init: initWs } = require('../server/ws');
  await initWs(server);
  const port = Number(process.env.PORT) || 3100;
  server.listen(port, () => console.log('[preview] listening on ' + port));
})();
