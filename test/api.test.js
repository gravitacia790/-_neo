import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';

process.env.PORT = '0';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@test.ru';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.VAPID_SUBJECT = '';
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';

const { init: initDb } = await import('../server/db.js');
await initDb();
const { db } = await import('../server/db.js');

const { default: supertest } = await import('supertest');
const express = await import('express');
const helmet = await import('helmet');
const cookieParser = await import('cookie-parser');
const cors = await import('cors');

const app = express.default();
app.use(cors.default({ origin: true, credentials: true }));
app.use(helmet.default({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cookieParser.default());
app.use((await import('../server/middleware/csrf.js')).default);
app.use(express.default.json({ limit: '2mb' }));

app.get('/csrf-bootstrap', (req, res) => res.json({ ok: true }));

app.use('/api/auth', (await import('../server/routes/auth.js')).default);
app.use('/api/profile', (await import('../server/routes/profile.js')).default);
app.use('/api/directors', (await import('../server/routes/directors.js')).default);
app.use('/api/events', (await import('../server/routes/events.js')).default);
app.use('/api/ratings', (await import('../server/routes/ratings.js')).default);
app.use('/api/notifications', (await import('../server/routes/notifications.js')).default);
app.use('/api/admin', (await import('../server/routes/admin.js')).default);
app.use('/api/messages', (await import('../server/routes/messages.js')).default);

function parseCsrfFromSetCookie(setCookie) {
  if (!setCookie) return null;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of list) {
    const m = c.match(/^csrf=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

let agent;
let csrfToken;
let token;
let httpServer;
let wsPort;

beforeAll(async () => {
  agent = supertest.agent(app);
  const bootstrap = await agent.get('/csrf-bootstrap');
  csrfToken = parseCsrfFromSetCookie(bootstrap.headers['set-cookie']);
  expect(csrfToken).toBeTruthy();

  httpServer = http.createServer(app);
  const { init: initWs } = await import('../server/ws.js');
  initWs(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  wsPort = httpServer.address().port;
});

function apiGet(url) {
  return agent.get(url);
}

function apiPost(url) {
  return agent.post(url).set('X-CSRF-Token', csrfToken);
}

function apiPut(url) {
  return agent.put(url).set('X-CSRF-Token', csrfToken);
}

function apiDelete(url) {
  return agent.delete(url).set('X-CSRF-Token', csrfToken);
}

describe('CSRF', () => {
  it('POST без X-CSRF-Token — 403', async () => {
    const res = await agent.post('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'wrong',
    });
    expect(res.status).toBe(403);
  });

  it('GET выдаёт csrf cookie', async () => {
    const res = await agent.get('/csrf-bootstrap');
    expect(res.status).toBe(200);
    expect(parseCsrfFromSetCookie(res.headers['set-cookie'])).toBeTruthy();
  });
});

describe('Auth', () => {
  it('POST /api/auth/register — создаёт пользователя', async () => {
    const res = await apiPost('/api/auth/register').send({
      name: 'Тестовый Директор',
      email: 'test@school.ru',
      password: 'test123456',
      phone: '+7 (999) 999-99-99',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.name).toBe('Тестовый Директор');
    token = res.body.token;
  });

  it('POST /api/auth/register — не даёт создать дубликат', async () => {
    const res = await apiPost('/api/auth/register').send({
      name: 'Дубликат',
      email: 'test@school.ru',
      password: 'test123456',
    });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login — успешный вход', async () => {
    const res = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'test123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('POST /api/auth/login — неверный пароль', async () => {
    const res = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — временная блокировка после 5 неудачных попыток', async () => {
    const email = 'lock@school.ru';
    await apiPost('/api/auth/register').send({
      name: 'Lock User',
      email,
      password: 'test123456',
    });
    for (let i = 0; i < 4; i++) {
      const res = await apiPost('/api/auth/login').send({ email, password: 'wrong' });
      expect(res.status).toBe(401);
    }
    const blocked = await apiPost('/api/auth/login').send({ email, password: 'wrong' });
    expect(blocked.status).toBe(429);
  });

  it('POST /api/auth/forgot-password + reset-password — сбрасывает пароль', async () => {
    const forgot = await apiPost('/api/auth/forgot-password').send({ email: 'test@school.ru' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.token).toBeTruthy();

    const reset = await apiPost('/api/auth/reset-password').send({
      token: forgot.body.token,
      password: 'newpass123',
    });
    expect(reset.status).toBe(200);

    const login = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'newpass123',
    });
    expect(login.status).toBe(200);
  });

  it('GET /api/auth/me — возвращает пользователя', async () => {
    const res = await apiGet('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@school.ru');
  });

  it('GET /api/auth/me — без токена 401', async () => {
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Profile', () => {
  it('GET /api/profile — возвращает профиль', async () => {
    const res = await apiGet('/api/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeTruthy();
  });

  it('PUT /api/profile — сохраняет профиль', async () => {
    const res = await apiPut('/api/profile').set('Authorization', `Bearer ${token}`).send({
      experience: 'Тестовый опыт',
      interests: 'Тестовые интересы',
      isMentor: true,
      strengths: [{ name: 'Лидерство', val: 8 }],
      skills: [{ name: 'Управление', level: 'Эксперт' }],
      tags: ['#Тест'],
    });
    expect(res.status).toBe(200);
  });
});

describe('Directors', () => {
  it('GET /api/directors — список с пагинацией', async () => {
    const res = await apiGet('/api/directors').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.directors).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeTruthy();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
  });

  it('GET /api/directors?page=1&limit=5 — пагинация', async () => {
    const res = await apiGet('/api/directors?page=1&limit=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.directors.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination.limit).toBe(5);
  });

  it('GET /api/directors?q=Тестовый — поиск', async () => {
    const res = await apiGet('/api/directors?q=Тестовый').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.directors.some((d) => d.name.includes('Тестовый'))).toBe(true);
  });

  it('GET /api/directors?q=Лидерство — FTS ищет по strengths/skills', async () => {
    const res = await apiGet('/api/directors?q=Лидерство').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.directors.length).toBeGreaterThan(0);
  });
});

describe('Events', () => {
  it('POST /api/events — создаёт мероприятие', async () => {
    const res = await apiPost('/api/events').set('Authorization', `Bearer ${token}`).send({
      title: 'Тестовое мероприятие',
      date: '15 июня 2026',
      description: 'Описание тестового мероприятия',
      max: 10,
      isSpeaker: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('Тестовое мероприятие');
  });

  it('GET /api/events — список мероприятий', async () => {
    const res = await apiGet('/api/events').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
  });

  it('DELETE /api/events/:id — soft delete скрывает событие из списка', async () => {
    const create = await apiPost('/api/events').set('Authorization', `Bearer ${token}`).send({
      title: 'Удаляемое мероприятие',
      date: '20 июня 2026',
      description: 'Будет скрыто после soft delete',
      max: 5,
    });
    const eventId = create.body.event.id;
    const del = await apiDelete('/api/events/' + eventId).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await apiGet('/api/events').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.events.some((e) => e.id === eventId)).toBe(false);
  });
});

describe('Notifications', () => {
  it('GET /api/notifications — возвращает список уведомлений', async () => {
    const res = await apiGet('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(typeof res.body.unread).toBe('number');
  });

  it('PUT /api/notifications/read-all — помечает всё прочитанным', async () => {
    const res = await apiPut('/api/notifications/read-all').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Messages', () => {
  it('POST /api/messages + GET unread/read-all — работают корректно', async () => {
    const annaLogin = await apiPost('/api/auth/login').send({
      email: 'anna@school3.ru',
      password: 'demo1234',
    });
    const annaToken = annaLogin.body.token;

    const send = await apiPost('/api/messages').set('Authorization', `Bearer ${token}`).send({
      toUserId: annaLogin.body.user.id,
      text: 'Тестовое сообщение для Анны',
    });
    expect(send.status).toBe(200);

    const unread = await apiGet('/api/messages/unread').set('Authorization', `Bearer ${annaToken}`);
    expect(unread.status).toBe(200);
    expect(unread.body.unread).toBeGreaterThan(0);

    const list = await apiGet('/api/messages').set('Authorization', `Bearer ${annaToken}`);
    expect(list.status).toBe(200);
    expect(list.body.messages.some((m) => m.text === 'Тестовое сообщение для Анны')).toBe(true);

    const mark = await apiPut('/api/messages/read-all').set('Authorization', `Bearer ${annaToken}`).send({});
    expect(mark.status).toBe(200);
    expect(mark.body.ok).toBe(true);

    const unreadAfter = await apiGet('/api/messages/unread').set('Authorization', `Bearer ${annaToken}`);
    expect(unreadAfter.body.unread).toBe(0);
  });

  it('архивирует сообщения старше 90 дней', async () => {
    const senderLogin = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'newpass123',
    });
    const senderToken = senderLogin.body.token;
    const senderId = senderLogin.body.user.id;

    const receiverLogin = await apiPost('/api/auth/login').send({
      email: 'anna@school3.ru',
      password: 'demo1234',
    });
    const receiverToken = receiverLogin.body.token;
    const receiverId = receiverLogin.body.user.id;

    await db.prepare(
      `INSERT INTO messages (from_user_id, to_user_id, text, read, created_at)
       VALUES (?, ?, ?, 0, NOW() - INTERVAL '91 days')`
    ).run(senderId, receiverId, 'old message to archive');

    const trigger = await apiGet('/api/messages').set('Authorization', `Bearer ${receiverToken}`);
    expect(trigger.status).toBe(200);

    const archived = await db.prepare('SELECT COUNT(*) AS c FROM messages_archive WHERE text = ?').get('old message to archive');
    expect(Number(archived.c)).toBeGreaterThan(0);

    const active = await db.prepare('SELECT COUNT(*) AS c FROM messages WHERE text = ?').get('old message to archive');
    expect(Number(active.c)).toBe(0);

    const send = await apiPost('/api/messages').set('Authorization', `Bearer ${senderToken}`).send({
      toUserId: receiverId,
      text: 'fresh message after archive check',
    });
    expect(send.status).toBe(200);
  });
});

describe('Ratings', () => {
  it('GET /api/ratings/me — возвращает рейтинг', async () => {
    const res = await apiGet('/api/ratings/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rating).toBeTruthy();
    expect(typeof res.body.rating.totalScore).toBe('number');
  });
});

describe('Admin', () => {
  it('GET /api/admin/users — доступ запрещён директору', async () => {
    const res = await apiGet('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/users — админ получает список', async () => {
    const loginRes = await apiPost('/api/auth/login').send({
      email: 'admin@test.ru',
      password: 'admin123',
    });
    const adminToken = loginRes.body.token;
    const res = await apiGet('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeInstanceOf(Array);
  });
});

describe('WebSocket', () => {
  it('закрывает соединение без токена', async () => {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${wsPort}/ws`);
      const t = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.on('close', (code) => {
        clearTimeout(t);
        expect(code).toBe(1008);
        resolve();
      });
      ws.on('error', reject);
    });
  });

  it('принимает соединение с валидным токеном', async () => {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${wsPort}/ws`, {
        headers: { Cookie: `token=${encodeURIComponent(token)}` },
      });
      const t = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          clearTimeout(t);
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });
  });
});

afterAll(async () => {
  if (httpServer) {
    httpServer.close();
  }
  const { pool } = await import('../server/db.js');
  await pool.end();
});
