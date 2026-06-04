const { verifyToken } = require('../auth');
const { db } = require('../db');

module.exports = async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.cookies && req.cookies.token) || null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Недействительный токен' });
  const user = await db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(payload.id);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  req.user = user;
  next();
};
