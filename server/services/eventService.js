const { db } = require('../db');
const { addActivity } = require('../rating');
const { broadcastAndInsert, notifyUser, insertNotification } = require('../ws');

function getSchoolName(userId) {
  const row = db.prepare('SELECT name FROM schools WHERE user_id = ?').get(userId);
  return row ? row.name : 'Школа не указана';
}

function listEvents(page, limit) {
  const offset = (page - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) AS c FROM events WHERE deleted_at IS NULL').get().c;
  const events = db.prepare('SELECT * FROM events WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  if (!events.length) return { events: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };

  const eventIds = events.map((e) => e.id);
  const placeholders = eventIds.map(() => '?').join(',');
  const creatorIds = [...new Set(events.map((e) => e.creator_id))];
  const allRegs = db.prepare(`SELECT event_id, employee_name, position, school_name, registered_at FROM event_registrations WHERE event_id IN (${placeholders}) ORDER BY registered_at`).all(...eventIds);
  const regsByEvent = {};
  for (const r of allRegs) {
    if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
    regsByEvent[r.event_id].push({ employeeName: r.employee_name, position: r.position, schoolName: r.school_name, registeredAt: r.registered_at });
  }
  const cPlaceholders = creatorIds.map(() => '?').join(',');
  const creators = db.prepare(`SELECT u.id, u.name, u.email, s.name AS school_name FROM users u LEFT JOIN schools s ON s.user_id = u.id WHERE u.id IN (${cPlaceholders})`).all(...creatorIds);
  const creatorMap = {};
  for (const c of creators) creatorMap[c.id] = c;

  return {
    events: events.map((e) => {
      const c = creatorMap[e.creator_id];
      return {
        id: e.id,
        title: e.title,
        date: e.date,
        description: e.description,
        max: e.max_participants,
        creator: c ? c.name : 'Неизвестно',
        creatorSchool: c ? c.school_name || 'Школа не указана' : '',
        creatorEmail: c ? c.email : '',
        creatorId: e.creator_id,
        registrations: regsByEvent[e.id] || [],
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function createEvent(user, data) {
  const info = db.prepare('INSERT INTO events (title, date, description, max_participants, creator_id) VALUES (?, ?, ?, ?, ?)').run(data.title, data.date, data.description, data.max, user.id);
  addActivity(user.id, 'create_event', `Создал мероприятие "${data.title}"`, 10);
  if (data.isSpeaker) addActivity(user.id, 'speaker', `Выступил спикером на "${data.title}"`, 15);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  broadcastAndInsert('event_created', 'Новое мероприятие', `Создано мероприятие "${data.title}"`, user.id);
  return {
    event: {
      id: row.id,
      title: row.title,
      date: row.date,
      description: row.description,
      max: row.max_participants,
      creator: user.name,
      creatorSchool: getSchoolName(user.id),
      creatorEmail: user.email,
      creatorId: user.id,
      registrations: [],
    },
  };
}

function registerForEvent(user, eventId, data) {
  const result = db.transaction(() => {
    const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(eventId);
    if (!ev) return { error: 'Мероприятие не найдено', status: 404 };
    const dup = db.prepare('SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ? AND employee_name = ? AND registered_by = ?').get(ev.id, data.employeeName, user.id).c;
    if (dup > 0) return { error: 'Вы уже зарегистрировали этого сотрудника', status: 409 };
    const count = db.prepare('SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ?').get(ev.id).c;
    if (count >= ev.max_participants) return { error: 'Максимум участников', status: 409 };
    db.prepare('INSERT INTO event_registrations (event_id, employee_name, position, school_name, registered_by) VALUES (?, ?, ?, ?, ?)').run(ev.id, data.employeeName, data.position, data.schoolName, user.id);
    return { ev };
  })();
  if (result.error) return result;

  addActivity(user.id, 'participation', `Зарегистрировал ${data.employeeName} на "${result.ev.title}"`, 2);
  insertNotification(result.ev.creator_id, 'event_registered', 'Новый участник', `${data.employeeName} зарегистрирован на "${result.ev.title}"`);
  if (result.ev.creator_id !== user.id) {
    notifyUser(result.ev.creator_id, 'event_registered', { eventId: result.ev.id, employeeName: data.employeeName, registeredBy: user.name });
  }
  return { ok: true };
}

function deleteEvent(user, eventId) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(eventId);
  if (!ev) return { error: 'Не найдено', status: 404 };
  if (ev.creator_id !== user.id && user.role !== 'admin') return { error: 'Удалять можно только свои мероприятия', status: 403 };
  db.prepare("UPDATE events SET deleted_at = datetime('now') WHERE id = ?").run(ev.id);
  broadcastAndInsert('event_deleted', 'Мероприятие удалено', `Мероприятие "${ev.title}" удалено`, ev.creator_id);
  return { ok: true };
}

module.exports = { createEvent, deleteEvent, listEvents, registerForEvent };
