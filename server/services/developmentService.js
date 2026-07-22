const { db } = require('../db');

function normalizeText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function mapTrack(row, actions) {
  const items = actions || [];
  const completed = items.filter((item) => item.status === 'completed').length;
  return {
    id: row.id,
    title: row.title,
    focusArea: row.focus_area || '',
    outcome: row.outcome || '',
    status: row.status,
    targetDate: row.target_date || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    actions: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      weekNumber: item.week_number,
      status: item.status,
      completedAt: item.completed_at || null,
    })),
    progress: items.length ? Math.round((completed / items.length) * 100) : 0,
  };
}

async function getOwnedTrack(userId, trackId) {
  return db.prepare('SELECT * FROM development_tracks WHERE id = ? AND user_id = ?').get(trackId, userId);
}

async function getDashboard(userId) {
  const trackRows = await db
    .prepare("SELECT * FROM development_tracks WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 3")
    .all(userId);
  const tracks = [];
  for (const row of trackRows) {
    const actions = await db
      .prepare('SELECT * FROM development_actions WHERE track_id = ? ORDER BY week_number ASC, id ASC')
      .all(row.id);
    tracks.push(mapTrack(row, actions));
  }
  const reflections = await db
    .prepare(
      `SELECT r.id, r.track_id, r.content, r.created_at, t.title AS track_title
       FROM development_reflections r
       JOIN development_tracks t ON t.id = r.track_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 5`
    )
    .all(userId);
  return {
    tracks,
    reflections: reflections.map((item) => ({
      id: item.id,
      trackId: item.track_id,
      trackTitle: item.track_title,
      content: item.content,
      createdAt: item.created_at,
    })),
  };
}

async function createTrack(userId, data) {
  const title = normalizeText(data.title, 180);
  if (!title) {
    const error = new Error('Укажите, над чем вы хотите работать.');
    error.status = 400;
    throw error;
  }
  const result = await db
    .prepare(
      `INSERT INTO development_tracks (user_id, title, focus_area, outcome, target_date)
       VALUES (?, ?, ?, ?, ?) RETURNING id`
    )
    .run(userId, title, normalizeText(data.focusArea, 300), normalizeText(data.outcome, 1000), data.targetDate || null);
  const track = await getOwnedTrack(userId, result.lastInsertRowid);
  return mapTrack(track, []);
}

async function addAction(userId, trackId, data) {
  const track = await getOwnedTrack(userId, trackId);
  if (!track) return null;
  const title = normalizeText(data.title, 300);
  if (!title) {
    const error = new Error('Опишите практику или действие.');
    error.status = 400;
    throw error;
  }
  const weekNumber = Math.min(Math.max(Number(data.weekNumber) || 1, 1), 12);
  await db
    .prepare(
      `INSERT INTO development_actions (track_id, title, description, week_number)
       VALUES (?, ?, ?, ?)`
    )
    .run(trackId, title, normalizeText(data.description, 2000), weekNumber);
  await db.prepare('UPDATE development_tracks SET updated_at = NOW() WHERE id = ?').run(trackId);
  return getTrack(userId, trackId);
}

async function updateAction(userId, actionId, status) {
  const action = await db
    .prepare(
      `SELECT a.id, a.track_id
       FROM development_actions a
       JOIN development_tracks t ON t.id = a.track_id
       WHERE a.id = ? AND t.user_id = ?`
    )
    .get(actionId, userId);
  if (!action) return null;
  await db
    .prepare('UPDATE development_actions SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ?')
    .run(status, status === 'completed' ? new Date().toISOString() : null, actionId);
  await db.prepare('UPDATE development_tracks SET updated_at = NOW() WHERE id = ?').run(action.track_id);
  return getTrack(userId, action.track_id);
}

async function addReflection(userId, trackId, content, actionId) {
  const track = await getOwnedTrack(userId, trackId);
  if (!track) return null;
  const normalized = normalizeText(content, 4000);
  if (!normalized) {
    const error = new Error('Напишите короткую рефлексию.');
    error.status = 400;
    throw error;
  }
  if (actionId) {
    const action = await db.prepare('SELECT id FROM development_actions WHERE id = ? AND track_id = ?').get(actionId, trackId);
    if (!action) {
      const error = new Error('Практика не найдена в этом треке.');
      error.status = 400;
      throw error;
    }
  }
  await db.prepare('INSERT INTO development_reflections (track_id, user_id, action_id, content) VALUES (?, ?, ?, ?)').run(trackId, userId, actionId || null, normalized);
  await db.prepare('UPDATE development_tracks SET updated_at = NOW() WHERE id = ?').run(trackId);
  return getDashboard(userId);
}

async function getTrack(userId, trackId) {
  const track = await getOwnedTrack(userId, trackId);
  if (!track) return null;
  const actions = await db.prepare('SELECT * FROM development_actions WHERE track_id = ? ORDER BY week_number ASC, id ASC').all(trackId);
  return mapTrack(track, actions);
}

async function createPlan(userId, plan) {
  const tx = db.transaction(async (trx) => {
    const title = normalizeText(plan.title, 180);
    const result = await trx
      .prepare('INSERT INTO development_tracks (user_id, title, focus_area, outcome) VALUES (?, ?, ?, ?) RETURNING id')
      .run(userId, title, normalizeText(plan.focusArea, 300), normalizeText(plan.outcome, 1000));
    const trackId = result.lastInsertRowid;
    const addActionStatement = trx.prepare(
      'INSERT INTO development_actions (track_id, title, description, week_number) VALUES (?, ?, ?, ?)'
    );
    for (const action of plan.actions || []) {
      await addActionStatement.run(trackId, normalizeText(action.title, 300), normalizeText(action.description, 2000), Number(action.weekNumber) || 1);
    }
    return trackId;
  });
  const trackId = await tx();
  return getTrack(userId, trackId);
}

module.exports = { addAction, addReflection, createPlan, createTrack, getDashboard, getTrack, updateAction };
