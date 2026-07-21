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
process.env.REDIS_URL = '';

const { init: initDb } = await import('../server/db.js');
await initDb();
const { db } = await import('../server/db.js');
const { signToken } = await import('../server/auth.js');

const { default: supertest } = await import('supertest');
const { createApp } = await import('../server.js');
const app = createApp();

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
const bootstrap = await agent.get('/api/auth/me');
csrfToken = parseCsrfFromSetCookie(bootstrap.headers['set-cookie']);
if (!csrfToken) {
  const second = await agent.get('/api/auth/me');
  csrfToken = parseCsrfFromSetCookie(second.headers['set-cookie']);
}
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
    const res = await agent.get('/api/auth/me');
    expect([200, 401]).toContain(res.status);
    var fromThis = parseCsrfFromSetCookie(res.headers['set-cookie']);
    expect(fromThis || csrfToken).toBeTruthy();
  });

  it('Р·Р°РєСЂС‹РІР°РµС‚ СЃРѕРµРґРёРЅРµРЅРёРµ СЃ JWT РѕС‚РєР»РѕРЅС‘РЅРЅРѕРіРѕ РґРёСЂРµРєС‚РѕСЂР°', async () => {
    await db
      .prepare(
        `INSERT INTO users (email, password_hash, name, role, approval_status)
         VALUES (?, ?, ?, 'director', 'rejected')
         ON CONFLICT (email) DO NOTHING`
      )
      .run('ws-rejected@school.ru', 'not-a-real-login-hash', 'WS Rejected');
    const rejected = await db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get('ws-rejected@school.ru');
    expect(rejected).toBeTruthy();
    const rejectedToken = signToken(rejected);

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${wsPort}/ws`, {
        headers: { Cookie: `token=${encodeURIComponent(rejectedToken)}` },
      });
      const t = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.on('close', (code) => {
        clearTimeout(t);
        expect(code).toBe(1008);
        resolve();
      });
      ws.on('error', reject);
    });
  });
});

describe('Auth', () => {
  it('POST /api/auth/register — создаёт заявку и не авторизует пользователя', async () => {
    const res = await apiPost('/api/auth/register').send({
      name: 'Тестовый Директор',
      email: 'test@school.ru',
      password: 'test123456',
      phone: '+7 (999) 999-99-99',
    });
    expect(res.status).toBe(202);
    expect(res.body.token).toBeUndefined();
    expect(res.body.pendingApproval).toBe(true);
    expect(res.body.user.name).toBe('Тестовый Директор');

    const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
    const adminNotification = await db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM notifications
         WHERE user_id = ? AND type = 'registration_pending' AND message LIKE ?`
      )
      .get(admin.id, '%test@school.ru%');
    expect(Number(adminNotification.c)).toBe(1);
  });

  it('POST /api/auth/register — не даёт создать дубликат', async () => {
    const res = await apiPost('/api/auth/register').send({
      name: 'Дубликат',
      email: 'test@school.ru',
      password: 'test123456',
    });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login — не пускает до подтверждения', async () => {
    const res = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'test123456',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ожидает подтверждения');
  });

  it('PUT /api/admin/applications/:id — админ подтверждает заявку', async () => {
    const adminLogin = await apiPost('/api/auth/login').send({
      email: 'admin@test.ru',
      password: 'admin123',
    });
    expect(adminLogin.status).toBe(200);
    const applications = await apiGet('/api/admin/applications').set(
      'Authorization',
      `Bearer ${adminLogin.body.token}`
    );
    const application = applications.body.applications.find((item) => item.email === 'test@school.ru');
    expect(application).toBeTruthy();
    const approve = await apiPut('/api/admin/applications/' + application.id)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');
    const decisionNotification = await db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM notifications
         WHERE user_id = ? AND type = 'registration_decision' AND title = ?`
      )
      .get(application.id, 'Регистрация подтверждена');
    expect(Number(decisionNotification.c)).toBe(1);

    const repeat = await apiPut('/api/admin/applications/' + application.id)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'rejected' });
    expect(repeat.status).toBe(404);
  });

  it('POST /api/auth/login — успешный вход после подтверждения', async () => {
    const res = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'test123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
  });

  it('PUT /api/admin/applications/:id — отклонённая заявка не получает доступ', async () => {
    const email = 'rejected@school.ru';
    const registration = await apiPost('/api/auth/register').send({
      name: 'Отклонённый Директор',
      email,
      password: 'test123456',
    });
    expect(registration.status).toBe(202);

    const adminLogin = await apiPost('/api/auth/login').send({
      email: 'admin@test.ru',
      password: 'admin123',
    });
    const applications = await apiGet('/api/admin/applications').set(
      'Authorization',
      `Bearer ${adminLogin.body.token}`
    );
    const application = applications.body.applications.find((item) => item.email === email);
    const rejection = await apiPut('/api/admin/applications/' + application.id)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'rejected' });
    expect(rejection.status).toBe(200);
    const decisionNotification = await db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM notifications
         WHERE user_id = ? AND type = 'registration_decision' AND title = ?`
      )
      .get(application.id, 'Заявка отклонена');
    expect(Number(decisionNotification.c)).toBe(1);

    const login = await apiPost('/api/auth/login').send({ email, password: 'test123456' });
    expect(login.status).toBe(403);
    expect(login.body.error).toContain('отклонена');
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
    await db
      .prepare("UPDATE users SET approval_status = 'approved', approved_at = NOW() WHERE email = ?")
      .run(email);
    for (let i = 0; i < 4; i++) {
      const res = await apiPost('/api/auth/login').send({ email, password: 'wrong' });
      expect(res.status).toBe(401);
    }
    const blocked = await apiPost('/api/auth/login').send({ email, password: 'wrong' });
    expect(blocked.status).toBe(429);
  });

  it('POST /api/auth/forgot-password + reset-password — сбрасывает пароль по коду', async () => {
    const forgot = await apiPost('/api/auth/forgot-password').send({ email: 'test@school.ru' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.code).toMatch(/^\d{6}$/);

    const reset = await apiPost('/api/auth/reset-password').send({
      email: 'test@school.ru',
      code: forgot.body.code,
      password: 'newpass123',
    });
    expect(reset.status).toBe(200);

    const login = await apiPost('/api/auth/login').send({
      email: 'test@school.ru',
      password: 'newpass123',
    });
    expect(login.status).toBe(200);
  });

  it('POST /api/auth/reset-password — неверный код отклоняется', async () => {
    await apiPost('/api/auth/forgot-password').send({ email: 'test@school.ru' });
    const reset = await apiPost('/api/auth/reset-password').send({
      email: 'test@school.ru',
      code: '000000',
      password: 'whatever123',
    });
    expect(reset.status).toBe(400);
  });

  it('POST /api/auth/forgot-password — не раскрывает несуществующий email', async () => {
    const res = await apiPost('/api/auth/forgot-password').send({ email: 'nobody@nowhere.ru' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBeUndefined();
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

  it('телефон директора скрыт по умолчанию и раскрывается только по его выбору', async () => {
    const ownProfile = await apiGet('/api/profile').set('Authorization', `Bearer ${token}`);
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.profile.phonePublic).toBe(false);

    const target = await db.prepare('SELECT id, phone FROM users WHERE email = ?').get('test@school.ru');
    const peer = await db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get('anna@school3.ru');
    const peerToken = signToken(peer);
    const profilePayload = {
      phone: target.phone,
      experience: ownProfile.body.profile.experience,
      interests: ownProfile.body.profile.interests,
      isMentor: ownProfile.body.profile.isMentor,
      consent: ownProfile.body.profile.consent,
      strengths: (ownProfile.body.profile.strengths || []).map((item) => ({
        name: item.name,
        val: item.value,
      })),
      skills: ownProfile.body.profile.skills || [],
      tags: ownProfile.body.profile.tags || [],
    };

    const hidden = await apiGet('/api/directors/' + target.id).set('Authorization', `Bearer ${peerToken}`);
    expect(hidden.status).toBe(200);
    expect(hidden.body.director.phone).toBe(null);

    const open = await apiPut('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...profilePayload, phonePublic: true });
    expect(open.status).toBe(200);
    expect(open.body.profile.phonePublic).toBe(true);

    const visible = await apiGet('/api/directors/' + target.id).set('Authorization', `Bearer ${peerToken}`);
    expect(visible.status).toBe(200);
    expect(visible.body.director.phone).toBe(target.phone);

    const close = await apiPut('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...profilePayload, phonePublic: false });
    expect(close.status).toBe(200);
    expect(close.body.profile.phonePublic).toBe(false);
  });

  it('GET/PUT /api/profile/school — сохраняет и возвращает школу', async () => {
    var save = await apiPut('/api/profile/school').set('Authorization', `Bearer ${token}`).send({
      name: 'School API Test',
      address: 'Test Address 42',
      students: 777,
      teachers: 55,
      type: 'Лицей',
      buildingCount: 2,
      usefulExperience: 'Useful school experience',
      wantToKnow: 'Need advanced school practices',
    });
    expect(save.status).toBe(200);
    expect(save.body.school.name).toBe('School API Test');

    var load = await apiGet('/api/profile/school').set('Authorization', `Bearer ${token}`);
    expect(load.status).toBe(200);
    expect(load.body.school.name).toBe('School API Test');
    expect(load.body.school.students).toBe(777);
  });

  it('директор может запросить номер, а владелец — подтвердить точечный доступ', async () => {
    const target = await db.prepare('SELECT id, email, name, role, phone FROM users WHERE email = ?').get('elena@school11.ru');
    const requester = await db.prepare('SELECT id FROM users WHERE email = ?').get('test@school.ru');
    await db.prepare('UPDATE users SET phone_public = FALSE WHERE id = ?').run(target.id);
    const targetToken = signToken(target);

    const request = await apiPost('/api/phone-visibility-requests/' + target.id)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(request.status).toBe(200);
    expect(request.body.status).toBe('pending');

    const duplicate = await apiPost('/api/phone-visibility-requests/' + target.id)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.status).toBe('pending');
    expect(duplicate.body.requestId).toBe(request.body.requestId);

    const targetNotification = await db
      .prepare('SELECT type, entity_id FROM notifications WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1')
      .get(target.id, 'phone_visibility_request');
    expect(targetNotification.type).toBe('phone_visibility_request');
    expect(Number(targetNotification.entity_id)).toBe(Number(request.body.requestId));

    const approve = await apiPut('/api/phone-visibility-requests/' + request.body.requestId)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ decision: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    const visible = await apiGet('/api/directors/' + target.id).set('Authorization', `Bearer ${token}`);
    expect(visible.status).toBe(200);
    expect(visible.body.director.phone).toBe(target.phone);

    const responseNotification = await db
      .prepare('SELECT type, message FROM notifications WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1')
      .get(requester.id, 'phone_visibility_response');
    expect(responseNotification.type).toBe('phone_visibility_response');
    expect(responseNotification.message).toContain('разрешил');
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

  it('POST /api/directors/:id/favorite — добавляет и снимает избранное', async () => {
    const list = await apiGet('/api/directors').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const target = list.body.directors.find((d) => d.email !== 'test@school.ru');
    expect(target).toBeTruthy();

    const add = await apiPost('/api/directors/' + target.id + '/favorite').set('Authorization', `Bearer ${token}`).send({});
    expect(add.status).toBe(200);
    expect(add.body.isFavorite).toBe(true);

    const remove = await apiPost('/api/directors/' + target.id + '/favorite').set('Authorization', `Bearer ${token}`).send({});
    expect(remove.status).toBe(200);
    expect(remove.body.isFavorite).toBe(false);
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
    const owner = await db.prepare('SELECT id FROM users WHERE email = ?').get('test@school.ru');
    const notification = await db
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND type = ? AND message LIKE ?')
      .get(owner.id, 'event_created', '%Тестовое мероприятие%');
    expect(Number(notification.c)).toBeGreaterThan(0);
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

  it('POST /api/events/:id/register — регистрирует участника', async () => {
    const create = await apiPost('/api/events').set('Authorization', `Bearer ${token}`).send({
      title: 'Registration Event',
      date: '01 июля 2026',
      description: 'event for registration API',
      max: 3,
    });
    expect(create.status).toBe(200);
    const eventId = create.body.event.id;

    const reg = await apiPost('/api/events/' + eventId + '/register').set('Authorization', `Bearer ${token}`).send({
      employeeName: 'API Employee',
      position: 'Методист',
      schoolName: 'API School',
    });
    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);

    const list = await apiGet('/api/events?limit=100').set('Authorization', `Bearer ${token}`);
    const event = list.body.events.find((e) => e.id === eventId);
    const registration = event.registrations.find((r) => r.employeeName === 'API Employee');
    expect(registration.id).toBeTruthy();

    const cancel = await apiDelete('/api/events/' + eventId + '/registrations/' + registration.id).set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.ok).toBe(true);
  });

  it('PUT /api/events/:id — редактирует и скрывает архивное мероприятие', async () => {
    const create = await apiPost('/api/events').set('Authorization', `Bearer ${token}`).send({
      title: 'Editable Event',
      date: '10 августа 2026',
      description: 'event to edit',
      max: 8,
    });
    expect(create.status).toBe(200);
    const eventId = create.body.event.id;

    const update = await apiPut('/api/events/' + eventId).set('Authorization', `Bearer ${token}`).send({
      title: 'Edited Archived Event',
      date: '11 августа 2026',
      description: 'edited and archived',
      max: 12,
      status: 'archived',
    });
    expect(update.status).toBe(200);
    expect(update.body.event.status).toBe('archived');

    const list = await apiGet('/api/events?limit=100').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.events.some((e) => e.id === eventId)).toBe(false);
  });
});

describe('Registration contact privacy', () => {
  it('GET /api/events hides private registration contacts from unrelated directors', async () => {
    const annaLogin = await apiPost('/api/auth/login').send({
      email: 'anna@school3.ru',
      password: 'demo1234',
    });
    expect(annaLogin.status).toBe(200);
    const annaToken = annaLogin.body.token;

    const outsiderLogin = await apiPost('/api/auth/login').send({
      email: 'ekaterina@school22.ru',
      password: 'demo1234',
    });
    expect(outsiderLogin.status).toBe(200);
    const outsiderToken = outsiderLogin.body.token;

    const create = await apiPost('/api/events').set('Authorization', `Bearer ${token}`).send({
      title: 'Private Contacts Event',
      date: '05 September 2026',
      description: 'event privacy check',
      max: 10,
    });
    expect(create.status).toBe(200);
    const eventId = create.body.event.id;

    const reg = await apiPost('/api/events/' + eventId + '/register').set('Authorization', `Bearer ${annaToken}`).send({
      employeeName: 'Private Contact Employee',
      position: 'Deputy',
      schoolName: 'Private Contact School',
      phone: '+7 999 111 22 33',
      city: 'Kolomna',
    });
    expect(reg.status).toBe(200);

    const creatorList = await apiGet('/api/events?limit=100').set('Authorization', `Bearer ${token}`);
    const creatorEvent = creatorList.body.events.find((e) => e.id === eventId);
    expect(creatorEvent.creatorEmail).toBe('test@school.ru');
    const creatorRegistration = creatorEvent.registrations.find((r) => r.employeeName === 'Private Contact Employee');
    expect(creatorRegistration.phone).toBe('+7 999 111 22 33');
    expect(creatorRegistration.city).toBe('Kolomna');
    expect(creatorRegistration.canViewContacts).toBe(true);

    const ownerList = await apiGet('/api/events?limit=100').set('Authorization', `Bearer ${annaToken}`);
    const ownerEvent = ownerList.body.events.find((e) => e.id === eventId);
    const ownerRegistration = ownerEvent.registrations.find((r) => r.employeeName === 'Private Contact Employee');
    expect(ownerRegistration.phone).toBe('+7 999 111 22 33');
    expect(ownerRegistration.canCancel).toBe(true);

    const outsiderList = await apiGet('/api/events?limit=100').set('Authorization', `Bearer ${outsiderToken}`);
    const outsiderEvent = outsiderList.body.events.find((e) => e.id === eventId);
    expect(outsiderEvent).toBeTruthy();
    expect(outsiderEvent.creator).toBeTruthy();
    expect(outsiderEvent.creatorEmail).toBe('');
    const outsiderRegistration = outsiderEvent.registrations.find((r) => r.employeeName === 'Private Contact Employee');
    expect(outsiderRegistration.phone).toBe('');
    expect(outsiderRegistration.city).toBe('');
    expect(outsiderRegistration.registeredBy).toBe(null);
    expect(outsiderRegistration.canViewContacts).toBe(false);
    expect(outsiderRegistration.canCancel).toBe(false);
  });

  it('GET /api/extras hides private registration contacts from unrelated directors', async () => {
    const annaLogin = await apiPost('/api/auth/login').send({
      email: 'anna@school3.ru',
      password: 'demo1234',
    });
    expect(annaLogin.status).toBe(200);
    const annaToken = annaLogin.body.token;

    const outsiderLogin = await apiPost('/api/auth/login').send({
      email: 'ekaterina@school22.ru',
      password: 'demo1234',
    });
    expect(outsiderLogin.status).toBe(200);
    const outsiderToken = outsiderLogin.body.token;

    const reg = await apiPost('/api/extras/internship/int1/register').set('Authorization', `Bearer ${annaToken}`).send({
      employeeName: 'Private Extra Employee',
      position: 'Deputy',
      schoolName: 'Private Extra School',
      phone: '+7 999 444 55 66',
      city: 'Dmitrov',
    });
    expect(reg.status).toBe(200);

    const ownerList = await apiGet('/api/extras/internship').set('Authorization', `Bearer ${annaToken}`);
    const ownerItem = ownerList.body.items.find((item) => item.id === 'int1');
    const ownerRegistration = ownerItem.registrations.find((r) => r.employeeName === 'Private Extra Employee');
    expect(ownerRegistration.phone).toBe('+7 999 444 55 66');
    expect(ownerRegistration.city).toBe('Dmitrov');
    expect(ownerRegistration.canViewContacts).toBe(true);
    expect(ownerRegistration.canCancel).toBe(true);

    const outsiderList = await apiGet('/api/extras/internship').set('Authorization', `Bearer ${outsiderToken}`);
    const outsiderItem = outsiderList.body.items.find((item) => item.id === 'int1');
    const outsiderRegistration = outsiderItem.registrations.find((r) => r.employeeName === 'Private Extra Employee');
    expect(outsiderRegistration.phone).toBe('');
    expect(outsiderRegistration.city).toBe('');
    expect(outsiderRegistration.registeredBy).toBe(null);
    expect(outsiderRegistration.canViewContacts).toBe(false);
    expect(outsiderRegistration.canCancel).toBe(false);
  });
});

describe('AI search', () => {
  it('POST /api/ai/search reports missing OpenAI key without pretending to search', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const res = await apiPost('/api/ai/search').set('Authorization', `Bearer ${token}`).send({
      query: 'Нужно найти директора с опытом запуска инженерных классов',
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('OPENAI_API_KEY');
    if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
  });

  it('двухэтапный поиск: интерпретация запроса попадает в ответ и расширяет подбор', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const realFetch = global.fetch;
    process.env.OPENAI_API_KEY = 'test-openai-key';

    // Готовим AI-индекс напрямую: демо-директор с опытом по теме запроса
    const director = await db
      .prepare("SELECT id FROM users WHERE role = 'director' AND approval_status = 'approved' AND email <> 'test@school.ru' LIMIT 1")
      .get();
    expect(director).toBeTruthy();
    await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ?').run(director.id);
    await db
      .prepare(
        `INSERT INTO director_ai_profiles (user_id, source_hash, source_text, embedding_json, updated_at)
         VALUES (?, ?, ?, ?, NOW())`
      )
      .run(
        director.id,
        'test-hash',
        'Может помочь, реализованный опыт: внедрила программу против буллинга и медиацию конфликтов',
        JSON.stringify([1, 0, 0])
      );

    // Мок OpenAI: embeddings → фиксированный вектор; responses → интерпретация или валидация
    global.fetch = async (url, opts) => {
      const body = String((opts && opts.body) || '');
      let payload;
      if (String(url).includes('/embeddings')) {
        payload = { data: [{ embedding: [1, 0, 0] }] };
      } else if (body.includes('JSON-объектом')) {
        // Этап 1: интерпретация запроса (синоним «буллинг» для «травля»)
        payload = { output_text: '{"task": "остановить травлю в школе", "keywords": ["травля", "буллинг", "конфликт", "медиация"]}' };
      } else {
        // Этап 2: валидация кандидатов
        payload = { output_text: '[{"rank": 1, "relevant": true, "reason": "Есть опыт программы против буллинга"}]' };
      }
      return { ok: true, status: 200, json: async () => payload };
    };

    try {
      const res = await apiPost('/api/ai/search').set('Authorization', `Bearer ${token}`).send({
        query: 'Как остановить травлю среди учеников?',
      });
      expect(res.status).toBe(200);
      // Интерпретация возвращается пользователю
      expect(res.body.intent).toBeTruthy();
      expect(res.body.intent.task).toBe('остановить травлю в школе');
      expect(res.body.intent.keywords).toContain('буллинг');
      // Директор найден: лексическое совпадение по синониму «буллинг» из intent,
      // хотя в самом запросе этого слова нет
      expect(res.body.matches.length).toBeGreaterThan(0);
      expect(res.body.matches[0].director.id).toBe(director.id);
      expect(res.body.matches[0].reason).toContain('буллинг');
    } finally {
      global.fetch = realFetch;
      if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
      else delete process.env.OPENAI_API_KEY;
      await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ?').run(director.id);
    }
  });

  it('директор с темой только в «Хочет узнать» не попадает в выдачу', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const realFetch = global.fetch;
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const directors = await db
      .prepare("SELECT id FROM users WHERE role = 'director' AND approval_status = 'approved' AND email <> 'test@school.ru' ORDER BY id LIMIT 2")
      .all();
    expect(directors.length).toBe(2);
    const seeker = directors[0]; // хочет узнать про инженерные классы (опыта нет)
    const expert = directors[1]; // реально запускал инженерные классы
    await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ? OR user_id = ?').run(seeker.id, expert.id);
    await db
      .prepare(
        `INSERT INTO director_ai_profiles (user_id, source_hash, source_text, embedding_json, updated_at)
         VALUES (?, ?, ?, ?, NOW())`
      )
      .run(
        seeker.id,
        'hash-seeker',
        // Старый формат индекса: поле «Хочет узнать» ещё внутри source_text
        'Может помочь, реализованный опыт: организация питания\nХочет узнать: как запустить инженерные классы',
        JSON.stringify([1, 0, 0])
      );
    await db
      .prepare(
        `INSERT INTO director_ai_profiles (user_id, source_hash, source_text, embedding_json, updated_at)
         VALUES (?, ?, ?, ?, NOW())`
      )
      .run(expert.id, 'hash-expert', 'Может помочь, реализованный опыт: запустил инженерные классы с нуля', JSON.stringify([1, 0, 0]));

    global.fetch = async (url, opts) => {
      const body = String((opts && opts.body) || '');
      let payload;
      if (String(url).includes('/embeddings')) {
        payload = { data: [{ embedding: [1, 0, 0] }] };
      } else if (body.includes('JSON-объектом')) {
        payload = { output_text: '{"task": "запустить инженерные классы", "keywords": ["инженерные", "классы", "профильное обучение"]}' };
      } else {
        // Валидатор: одобряет только кандидата с реализованным опытом.
        const req = JSON.parse(body);
        const candidates = JSON.parse(String(req.input).split('Кандидаты:\n')[1]);
        // source кандидатов не должен содержать поле «Хочет узнать»
        candidates.forEach((c) => expect(c.source).not.toContain('Хочет узнать'));
        const verdicts = candidates.map((c) => ({
          rank: c.rank,
          relevant: c.source.includes('запустил инженерные классы'),
          reason: c.source.includes('запустил инженерные классы') ? 'Реализованный опыт запуска инженерных классов' : '',
        }));
        payload = { output_text: JSON.stringify(verdicts) };
      }
      return { ok: true, status: 200, json: async () => payload };
    };

    try {
      const res = await apiPost('/api/ai/search').set('Authorization', `Bearer ${token}`).send({
        query: 'Нужен коллега с опытом запуска инженерных классов',
      });
      expect(res.status).toBe(200);
      const ids = res.body.matches.map((m) => m.director.id);
      // Эксперт найден, «желающий узнать» — нет, несмотря на лексическое
      // совпадение «инженерные классы» в его старой записи индекса
      expect(ids).toContain(expert.id);
      expect(ids).not.toContain(seeker.id);
    } finally {
      global.fetch = realFetch;
      if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
      else delete process.env.OPENAI_API_KEY;
      await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ? OR user_id = ?').run(seeker.id, expert.id);
    }
  });

  it('сбой интерпретации не ломает поиск (запасной режим без intent)', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const realFetch = global.fetch;
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const director = await db
      .prepare("SELECT id FROM users WHERE role = 'director' AND approval_status = 'approved' AND email <> 'test@school.ru' LIMIT 1")
      .get();
    await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ?').run(director.id);
    await db
      .prepare(
        `INSERT INTO director_ai_profiles (user_id, source_hash, source_text, embedding_json, updated_at)
         VALUES (?, ?, ?, ?, NOW())`
      )
      .run(director.id, 'test-hash-2', 'Может помочь, реализованный опыт: запуск инженерных классов', JSON.stringify([1, 0, 0]));

    global.fetch = async (url, opts) => {
      const body = String((opts && opts.body) || '');
      if (String(url).includes('/embeddings')) {
        return { ok: true, status: 200, json: async () => ({ data: [{ embedding: [1, 0, 0] }] }) };
      }
      if (body.includes('JSON-объектом')) {
        // Этап 1 падает — сервис должен продолжить без интерпретации
        return { ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }) };
      }
      return { ok: true, status: 200, json: async () => ({ output_text: '[{"rank": 1, "relevant": true, "reason": "Опыт инженерных классов"}]' }) };
    };

    try {
      const res = await apiPost('/api/ai/search').set('Authorization', `Bearer ${token}`).send({
        query: 'Нужен опыт запуска инженерных классов',
      });
      expect(res.status).toBe(200);
      expect(res.body.intent).toBeNull();
      expect(res.body.matches.length).toBeGreaterThan(0);
    } finally {
      global.fetch = realFetch;
      if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
      else delete process.env.OPENAI_API_KEY;
      await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ?').run(director.id);
    }
  });
});

