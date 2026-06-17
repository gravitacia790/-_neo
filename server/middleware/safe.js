const logger = require('../logger');

const ROUTE_PREFIXES = {
  auth: '[auth]',
  profile: '[profile]',
  directors: '[directors]',
  events: '[events]',
  extras: '[extras]',
  ratings: '[ratings]',
  admin: '[admin]',
  notifications: '[notifications]',
  push: '[push]',
  docs: '[docs]',
  messages: '[messages]',
  webpush: '[webpush]',
  max: '[max]',
};

function safe(prefix) {
  const label = ROUTE_PREFIXES[prefix] || `[${prefix}]`;
  return (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      logger.error('route.unhandled_error', { label, method: req.method, path: req.path, message: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
      }
    }
  };
}

module.exports = { safe };
