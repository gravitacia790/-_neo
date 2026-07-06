const { db } = require('../db');
const { addActivity } = require('../rating');
const { broadcastAndInsert, notifyUser, insertNotification } = require('../ws');
const { sendPushToMany, sendPushToUser } = require('../push');

async function getSchoolName(userId) {
  const row = await db.prepare('SELECT name FROM schools WHERE user_id = ?').get(userId);
  return row ? row.name : 'Школа не указана';
}

function serializeRegistration(row, viewer, event) {
  const canSeePrivate =
    viewer && (viewer.role === 'admin' || event.creator_id === viewer.id || row.registered_by === viewer.id);
  return {
    id: row.id,
    employeeName: row.employee_name,
    position: row.position,
    schoolName: row.school_name,
    phone: canSeePrivate ? row.phone || '' : '',
    city: canSeePrivate ? row.city || '' : '',
    registeredBy: canSeePrivate ? row.registered_by : null,
    registeredAt: row.registered_at,
    canViewContacts: !!canSeePrivate,
    canCancel: !!(viewer && (viewer.role === 'admin' || event.creator_id === viewer.id || row.registered_by === viewer.id)),
  };
}

async function listEvents(viewer, page, limit) {
  const offset = (page - 1) * limit;
  const totalRow = await db.prepare("SELECT COUNT(*) AS c FROM events WHERE deleted_at IS NULL AND status = 'published'").get();
  const total = Number(totalRow.c);
  const events = await db
    .prepare("SELECT * FROM events WHERE deleted_at IS NULL AND status = 'published' ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(limit, offset);
  if (!events.length) return { events: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };

  const eventIds = events.map((e) => e.id);
  const placeholders = eventIds.map(() => '?').join(',');
  const creatorIds = [...new Set(events.map((e) => e.creator_id))];
  const allRegs = await db
    .prepare(
      `SELECT id, event_id, employee_name, position, school_name, phone, city, registered_by, registered_at FROM event_registrations WHERE event_id IN (${placeholders}) ORDER BY registered_at`
    )
    .all(...eventIds);
  const regsByEvent = {};
  for (const r of allRegs) {
    if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
    regsByEvent[r.event_id].push(r);
  }
  const cPlaceholders = creatorIds.map(() => '?').join(',');
  const materialRows = await db
    .prepare(
      `SELECT id, title, description, url, category, material_type, event_id
       FROM seminar_materials
       WHERE published = 1 AND event_id IN (${placeholders})
       ORDER BY created_at DESC`
    )
    .all(...eventIds.map((id) => String(id)));
  const materialsByEvent = {};
  for (const m of materialRows) {
    if (!materialsByEvent[m.event_id]) materialsByEvent[m.event_id] = [];
    materialsByEvent[m.event_id].push({
      id: m.id,
      title: m.title,
      description: m.description || '',
      url: m.url,
      category: m.category,
      materialType: m.material_type || 'link',
    });
  }
  const creators = await db
    .prepare(
      `SELECT u.id, u.name, u.email, s.name AS school_name FROM users u LEFT JOIN schools s ON s.user_id = u.id WHERE u.id IN (${cPlaceholders})`
    )
    .all(...creatorIds);
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
        status: e.status || 'published',
        materials: materialsByEvent[String(e.id)] || [],
        registrations: (regsByEvent[e.id] || []).map((r) => serializeRegistration(r, viewer, e)),
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function createEvent(user, data) {
  const info = await db
    .prepare(
      'INSERT INTO events (title, date, description, max_participants, creator_id) VALUES (?, ?, ?, ?, ?) RETURNING id'
    )
    .run(data.title, data.date, data.description, data.max, user.id);
  await addActivity(user.id, 'create_event', `Создал мероприятие "${data.title}"`, 10);
  if (data.isSpeaker) await addActivity(user.id, 'speaker', `Выступил спикером на "${data.title}"`, 15);
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  await broadcastAndInsert('event_created', 'Новое мероприятие', `Создано мероприятие "${data.title}"`);
  const recipients = await db
    .prepare("SELECT id FROM users WHERE role = 'admin' OR approval_status = 'approved'")
    .all();
  await sendPushToMany(
    recipients.map((r) => r.id),
    {
      type: 'event_created',
      title: 'Новое мероприятие',
      body: `Создано мероприятие "${data.title}"`,
      url: '/',
      tag: `event_created:${row.id}`,
    }
  );
  return {
    event: {
      id: row.id,
      title: row.title,
      date: row.date,
      description: row.description,
      max: row.max_participants,
      creator: user.name,
      creatorSchool: await getSchoolName(user.id),
      creatorEmail: user.email,
      creatorId: user.id,
      registrations: [],
    },
  };
}

async function registerForEvent(user, eventId, data) {
  const result = await db.transaction(async (trx) => {
    const ev = await trx
      .prepare("SELECT * FROM events WHERE id = ? AND deleted_at IS NULL AND status = 'published' FOR UPDATE")
      .get(eventId);
    if (!ev) return { error: 'Мероприятие не найдено', status: 404 };
    const dupRow = await trx
      .prepare(
        'SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ? AND employee_name = ? AND registered_by = ?'
      )
      .get(ev.id, data.employeeName, user.id);
    const dup = Number(dupRow.c);
    if (dup > 0) return { error: 'Вы уже зарегистрировали этого сотрудника', status: 409 };
    const countRow = await trx
      .prepare('SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ?')
      .get(ev.id);
    const count = Number(countRow.c);
    if (count >= ev.max_participants) return { error: 'Максимум участников', status: 409 };
    await trx
      .prepare(
        'INSERT INTO event_registrations (event_id, employee_name, position, school_name, phone, city, registered_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(ev.id, data.employeeName, data.position, data.schoolName, data.phone || '', data.city || '', user.id);
    return { ev };
  })();
  if (result.error) return result;

  await addActivity(user.id, 'participation', `Зарегистрировал ${data.employeeName} на "${result.ev.title}"`, 2);
  await insertNotification(
    result.ev.creator_id,
    'event_registered',
    'Новый участник',
    `${data.employeeName} зарегистрирован на "${result.ev.title}"`
  );
  if (result.ev.creator_id !== user.id) {
    notifyUser(result.ev.creator_id, 'event_registered', { eventId: result.ev.id, employeeName: data.employeeName, registeredBy: user.name });
    await sendPushToUser(result.ev.creator_id, {
      type: 'event_registered',
      title: 'Новый участник',
      body: `${data.employeeName} зарегистрирован на "${result.ev.title}"`,
      url: '/',
      tag: `event_registered:${result.ev.id}`,
    });
  }
  return { ok: true };
}

async function updateEvent(user, eventId, data) {
  const ev = await db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(eventId);
  if (!ev) return { error: 'Не найдено', status: 404 };
  if (ev.creator_id !== user.id && user.role !== 'admin') return { error: 'Редактировать можно только свои мероприятия', status: 403 };
  await db
    .prepare(
      `UPDATE events
       SET title = ?, date = ?, description = ?, max_participants = ?, status = ?, updated_at = NOW()
       WHERE id = ?`
    )
    .run(data.title, data.date, data.description, data.max, data.status || ev.status || 'published', ev.id);
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id);
  return {
    event: {
      id: row.id,
      title: row.title,
      date: row.date,
      description: row.description,
      max: row.max_participants,
      status: row.status || 'published',
      creatorId: row.creator_id,
      updatedAt: row.updated_at,
    },
  };
}

async function cancelEventRegistration(user, eventId, registrationId) {
  const row = await db
    .prepare(
      `SELECT r.id, r.registered_by, r.employee_name, e.creator_id, e.title
       FROM event_registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.id = ? AND r.event_id = ? AND e.deleted_at IS NULL`
    )
    .get(registrationId, eventId);
  if (!row) return { error: 'Регистрация не найдена', status: 404 };
  const canCancel = user.role === 'admin' || row.creator_id === user.id || row.registered_by === user.id;
  if (!canCancel) return { error: 'Недостаточно прав для отмены регистрации', status: 403 };
  await db.prepare('DELETE FROM event_registrations WHERE id = ?').run(row.id);
  await addActivity(user.id, 'cancel_participation', `Отменил регистрацию ${row.employee_name} на "${row.title}"`, 0);
  return { ok: true };
}

async function deleteEvent(user, eventId) {
  const ev = await db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(eventId);
  if (!ev) return { error: 'Не найдено', status: 404 };
  if (ev.creator_id !== user.id && user.role !== 'admin') return { error: 'Удалять можно только свои мероприятия', status: 403 };
  await db.prepare('UPDATE events SET deleted_at = NOW() WHERE id = ?').run(ev.id);
  await broadcastAndInsert('event_deleted', 'Мероприятие удалено', `Мероприятие "${ev.title}" удалено`, ev.creator_id);
  const recipients = await db
    .prepare(
      "SELECT id FROM users WHERE id != ? AND (role = 'admin' OR approval_status = 'approved')"
    )
    .all(ev.creator_id);
  await sendPushToMany(
    recipients.map((r) => r.id),
    {
      type: 'event_deleted',
      title: 'Мероприятие удалено',
      body: `Мероприятие "${ev.title}" удалено`,
      url: '/',
      tag: `event_deleted:${ev.id}`,
    }
  );
  return { ok: true };
}

module.exports = { cancelEventRegistration, createEvent, deleteEvent, listEvents, registerForEvent, updateEvent };
