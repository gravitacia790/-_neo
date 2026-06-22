const { verifyToken } = require('../auth');
const { db } = require('../db');
const { touchLastSeen } = require('../lastSeen');

module.exports = async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.cookies && req.cookies.token) || null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Недействительный токен' });
  const user = await db
    .prepare('SELECT id, email, name, role, approval_status FROM users WHERE id = ?')
    .get(payload.id);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  if (user.role !== 'admin' && user.approval_status !== 'approved') {
    return res.status(403).json({ error: 'Доступ к аккаунту ещё не подтверждён администратором' });
  }
  req.user = user;
  touchLastSeen(user.id);
  next();
};
