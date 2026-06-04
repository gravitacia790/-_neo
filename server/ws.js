const { WebSocketServer } = require('ws');
const { verifyToken } = require('./auth');
const { db } = require('./db');

let wss = null;

function extractToken(req) {
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('token');
}

function init(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.on('error', () => {});

    const token = extractToken(req);
    if (!token) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    ws._userId = payload.id;
    ws._userRole = payload.role;

    ws.send(JSON.stringify({ type: 'connected', message: 'Подключено к real-time серверу' }));
  });

  return wss;
}

function broadcast(data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return;
    if (!client._userId) return;
    client.send(message);
  });
}

function sendToUser(userId, data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  const targetId = Number(userId);
  const targetStr = String(userId);
  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return;
    const clientNum = Number(client._userId);
    const clientStr = String(client._userId);
    if (clientNum === targetId || clientStr === targetStr) client.send(message);
  });
}

function notify(eventType, payload) {
  broadcast({ type: eventType, ...payload, timestamp: new Date().toISOString() });
}

function notifyUser(userId, eventType, payload) {
  sendToUser(userId, { type: eventType, ...payload, timestamp: new Date().toISOString() });
}

async function insertNotification(userId, type, title, message) {
  await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
    userId,
    type,
    title,
    message
  );
}

async function broadcastAndInsert(eventType, title, message, excludeUserId) {
  const exclude = excludeUserId || 0;
  broadcast({ type: eventType, title, message, timestamp: new Date().toISOString() });
  await db.prepare(
    `INSERT INTO notifications (user_id, type, title, message)
     SELECT id, ?, ?, ? FROM users WHERE id != ?`
  ).run(eventType, title, message, exclude);
}

module.exports = { init, broadcast, sendToUser, notify, notifyUser, insertNotification, broadcastAndInsert };
