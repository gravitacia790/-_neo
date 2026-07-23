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
  analytics: '[analytics]',
  ai: '[ai]',
};

function safe(prefix) {
  const label = ROUTE_PREFIXES[prefix] || `[${prefix}]`;
  return (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      logger.error('route.unhandled_error', { label, method: req.method, path: req.path, message: err.message });
      if (!res.headersSent) {
        const status = Number(err.status);
        const clientError = status >= 400 && status < 500;
        res.status(clientError || status >= 500 ? status : 500).json({
          error: clientError && err.message ? err.message : 'Внутренняя ошибка сервера',
        });
      }
    }
  };
}

module.exports = { safe };
