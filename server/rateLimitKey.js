const { ipKeyGenerator } = require('express-rate-limit');
const { verifyToken } = require('./auth');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.cookies && req.cookies.token) || null;
}

function authenticatedOrIpKey(req) {
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  if (payload && payload.id) return `user:${payload.id}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
}

module.exports = { authenticatedOrIpKey };
