const { db } = require('../db');

const BASE_FROM_SQL = `
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN schools s ON s.user_id = u.id
  LEFT JOIN ratings r ON r.user_id = u.id
  WHERE u.role = 'director'
`;

const SELECT_SQL = `
  SELECT u.id, u.email, u.name, u.role,
         p.experience, p.interests, p.is_mentor, p.photo, p.city,
         s.name AS school_name, s.address, s.useful_experience, s.want_to_know,
         r.total_score, r.is_public
  ${BASE_FROM_SQL}
`;

function fetchStrengths(userId) {
  return db.prepare('SELECT name, value FROM profile_strengths WHERE user_id = ?').all(userId);
}

function fetchSkills(userId) {
  return db.prepare('SELECT name, level FROM profile_skills WHERE user_id = ?').all(userId);
}

function fetchTags(userId) {
  return db.prepare('SELECT tag FROM profile_tags WHERE user_id = ?').all(userId).map((r) => r.tag);
}

function buildDirectorSearchText(userId) {
  const row = db.prepare(
    `SELECT u.name, p.experience, p.interests, p.city,
            s.name AS school_name, s.address, s.useful_experience, s.want_to_know
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN schools s ON s.user_id = u.id
     WHERE u.id = ? AND u.role = 'director'`
  ).get(userId);
  if (!row) return null;
  return [
    row.name,
    row.school_name,
    row.address,
    row.city,
    row.useful_experience || row.experience,
    row.want_to_know,
    row.interests,
    fetchStrengths(userId).map((s) => s.name).join(' '),
    fetchSkills(userId).map((s) => s.name).join(' '),
    fetchTags(userId).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function reindexDirector(userId) {
  const content = buildDirectorSearchText(userId);
  db.prepare('DELETE FROM director_search WHERE user_id = ?').run(userId);
  if (!content) return;
  db.prepare('INSERT INTO director_search (user_id, content) VALUES (?, ?)').run(userId, content);
}

function serializeDirector(row, viewer, preloaded) {
  const isAdmin = viewer && viewer.role === 'admin';
  const isOwner = viewer && viewer.id === row.id;
  const canSeeEmail = isAdmin || isOwner;
  const ratingVisible = isAdmin || isOwner || !!row.is_public;
  const strengths = preloaded ? preloaded.strengths : fetchStrengths(row.id);
  const skills = preloaded ? preloaded.skills : fetchSkills(row.id);
  const tags = preloaded ? preloaded.tags : fetchTags(row.id);
  const city = row.city || (row.address ? (row.address.split(',')[1] || row.address).trim() : 'МО');

  return {
    id: row.id,
    name: row.name,
    email: canSeeEmail ? row.email : null,
    school: row.school_name || 'Школа не указана',
    city,
    useful: row.useful_experience || row.experience || '',
    wantToKnow: row.want_to_know || '',
    isMentor: !!row.is_mentor,
    strengthsDetailed: strengths,
    skillsDetailed: skills,
    uniqueExperience: row.experience || '',
    personalInterests: (row.interests || '').split('\n').map((s) => s.trim()).filter(Boolean),
    tags,
    photo: row.photo || null,
    rating: ratingVisible ? { totalScore: row.total_score || 0, public: !!row.is_public } : null,
  };
}

function buildSearchClause(q) {
  if (!q) return { sql: '', params: [] };
  const ftsQuery = q
    .split(/\s+/)
    .map((part) => part.replace(/["']/g, '').trim())
    .filter(Boolean)
    .map((part) => part + '*')
    .join(' ');
  if (!ftsQuery) return { sql: '', params: [] };
  return {
    sql: ' AND u.id IN (SELECT CAST(user_id AS INTEGER) FROM director_search WHERE director_search MATCH ?)',
    params: [ftsQuery],
  };
}

function listDirectors(viewer, query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const q = (query.q || '').toString().trim().slice(0, 200);
  const search = buildSearchClause(q);
  const totalStmt = db.prepare('SELECT COUNT(*) AS total ' + BASE_FROM_SQL + search.sql);
  const totalRow = totalStmt.get.apply(totalStmt, search.params);
  const listStmt = db.prepare(SELECT_SQL + search.sql + ' ORDER BY u.name LIMIT ? OFFSET ?');
  const rows = listStmt.all.apply(listStmt, search.params.concat([limit, offset]));

  return {
    directors: rows.map((row) => serializeDirector(row, viewer)),
    pagination: { page, limit, total: totalRow.total, totalPages: Math.ceil(totalRow.total / limit) },
  };
}

function listMentors(viewer) {
  const rows = db.prepare(SELECT_SQL + ' AND p.is_mentor = 1 ORDER BY u.name').all();
  return { mentors: rows.map((row) => serializeDirector(row, viewer)) };
}

function getDirectorById(viewer, userId) {
  const row = db.prepare(SELECT_SQL + ' AND u.id = ?').get(userId);
  if (!row) return { error: 'Не найдено', status: 404 };
  return { director: serializeDirector(row, viewer) };
}

module.exports = { getDirectorById, listDirectors, listMentors, reindexDirector };
