const { WebSocket, WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');
const { verifyToken } = require('./auth');
const { db } = require('./db');
const logger = require('./logger');
const { createRedisClient } = require('./redis');

let wss = null;
let heartbeatTimer = null;
const MAX_BUFFERED_BYTES = 1024 * 1024;
const MAX_CONNECTIONS = Number(process.env.WS_MAX_CONNECTIONS) || 2000;
const WS_REDIS_CHANNEL = process.env.WS_REDIS_CHANNEL || 'ws:broadcast';
let pubClient = null;
let subClient = null;
let redisEnabled = false;
const WS_INSTANCE_ID = randomUUID();

function extractToken(req) {
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

async function initRedisBus() {
  if (process.env.REDIS_ENABLED === 'false' || !process.env.REDIS_URL) {
    redisEnabled = false;
    return;
  }
  try {
    pubClient = await createRedisClient({ REDIS_URL: process.env.REDIS_URL }, 'ws-pub');
    subClient = await createRedisClient({ REDIS_URL: process.env.REDIS_URL }, 'ws-sub');
    await subClient.subscribe(WS_REDIS_CHANNEL, (payload) => {
      try {
        const parsed = JSON.parse(payload);
        if (!parsed || !parsed.type) return;
        if (parsed.senderId === WS_INSTANCE_ID) return;
        if (parsed.type === 'broadcast') {
          broadcastLocal(parsed.data);
          return;
        }
        if (parsed.type === 'user') {
          sendToUserLocal(parsed.userId, parsed.data);
        }
      } catch (err) {
        logger.warn('ws.redis_payload_invalid', { message: err.message });
      }
    });
    redisEnabled = true;
    logger.info('ws.redis_enabled', { channel: WS_REDIS_CHANNEL });
  } catch (err) {
    redisEnabled = false;
    logger.warn('ws.redis_disabled', { message: err.message });
    if (pubClient) {
      try {
        await pubClient.quit();
      } catch (quitErr) {
        logger.warn('ws.redis_pub_quit_failed', { message: quitErr.message });
      }
      pubClient = null;
    }
    if (subClient) {
      try {
        await subClient.quit();
      } catch (quitErr) {
        logger.warn('ws.redis_sub_quit_failed', { message: quitErr.message });
      }
      subClient = null;
    }
  }
}

async function init(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    ws.on('error', () => {});
    if (wss.clients.size > MAX_CONNECTIONS) {
      ws.close(1013, 'Server capacity reached');
      return;
    }

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

    let user;
    try {
      user = await db.prepare('SELECT id, role, approval_status FROM users WHERE id = ?').get(payload.id);
    } catch (err) {
      logger.warn('ws.auth_lookup_failed', { message: err.message });
      ws.close(1011, 'Auth lookup failed');
      return;
    }
    if (!user || (user.role !== 'admin' && user.approval_status !== 'approved')) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    ws._userId = user.id;
    ws._userRole = user.role;
    require('./lastSeen').touchLastSeen(user.id);
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Подключено к real-time серверу' }));
  });

  heartbeatTimer = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client) => {
      if (client.isAlive === false) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);
  heartbeatTimer.unref();

  await initRedisBus();
  return wss;
}

function safeSend(client, message) {
  if (client.readyState !== WebSocket.OPEN) return;
  if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
    client.terminate();
    return;
  }
  client.send(message);
}

function broadcastLocal(data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (!client._userId) return;
    safeSend(client, message);
  });
}

function sendToUserLocal(userId, data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  const targetId = Number(userId);
  const targetStr = String(userId);
  wss.clients.forEach((client) => {
    const clientNum = Number(client._userId);
    const clientStr = String(client._userId);
    if (clientNum === targetId || clientStr === targetStr) safeSend(client, message);
  });
}

async function publishRedisEnvelope(envelope) {
  if (!redisEnabled || !pubClient) return false;
  try {
    await pubClient.publish(WS_REDIS_CHANNEL, JSON.stringify({ senderId: WS_INSTANCE_ID, ...envelope }));
    return true;
  } catch (err) {
    logger.warn('ws.redis_publish_failed', { message: err.message });
    return false;
  }
}

function broadcast(data) {
  broadcastLocal(data);
  void publishRedisEnvelope({ type: 'broadcast', data });
}

function sendToUser(userId, data) {
  sendToUserLocal(userId, data);
  void publishRedisEnvelope({ type: 'user', userId, data });
}

function notify(eventType, payload) {
  broadcast({ type: eventType, ...payload, timestamp: new Date().toISOString() });
}

function notifyUser(userId, eventType, payload) {
  sendToUser(userId, { type: eventType, ...payload, timestamp: new Date().toISOString() });
}

async function close() {
  if (!wss) return Promise.resolve();

  const activeServer = wss;
  wss = null;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  activeServer.clients.forEach((client) => client.terminate());
  const wsClosePromise = new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceCloseTimer);
      resolve();
    };
    const forceCloseTimer = setTimeout(finish, 2000);
    forceCloseTimer.unref();
    activeServer.close(finish);
  });

  if (subClient) {
    try {
      await subClient.unsubscribe(WS_REDIS_CHANNEL);
      await subClient.quit();
    } catch (quitErr) {
      logger.warn('ws.redis_sub_close_failed', { message: quitErr.message });
    }
    subClient = null;
  }
  if (pubClient) {
    try {
      await pubClient.quit();
    } catch (quitErr) {
      logger.warn('ws.redis_pub_close_failed', { message: quitErr.message });
    }
    pubClient = null;
  }
  redisEnabled = false;

  return wsClosePromise;
}

async function insertNotification(userId, type, title, message, entityId) {
  await db
    .prepare('INSERT INTO notifications (user_id, type, title, message, entity_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, message, entityId || null);
}

async function insertNotificationsForUsers(userIds, type, title, message) {
  const ids = Array.from(new Set((userIds || []).map(Number).filter(Number.isFinite)));
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const result = await db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT id, ?, ?, ? FROM users WHERE id IN (${placeholders})`
    )
    .run(type, title, message, ...ids);
  return result.rowCount;
}

async function broadcastAndInsert(eventType, title, message, excludeUserId) {
  const exclude = excludeUserId || 0;
  await db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, message)
     SELECT id, ?, ?, ? FROM users WHERE id != ?`
    )
    .run(eventType, title, message, exclude);
  broadcast({ type: eventType, title, message, timestamp: new Date().toISOString() });
}

module.exports = {
  init,
  close,
  broadcast,
  sendToUser,
  notify,
  notifyUser,
  insertNotification,
  insertNotificationsForUsers,
  broadcastAndInsert,
};