describe('AI assistant', () => {
  it('continues an existing conversation when PostgreSQL returns BIGSERIAL ids as strings', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const realFetch = global.fetch;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ output_text: 'Тестовый ответ ассистента.' }),
    });

    try {
      const first = await apiPost('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({
        conversationId: null,
        content: 'Мне пишет родитель, помогите составить ответ.',
      });
      expect(first.status).toBe(200);
      expect(first.body.conversation).toBeTruthy();

      const second = await apiPost('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({
        conversationId: String(first.body.conversation.id),
        content: 'Так я написал',
      });
      expect(second.status).toBe(200);
      expect(second.body.message.content).toBe('Тестовый ответ ассистента.');
    } finally {
      global.fetch = realFetch;
      if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
      else delete process.env.OPENAI_API_KEY;
    }
  });
});

describe('Extras', () => {
  it('POST/DELETE /api/extras/:category/:eventId/register — регистрирует и отменяет участника', async () => {
    const reg = await apiPost('/api/extras/gl/gl1/register').set('Authorization', `Bearer ${token}`).send({
      employeeName: 'Extra Employee',
      position: 'Директор',
      schoolName: 'Extra School',
      phone: '+7 999 000 00 00',
      city: 'Химки',
    });
    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);

    const list = await apiGet('/api/extras/gl').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const item = list.body.items.find((e) => e.id === 'gl1');
    const registration = item.registrations.find((r) => r.employeeName === 'Extra Employee');
    expect(registration.id).toBeTruthy();

    const cancel = await apiDelete('/api/extras/gl/gl1/registrations/' + registration.id).set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.ok).toBe(true);
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
  async function loginAdmin() {
    const loginRes = await apiPost('/api/auth/login').send({
      email: 'admin@test.ru',
      password: 'admin123',
    });
    expect(loginRes.status).toBe(200);
    return loginRes.body.token;
  }

  it('GET /api/admin/users — доступ запрещён директору', async () => {
    const res = await apiGet('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/users — админ получает список', async () => {
    const adminToken = await loginAdmin();
    const res = await apiGet('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeInstanceOf(Array);
  });

  it('GET /api/admin/registrations — админ получает регистрации', async () => {
    const directorRes = await apiGet('/api/admin/registrations').set('Authorization', `Bearer ${token}`);
    expect(directorRes.status).toBe(403);

    const adminToken = await loginAdmin();
    const res = await apiGet('/api/admin/registrations').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.registrations).toBeInstanceOf(Array);
    if (res.body.registrations.length) {
      expect(res.body.registrations[0].sourceKey).toBeTruthy();
    }
  });

  it('GET /api/admin/overview — админ получает показатели', async () => {
    const adminToken = await loginAdmin();
    const res = await apiGet('/api/admin/overview').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.overview.directors).toBe('number');
    expect(typeof res.body.overview.events).toBe('number');
    expect(typeof res.body.overview.registrationsLast7Days).toBe('number');
    expect(typeof res.body.overview.activeDirectors7d).toBe('number');
    expect(typeof res.body.overview.activeDirectors30d).toBe('number');
    expect(typeof res.body.overview.sleepingDirectors).toBe('number');
    expect(res.body.overview.upcomingEvents).toBeInstanceOf(Array);
    expect(res.body.overview.topEvents).toBeInstanceOf(Array);
    expect(res.body.overview.tabViews).toBeInstanceOf(Array);
  });

  it('POST /api/analytics/event — пишет просмотр вкладки, попадает в обзор', async () => {
    const ok = await apiPost('/api/analytics/event')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'tab_view', meta: 'directors' });
    expect(ok.status).toBe(200);

    const bad = await apiPost('/api/analytics/event')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'hack', meta: 'x' });
    expect(bad.status).toBe(400);

    const adminToken = await loginAdmin();
    const ov = await apiGet('/api/admin/overview').set('Authorization', `Bearer ${adminToken}`);
    const dirRow = ov.body.overview.tabViews.find((t) => t.tab === 'directors');
    expect(dirRow && dirRow.views).toBeGreaterThan(0);
  });

  it('last_seen_at обновляется при обращении к защищённому маршруту', async () => {
    await apiGet('/api/profile').set('Authorization', `Bearer ${token}`);
    const owner = await db.prepare('SELECT last_seen_at FROM users WHERE email = ?').get('test@school.ru');
    expect(owner.last_seen_at).toBeTruthy();
  });

  it('POST /api/admin/materials — создаёт опубликованный материал', async () => {
    const forbidden = await apiPost('/api/admin/materials').set('Authorization', `Bearer ${token}`).send({
      title: 'Forbidden Material',
      url: 'https://example.com/forbidden',
      category: 'gl',
    });
    expect(forbidden.status).toBe(403);

    const adminToken = await loginAdmin();
    const create = await apiPost('/api/admin/materials').set('Authorization', `Bearer ${adminToken}`).send({
      title: 'Материал API',
      description: 'Ссылка на материалы семинара',
      url: 'https://example.com/material',
      category: 'gl',
      materialType: 'presentation',
      published: true,
    });
    expect(create.status).toBe(200);
    expect(create.body.material.title).toBe('Материал API');
    expect(create.body.material.materialType).toBe('presentation');

    const publicList = await apiGet('/api/materials?category=gl').set('Authorization', `Bearer ${token}`);
    expect(publicList.status).toBe(200);
    expect(publicList.body.materials.some((m) => m.title === 'Материал API')).toBe(true);

    const typedList = await apiGet('/api/materials?category=gl&type=presentation').set('Authorization', `Bearer ${token}`);
    expect(typedList.status).toBe(200);
    expect(typedList.body.materials.every((m) => m.materialType === 'presentation')).toBe(true);
  });

  it('GET /api/events — возвращает материалы, привязанные к мероприятию', async () => {
    const adminToken = await loginAdmin();
    const event = await apiPost('/api/events').set('Authorization', `Bearer ${token}`).send({
      title: 'Event With Material',
      date: '20 августа 2026',
      description: 'event with linked material',
      max: 10,
    });
    expect(event.status).toBe(200);
    const eventId = event.body.event.id;

    const material = await apiPost('/api/admin/materials').set('Authorization', `Bearer ${adminToken}`).send({
      title: 'Материал события',
      description: 'Материал внутри карточки события',
      url: 'https://example.com/event-material',
      category: 'calendar',
      materialType: 'recording',
      eventId: String(eventId),
      published: true,
    });
    expect(material.status).toBe(200);

    const list = await apiGet('/api/events?limit=100').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const found = list.body.events.find((e) => e.id === eventId);
    expect(found).toBeTruthy();
    expect(found.materials.some((m) => m.title === 'Материал события' && m.materialType === 'recording')).toBe(true);
  });

  it('POST /api/admin/announcements — отправляет уведомления выбранной аудитории', async () => {
    const forbidden = await apiPost('/api/admin/announcements').set('Authorization', `Bearer ${token}`).send({
      title: 'Нельзя',
      message: 'Директор не может отправлять админские рассылки',
      audience: 'all',
    });
    expect(forbidden.status).toBe(403);

    const adminToken = await loginAdmin();
    const send = await apiPost('/api/admin/announcements').set('Authorization', `Bearer ${adminToken}`).send({
      title: 'Важное объявление',
      message: 'Проверка админской рассылки',
      audience: 'all',
    });
    expect(send.status).toBe(200);
    expect(send.body.recipients).toBeGreaterThan(0);

    const owner = await db.prepare('SELECT id FROM users WHERE email = ?').get('test@school.ru');
    const notification = await db
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND type = ? AND title = ?')
      .get(owner.id, 'admin_announcement', 'Важное объявление');
    expect(Number(notification.c)).toBeGreaterThan(0);

    const historyForbidden = await apiGet('/api/admin/announcements').set('Authorization', `Bearer ${token}`);
    expect(historyForbidden.status).toBe(403);

    const history = await apiGet('/api/admin/announcements').set('Authorization', `Bearer ${adminToken}`);
    expect(history.status).toBe(200);
    expect(history.body.announcements).toBeInstanceOf(Array);
    const announcement = history.body.announcements.find((a) => a.title === 'Важное объявление');
    expect(announcement).toBeTruthy();
    expect(announcement.recipientCount).toBe(send.body.recipients);
  });
});

