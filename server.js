require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { validateConfig } = require('./server/config');
const logger = require('./server/logger');
const { db, pool } = require('./server/db');

const config = validateConfig(process.env);

const { init: initDb, checkWeakAdminPassword } = require('./server/db');
const { init: initWs } = require('./server/ws');
// Dev-only: generate ADMIN_PASSWORD in memory before DB seed creates admin.
checkWeakAdminPassword();
let server;

function createApp() {
  const app = express();
  const allowedOrigins = config.ALLOWED_ORIGINS
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.set('trust proxy', config.TRUST_PROXY);

  if (config.NODE_ENV !== 'production') {
    app.use(
      cors({
        origin: function (origin, callback) {
          if (!origin || allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
          callback(null, false);
        },
        credentials: true,
      })
    );
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'", 'wss:', 'https:'],
          'worker-src': ["'self'", 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  app.use(
    morgan(function (tokens, req, res) {
      return JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        event: 'http.request',
        method: tokens.method(req, res),
        path: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        duration_ms: Number(tokens['response-time'](req, res)),
      });
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.get('/csrf-bootstrap', (req, res) => res.json({ ok: true }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/ready', async (req, res) => {
    try {
      const version = await db.prepare('SHOW server_version').get();
      const users = await db.prepare('SELECT COUNT(*) AS c FROM users').get();
      res.json({ status: 'ready', db: 'ok', postgresVersion: version.server_version, users: Number(users.c) });
    } catch (err) {
      logger.error('readiness.failed', { message: err.message });
      res.status(503).json({ status: 'not_ready', db: 'error' });
    }
  });

  app.use(require('./server/middleware/csrf'));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.NODE_ENV === 'test' ? 1000 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много запросов, попробуйте позже' },
  });
  app.use('/api', apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.NODE_ENV === 'test' ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа, попробуйте через 15 минут' },
  });

  app.use('/api/auth', authLimiter);
  const passwordRecoveryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много попыток восстановления пароля, попробуйте позже' },
  });
  app.use('/api/auth/forgot-password', passwordRecoveryLimiter);
  app.use('/api/auth/reset-password', passwordRecoveryLimiter);
  const messagesSendLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много сообщений за короткое время, попробуйте позже' },
  });
  app.use('/api/auth', require('./server/routes/auth'));
  app.use('/api/profile', require('./server/routes/profile'));
  app.use('/api/directors', require('./server/routes/directors'));
  app.use('/api/events', require('./server/routes/events'));
  app.use('/api/extras', require('./server/routes/extras'));
  app.use('/api/ratings', require('./server/routes/ratings'));
  app.use('/api/notifications', require('./server/routes/notifications'));
  app.use('/api/push', require('./server/routes/push'));
  app.use('/api/admin', require('./server/routes/admin'));
  app.use('/api/messages', messagesSendLimiter, require('./server/routes/messages'));
  app.use('/api/docs', require('./server/routes/docs'));

  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/api/stats', async (req, res) => {
    try {
      const row = await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'director'").get();
      res.json({ directors: Number(row.c) });
    } catch (err) {
      logger.error('stats.failed', { message: err.message });
      res.status(500).json({ error: 'Не удалось получить статистику' });
    }
  });

  app.use((err, req, res, _next) => {
    logger.error('http.unhandled_error', { method: req.method, path: req.path, message: err.message });
    res.status(err.status || 500).json({ error: 'Внутренняя ошибка сервера' });
  });
  return app;
}

const app = createApp();
const PORT = config.PORT;
const allowedOrigins = config.ALLOWED_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const http = require('http');
async function startServer() {
  try {
    await initDb();
  } catch (err) {
    logger.error('db.init_failed', {
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : null,
      code: err && err.code ? err.code : null,
    });
    process.exit(1);
  }

  server = http.createServer(app);
  initWs(server);
  server.listen(PORT, () => {
    logger.info('server.started', {
      port: PORT,
      docs: `http://localhost:${PORT}/api/docs`,
      ws: `ws://localhost:${PORT}/ws`,
      corsOrigins: allowedOrigins,
      nodeEnv: config.NODE_ENV,
    });
  });
}
if (require.main === module) {
  startServer();
}

function shutdown(signal) {
  logger.warn('server.shutdown_started', { signal });
  if (!server) {
    process.exit(0);
    return;
  }
  server.close(async () => {
    try {
      await pool.end();
    } catch (_) {
      logger.warn('server.db_close_failed');
    }
    logger.info('server.shutdown_completed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, createApp };
