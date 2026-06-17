const crypto = require('crypto');

const CSRF_COOKIE = 'csrf';
const CSRF_HEADER = 'x-csrf-token';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  const parts = header.split(';');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var eq = part.indexOf('=');
    if (eq === -1) continue;
    var k = part.slice(0, eq).trim();
    var v = part.slice(eq + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch (_) {
      out[k] = v;
    }
  }
  return out;
}

function getOrCreateToken(req) {
  // cookie-parser populates req.cookies, but keep a fallback for safety
  const existing =
    (req.cookies && req.cookies[CSRF_COOKIE]) || parseCookies(req.headers.cookie || '')[CSRF_COOKIE];
  if (existing && typeof existing === 'string' && existing.length >= 16) return existing;
  return crypto.randomBytes(24).toString('hex');
}

const CSRF_SKIP_PATHS = new Set(['/health', '/ready', '/api/integrations/max/webhook']);

module.exports = function csrfCheck(req, res, next) {
  if (CSRF_SKIP_PATHS.has(req.path)) {
    return next();
  }

  // Issue CSRF token cookie for all safe requests (double-submit).
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const token = getOrCreateToken(req);
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return next();
  }

  const cookies = req.cookies || parseCookies(req.headers.cookie || '');
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken) return res.status(403).json({ error: 'CSRF: отсутствует cookie' });
  if (!headerToken) return res.status(403).json({ error: 'CSRF: отсутствует заголовок' });
  if (cookieToken !== headerToken) return res.status(403).json({ error: 'CSRF: токен не совпадает' });

  next();
};
