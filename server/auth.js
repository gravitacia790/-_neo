const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TTL = '7d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: TTL }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
