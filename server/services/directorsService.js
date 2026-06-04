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

async function fetchStrengths(userId) {
  return db.prepare('SELECT name, value FROM profile_strengths WHERE user_id = ?').all(userId);
}

async function fetchSkills(userId) {
  return db.prepare('SELECT name, level FROM profile_skills WHERE user_id = ?').all(userId);
}

async function fetchTags(userId) {
  const rows = await db.prepare('SELECT tag FROM profile_tags WHERE user_id = ?').all(userId);
  return rows.map((r) => r.tag);
}

async function buildDirectorSearchText(userId) {
  const row = await db
    .prepare(
    `SELECT u.name, p.experience, p.interests, p.city,
            s.name AS school_name, s.address, s.useful_experience, s.want_to_know
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN schools s ON s.user_id = u.id
     WHERE u.id = ? AND u.role = 'director'`
    )
    .get(userId);
  if (!row) return null;
  const strengths = await fetchStrengths(userId);
  const skills = await fetchSkills(userId);
  const tags = await fetchTags(userId);
  return [
    row.name,
    row.school_name,
    row.address,
    row.city,
    row.useful_experience || row.experience,
    row.want_to_know,
    row.interests,
    strengths.map((s) => s.name).join(' '),
    skills.map((s) => s.name).join(' '),
    tags.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function reindexDirector(userId) {
  const content = await buildDirectorSearchText(userId);
  await db.prepare('DELETE FROM director_search WHERE user_id = ?').run(userId);
  if (!content) return;
  await db.prepare('INSERT INTO director_search (user_id, content) VALUES (?, ?)').run(userId, content);
}

async function serializeDirector(row, viewer, preloaded) {
  const isAdmin = viewer && viewer.role === 'admin';
  const isOwner = viewer && viewer.id === row.id;
  const canSeeEmail = isAdmin || isOwner;
  const ratingVisible = isAdmin || isOwner || !!row.is_public;
  const strengths = preloaded ? preloaded.strengths : await fetchStrengths(row.id);
  const skills = preloaded ? preloaded.skills : await fetchSkills(row.id);
  const tags = preloaded ? preloaded.tags : await fetchTags(row.id);
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
    isFavorite: !!(preloaded && preloaded.favoriteMap && preloaded.favoriteMap[row.id]),
    favoriteAddedAt:
      preloaded && preloaded.favoriteMeta && preloaded.favoriteMeta[row.id]
        ? preloaded.favoriteMeta[row.id]
        : null,
  };
}

function buildSearchClause(q) {
  if (!q) return { sql: '', params: [] };
  const cleanedParts = q
    .split(/\s+/)
    .map((part) => part.replace(/["']/g, '').trim())
    .filter(Boolean);
  if (!cleanedParts.length) return { sql: '', params: [] };

  const likePattern = '%' + cleanedParts.join('%') + '%';

  return {
    sql:
      ' AND (' +
      'u.id IN (SELECT user_id FROM director_search WHERE lower(content) LIKE lower(?)) ' +
      'OR lower(u.name) LIKE lower(?) ' +
      'OR lower(COALESCE(s.name, \'\')) LIKE lower(?) ' +
      'OR lower(COALESCE(s.address, \'\')) LIKE lower(?) ' +
      'OR lower(COALESCE(p.city, \'\')) LIKE lower(?) ' +
      'OR lower(COALESCE(s.useful_experience, p.experience, \'\')) LIKE lower(?) ' +
      'OR lower(COALESCE(s.want_to_know, \'\')) LIKE lower(?) ' +
      'OR lower(COALESCE(p.interests, \'\')) LIKE lower(?)' +
      ')',
    params: [likePattern, likePattern, likePattern, likePattern, likePattern, likePattern, likePattern, likePattern],
  };
}

async function loadFavoriteMeta(viewerId, directorIds) {
  const favoriteMap = {};
  const favoriteMeta = {};
  if (!viewerId || !directorIds.length) return { favoriteMap, favoriteMeta };

  const placeholders = directorIds.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `SELECT director_id, created_at
       FROM director_favorites
       WHERE user_id = ? AND director_id IN (${placeholders})`
    )
    .all(...[viewerId].concat(directorIds));

  rows.forEach((row) => {
    favoriteMap[row.director_id] = true;
    favoriteMeta[row.director_id] = row.created_at;
  });

  return { favoriteMap, favoriteMeta };
}

async function loadProfileMeta(directorIds) {
  const strengthsMap = {};
  const skillsMap = {};
  const tagsMap = {};
  if (!directorIds.length) return { strengthsMap, skillsMap, tagsMap };

  const placeholders = directorIds.map(() => '?').join(',');
  const strengthsRows = await db
    .prepare(`SELECT user_id, name, value FROM profile_strengths WHERE user_id IN (${placeholders})`)
    .all(...directorIds);
  const skillsRows = await db
    .prepare(`SELECT user_id, name, level FROM profile_skills WHERE user_id IN (${placeholders})`)
    .all(...directorIds);
  const tagsRows = await db
    .prepare(`SELECT user_id, tag FROM profile_tags WHERE user_id IN (${placeholders})`)
    .all(...directorIds);

  strengthsRows.forEach((row) => {
    if (!strengthsMap[row.user_id]) strengthsMap[row.user_id] = [];
    strengthsMap[row.user_id].push({ name: row.name, value: row.value });
  });
  skillsRows.forEach((row) => {
    if (!skillsMap[row.user_id]) skillsMap[row.user_id] = [];
    skillsMap[row.user_id].push({ name: row.name, level: row.level });
  });
  tagsRows.forEach((row) => {
    if (!tagsMap[row.user_id]) tagsMap[row.user_id] = [];
    tagsMap[row.user_id].push(row.tag);
  });

  return { strengthsMap, skillsMap, tagsMap };
}

async function listDirectors(viewer, query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const q = (query.q || '').toString().trim().slice(0, 200);
  const search = buildSearchClause(q);
  const totalStmt = db.prepare('SELECT COUNT(*) AS total ' + BASE_FROM_SQL + search.sql);
  const totalRow = await totalStmt.get.apply(totalStmt, search.params);
  const listStmt = db.prepare(SELECT_SQL + search.sql + ' ORDER BY u.name LIMIT ? OFFSET ?');
  const rows = await listStmt.all.apply(listStmt, search.params.concat([limit, offset]));
  const ids = rows.map((r) => r.id);
  const { favoriteMap, favoriteMeta } = await loadFavoriteMeta(
    viewer && viewer.id ? viewer.id : null,
    ids
  );
  const { strengthsMap, skillsMap, tagsMap } = await loadProfileMeta(ids);

  const directors = [];
  for (const row of rows) {
    directors.push(
      await serializeDirector(row, viewer, {
        favoriteMap,
        favoriteMeta,
        strengths: strengthsMap[row.id] || [],
        skills: skillsMap[row.id] || [],
        tags: tagsMap[row.id] || [],
      })
    );
  }
  return {
    directors,
    pagination: { page, limit, total: Number(totalRow.total), totalPages: Math.ceil(Number(totalRow.total) / limit) },
  };
}

async function listMentors(viewer) {
  const rows = await db.prepare(SELECT_SQL + ' AND p.is_mentor = 1 ORDER BY u.name').all();
  const ids = rows.map((r) => r.id);
  const { favoriteMap, favoriteMeta } = await loadFavoriteMeta(
    viewer && viewer.id ? viewer.id : null,
    ids
  );
  const { strengthsMap, skillsMap, tagsMap } = await loadProfileMeta(ids);
  const mentors = [];
  for (const row of rows) {
    mentors.push(
      await serializeDirector(row, viewer, {
        favoriteMap,
        favoriteMeta,
        strengths: strengthsMap[row.id] || [],
        skills: skillsMap[row.id] || [],
        tags: tagsMap[row.id] || [],
      })
    );
  }
  return {
    mentors,
  };
}

async function listFavorites(viewer, query) {
  var sort = (query && query.sort) || 'recent';
  var orderBy = sort === 'name' ? 'u.name ASC' : 'f.created_at DESC, u.name ASC';
  const rows = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role,
              p.experience, p.interests, p.is_mentor, p.photo, p.city,
              s.name AS school_name, s.address, s.useful_experience, s.want_to_know,
              r.total_score, r.is_public,
              f.created_at AS favorite_created_at
       FROM director_favorites f
       JOIN users u ON u.id = f.director_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN schools s ON s.user_id = u.id
       LEFT JOIN ratings r ON r.user_id = u.id
       WHERE f.user_id = ? AND u.role = 'director'
       ORDER BY ` + orderBy
    )
    .all(viewer.id);
  const favoriteMap = {};
  const favoriteMeta = {};
  rows.forEach((row) => {
    favoriteMap[row.id] = true;
    favoriteMeta[row.id] = row.favorite_created_at;
  });
  const ids = rows.map((r) => r.id);
  const { strengthsMap, skillsMap, tagsMap } = await loadProfileMeta(ids);
  const favorites = [];
  for (const row of rows) {
    favorites.push(
      await serializeDirector(row, viewer, {
        favoriteMap,
        favoriteMeta,
        strengths: strengthsMap[row.id] || [],
        skills: skillsMap[row.id] || [],
        tags: tagsMap[row.id] || [],
      })
    );
  }
  return {
    favorites,
  };
}

async function toggleFavorite(viewer, directorId) {
  const id = parseInt(directorId, 10);
  if (!Number.isFinite(id)) return { error: 'Некорректный id директора', status: 400 };
  if (viewer.id === id) return { error: 'Нельзя добавить себя в избранное', status: 400 };
  const existsDirector = await db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'director'")
    .get(id);
  if (!existsDirector) return { error: 'Директор не найден', status: 404 };
  const existsFav = await db
    .prepare('SELECT 1 FROM director_favorites WHERE user_id = ? AND director_id = ?')
    .get(viewer.id, id);
  if (existsFav) {
    await db.prepare('DELETE FROM director_favorites WHERE user_id = ? AND director_id = ?').run(viewer.id, id);
    return { ok: true, isFavorite: false };
  }
  await db.prepare('INSERT INTO director_favorites (user_id, director_id) VALUES (?, ?)').run(viewer.id, id);
  return { ok: true, isFavorite: true };
}

async function getDirectorById(viewer, userId) {
  const row = await db.prepare(SELECT_SQL + ' AND u.id = ?').get(userId);
  if (!row) return { error: 'Не найдено', status: 404 };
  return { director: await serializeDirector(row, viewer) };
}

module.exports = { getDirectorById, listDirectors, listMentors, listFavorites, toggleFavorite, reindexDirector };