describe('MAX integration', () => {
  const savedEnv = {};
  beforeAll(() => {
    ['MAX_BOT_TOKEN', 'MAX_BOT_NAME', 'MAX_WEBHOOK_SECRET', 'MAX_API_BASE'].forEach((k) => {
      savedEnv[k] = process.env[k];
    });
  });
  afterAll(() => {
    Object.keys(savedEnv).forEach((k) => {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
  });

  it('status — интеграция выключена без токена', async () => {
    delete process.env.MAX_BOT_TOKEN;
    const res = await apiGet('/api/integrations/max/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('link — 503 пока интеграция не настроена', async () => {
    delete process.env.MAX_BOT_TOKEN;
    const res = await apiPost('/api/integrations/max/link').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('полный цикл привязки через webhook bot_started', async () => {
    process.env.MAX_BOT_TOKEN = 'test-token';
    process.env.MAX_BOT_NAME = 'GravitaciaBot';
    process.env.MAX_WEBHOOK_SECRET = 'wh-secret';
    process.env.MAX_API_BASE = 'http://127.0.0.1:1'; // недостижимо: отправка тихо падает

    const status0 = await apiGet('/api/integrations/max/status').set('Authorization', `Bearer ${token}`);
    expect(status0.body.enabled).toBe(true);
    expect(status0.body.linked).toBe(false);

    const link = await apiPost('/api/integrations/max/link').set('Authorization', `Bearer ${token}`);
    expect(link.status).toBe(200);
    expect(link.body.deepLink).toContain('https://max.ru/GravitaciaBot?start=');
    const nonce = link.body.deepLink.split('start=')[1];
    expect(nonce).toBeTruthy();

    const querySecret = await apiPost('/api/integrations/max/webhook?secret=wh-secret').send({
      update_type: 'bot_started',
      payload: nonce,
      user: { user_id: 555001, username: 'tester' },
    });
    expect(querySecret.status).toBe(403);

    const wrongSecret = await apiPost('/api/integrations/max/webhook')
      .set('x-max-webhook-secret', 'nope')
      .send({
      update_type: 'bot_started',
      payload: nonce,
      user: { user_id: 555001, username: 'tester' },
    });
    expect(wrongSecret.status).toBe(403);

    const hook = await apiPost('/api/integrations/max/webhook')
      .set('x-max-webhook-secret', 'wh-secret')
      .send({
      update_type: 'bot_started',
      payload: nonce,
      user: { user_id: 555001, username: 'tester' },
    });
    expect(hook.status).toBe(200);

    const status1 = await apiGet('/api/integrations/max/status').set('Authorization', `Bearer ${token}`);
    expect(status1.body.linked).toBe(true);
    expect(status1.body.maxUsername).toBe('tester');

    const unlink = await apiPost('/api/integrations/max/unlink').set('Authorization', `Bearer ${token}`);
    expect(unlink.status).toBe(200);
    const status2 = await apiGet('/api/integrations/max/status').set('Authorization', `Bearer ${token}`);
    expect(status2.body.linked).toBe(false);
  });

  it('webhook с истёкшим/неверным nonce не привязывает', async () => {
    process.env.MAX_BOT_TOKEN = 'test-token';
    process.env.MAX_BOT_NAME = 'GravitaciaBot';
    process.env.MAX_WEBHOOK_SECRET = 'wh-secret';
    process.env.MAX_API_BASE = 'http://127.0.0.1:1';

    const hook = await apiPost('/api/integrations/max/webhook')
      .set('x-max-webhook-secret', 'wh-secret')
      .send({
      update_type: 'bot_started',
      payload: 'totally-invalid-nonce',
      user: { user_id: 555002, username: 'ghost' },
    });
    expect(hook.status).toBe(200);
    const status = await apiGet('/api/integrations/max/status').set('Authorization', `Bearer ${token}`);
    expect(status.body.linked).toBe(false);
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
