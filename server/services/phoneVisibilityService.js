const { db } = require('../db');
const { insertNotification, notifyUser } = require('../ws');

async function createPhoneVisibilityRequest(viewer, targetId) {
  const id = Number(targetId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Некорректный ID директора', status: 400 };
  if (!viewer || viewer.role !== 'director') return { error: 'Запрос доступен только директорам', status: 403 };
  if (viewer.id === id) return { error: 'Нельзя запросить собственный номер', status: 400 };

  const target = await db
    .prepare(
      `SELECT id, name, phone, role, approval_status
       FROM users
       WHERE id = ? AND role = 'director' AND approval_status = 'approved'`
    )
    .get(id);
  if (!target) return { error: 'Директор не найден', status: 404 };
  if (!target.phone) return { error: 'У директора пока не указан номер телефона', status: 400 };

  const existing = await db
    .prepare('SELECT id, status FROM phone_visibility_requests WHERE requester_id = ? AND target_id = ?')
    .get(viewer.id, id);

  if (existing && existing.status === 'approved') {
    return { ok: true, status: 'approved', requestId: existing.id, phone: target.phone };
  }
  if (existing && existing.status === 'pending') {
    return { ok: true, status: 'pending', requestId: existing.id };
  }

  let requestId;
  if (existing) {
    await db
      .prepare(
        `UPDATE phone_visibility_requests
         SET status = 'pending', created_at = NOW(), responded_at = NULL
         WHERE id = ?`
      )
      .run(existing.id);
    requestId = existing.id;
  } else {
    const inserted = await db
      .prepare(
        `INSERT INTO phone_visibility_requests (requester_id, target_id, status)
         VALUES (?, ?, 'pending')
         RETURNING id`
      )
      .run(viewer.id, id);
    requestId = inserted.lastInsertRowid;
  }

  const title = 'Запрос на номер телефона';
  const message = `${viewer.name || 'Директор'} запросил(а) разрешение увидеть ваш номер телефона.`;
  await insertNotification(target.id, 'phone_visibility_request', title, message, requestId);
  notifyUser(target.id, 'phone_visibility_request', {
    title,
    message,
    requestId,
    requesterId: viewer.id,
  });

  return { ok: true, status: 'pending', requestId };
}

async function respondToPhoneVisibilityRequest(viewer, requestId, decision) {
  const id = Number(requestId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Некорректный ID запроса', status: 400 };
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'Некорректное решение', status: 400 };

  const request = await db
    .prepare(
      `SELECT r.id, r.requester_id, r.target_id, r.status,
              requester.name AS requester_name,
              target.name AS target_name, target.phone
       FROM phone_visibility_requests r
       JOIN users requester ON requester.id = r.requester_id
       JOIN users target ON target.id = r.target_id
       WHERE r.id = ? AND r.target_id = ?`
    )
    .get(id, viewer.id);
  if (!request) return { error: 'Запрос не найден', status: 404 };
  if (request.status !== 'pending') return { ok: true, status: request.status, requestId: request.id };
  if (decision === 'approved' && !request.phone) {
    return { error: 'Сначала укажите номер телефона в профиле', status: 400 };
  }

  await db
    .prepare(
      `UPDATE phone_visibility_requests
       SET status = ?, responded_at = NOW()
       WHERE id = ? AND target_id = ?`
    )
    .run(decision, id, viewer.id);

  const approved = decision === 'approved';
  const title = approved ? 'Номер телефона доступен' : 'Запрос на номер отклонён';
  const message = approved
    ? `${request.target_name || 'Директор'} разрешил(а) вам увидеть номер телефона. Теперь можно связаться с коллегой.`
    : `${request.target_name || 'Директор'} отклонил(а) запрос на номер телефона.`;
  await insertNotification(request.requester_id, 'phone_visibility_response', title, message, request.id);
  notifyUser(request.requester_id, 'phone_visibility_response', {
    title,
    message,
    requestId: request.id,
    targetId: request.target_id,
    status: decision,
  });

  return { ok: true, status: decision, requestId: request.id };
}

module.exports = { createPhoneVisibilityRequest, respondToPhoneVisibilityRequest };
