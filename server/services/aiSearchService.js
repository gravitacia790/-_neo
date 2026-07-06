const crypto = require('crypto');
const { db } = require('../db');
const directorsService = require('./directorsService');

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const ANSWER_MODEL = process.env.OPENAI_ANSWER_MODEL || 'gpt-5.4-mini';
const MAX_INDEXED_DIRECTORS = 2500;

function getOpenAiKey() {
  return (process.env.OPENAI_API_KEY || '').trim();
}

function hashText(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function fetchProfileRows(userId) {
  const base = await db
    .prepare(
      `SELECT u.id, u.name,
              p.experience, p.interests, p.city,
              s.name AS school_name, s.address, s.useful_experience, s.want_to_know
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN schools s ON s.user_id = u.id
       WHERE u.id = ? AND u.role = 'director' AND u.approval_status = 'approved'`
    )
    .get(userId);
  if (!base) return null;
  const strengths = await db.prepare('SELECT name FROM profile_strengths WHERE user_id = ?').all(userId);
  const skills = await db.prepare('SELECT name, level FROM profile_skills WHERE user_id = ?').all(userId);
  const tags = await db.prepare('SELECT tag FROM profile_tags WHERE user_id = ?').all(userId);
  return { base, strengths, skills, tags };
}

function buildAiProfileText(parts) {
  const base = parts.base;
  const strengths = parts.strengths.map((s) => s.name).join(', ');
  const skills = parts.skills.map((s) => s.name + (s.level ? ' (' + s.level + ')' : '')).join(', ');
  const tags = parts.tags.map((t) => t.tag).join(', ');
  return [
    'Директор: ' + normalizeText(base.name),
    'Школа: ' + normalizeText(base.school_name),
    'Город: ' + normalizeText(base.city || base.address),
    'Может помочь, реализованный опыт: ' + normalizeText(base.useful_experience || base.experience),
    'Может помочь, реализованный опыт: ' + normalizeText(base.useful_experience || base.experience),
    'Профессиональные навыки: ' + normalizeText(skills),
    'Сильные стороны: ' + normalizeText(strengths),
    'Теги опыта: ' + normalizeText(tags),
    'Хочет узнать: ' + normalizeText(base.want_to_know),
    'Личные интересы: ' + normalizeText(base.interests),
  ]
    .filter((line) => line.replace(/^[^:]+:\s*/, '').trim())
    .join('\n');
}

async function requestOpenAi(path, payload) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    const err = new Error('AI-поиск пока не подключён: задайте OPENAI_API_KEY в Render.');
    err.status = 503;
    throw err;
  }
  const response = await fetch('https://api.openai.com/v1/' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error((data && data.error && data.error.message) || 'AI-сервис временно недоступен.');
    err.status = response.status >= 500 ? 503 : 400;
    throw err;
  }
  return data;
}

async function createEmbedding(input) {
  const data = await requestOpenAi('embeddings', {
    model: EMBEDDING_MODEL,
    input: input.slice(0, 12000),
  });
  const embedding = data && data.data && data.data[0] && data.data[0].embedding;
  if (!Array.isArray(embedding)) {
    const err = new Error('AI-сервис не вернул embedding.');
    err.status = 503;
    throw err;
  }
  return embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let aLen = 0;
  let bLen = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    aLen += a[i] * a[i];
    bLen += b[i] * b[i];
  }
  if (!aLen || !bLen) return 0;
  return dot / (Math.sqrt(aLen) * Math.sqrt(bLen));
}

function parseEmbeddingJson(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function reindexDirectorAi(userId) {
  if (!getOpenAiKey()) return { skipped: true, reason: 'not_configured' };
  const parts = await fetchProfileRows(userId);
  if (!parts) {
    await db.prepare('DELETE FROM director_ai_profiles WHERE user_id = ?').run(userId);
    return { indexed: false };
  }
  const sourceText = buildAiProfileText(parts);
  const sourceHash = hashText(sourceText);
  const existing = await db.prepare('SELECT source_hash FROM director_ai_profiles WHERE user_id = ?').get(userId);
  if (existing && existing.source_hash === sourceHash) return { indexed: false, unchanged: true };
  const embedding = await createEmbedding(sourceText);
  await db
    .prepare(
      `INSERT INTO director_ai_profiles (user_id, source_hash, source_text, embedding_json, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         source_hash = EXCLUDED.source_hash,
         source_text = EXCLUDED.source_text,
         embedding_json = EXCLUDED.embedding_json,
         updated_at = NOW()`
    )
    .run(userId, sourceHash, sourceText, JSON.stringify(embedding));
  return { indexed: true };
}

async function ensureAiIndex() {
  if (!getOpenAiKey()) {
    const err = new Error('AI-поиск пока не подключён: задайте OPENAI_API_KEY в Render.');
    err.status = 503;
    throw err;
  }
  const rows = await db
    .prepare(
      `SELECT id
       FROM users
       WHERE role = 'director' AND approval_status = 'approved'
       ORDER BY id
       LIMIT ?`
    )
    .all(MAX_INDEXED_DIRECTORS);
  for (const row of rows) {
    await reindexDirectorAi(row.id);
  }
}

function buildDeterministicReason(query, sourceText) {
  const cleaned = normalizeText(sourceText);
  const usefulMatch = cleaned.match(/Может помочь, реализованный опыт:\s*([^]+?)(Профессиональные навыки:|Сильные стороны:|$)/);
  const useful = usefulMatch ? normalizeText(usefulMatch[1]).slice(0, 220) : '';
  if (useful) return 'В профиле указан близкий реализованный опыт: ' + useful;
  return 'Профиль близок по смыслу к запросу: ' + normalizeText(query).slice(0, 160);
}

async function explainMatches(query, matches) {
  if (!matches.length) return [];
  const compact = matches.map((match, index) => ({
    rank: index + 1,
    name: match.director.name,
    school: match.director.school,
    source: match.sourceText.slice(0, 900),
  }));
  const data = await requestOpenAi('responses', {
    model: ANSWER_MODEL,
    input:
      'Ты помогаешь директорам школ найти коллег с релевантным опытом. ' +
      'По запросу пользователя кратко объясни, почему каждый кандидат подходит. ' +
      'Ответ верни строго JSON массивом объектов {"rank": number, "reason": string}. ' +
      'Не выдумывай факты, опирайся только на source.\n\n' +
      'Запрос: ' + query + '\n\nКандидаты:\n' + JSON.stringify(compact),
  });
  const outputText = data.output_text || (data.output && data.output.map((o) => JSON.stringify(o)).join('\n')) || '';
  try {
    const parsed = JSON.parse(outputText);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {
    // fall back below
  }
  return [];
}

async function searchDirectors(viewer, query) {
  const q = normalizeText(query).slice(0, 1000);
  if (q.length < 8) {
    const err = new Error('Опишите задачу чуть подробнее.');
    err.status = 400;
    throw err;
  }
  const queryEmbedding = await createEmbedding(q);
  const rows = await db
    .prepare(
      `SELECT aip.user_id, aip.source_text, aip.embedding_json
       FROM director_ai_profiles aip
       JOIN users u ON u.id = aip.user_id
       WHERE u.role = 'director' AND u.approval_status = 'approved' AND u.id <> ?`
    )
    .all(viewer.id);
  if (!rows.length) {
    const err = new Error('AI-индекс ещё не подготовлен. Администратору нужно запустить переиндексацию профилей.');
    err.status = 409;
    throw err;
  }

  const ranked = rows
    .map((row) => {
      const embedding = parseEmbeddingJson(row.embedding_json);
      return {
        userId: row.user_id,
        sourceText: row.source_text || '',
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const matches = [];
  for (const item of ranked) {
    const result = await directorsService.getDirectorById(viewer, item.userId);
    if (result && result.director) {
      matches.push({
        director: result.director,
        score: Number(item.score.toFixed(4)),
        sourceText: item.sourceText,
        reason: buildDeterministicReason(q, item.sourceText),
      });
    }
  }

  const explanations = await explainMatches(q, matches).catch(() => []);
  explanations.forEach((item) => {
    const match = matches[Number(item.rank) - 1];
    if (match && item.reason) match.reason = normalizeText(item.reason).slice(0, 500);
  });

  await db
    .prepare('INSERT INTO ai_search_logs (user_id, query, matched_director_ids) VALUES (?, ?, ?)')
    .run(viewer.id, q, matches.map((m) => m.director.id).join(','));

  return {
    query: q,
    matches: matches.map((match) => ({
      director: match.director,
      score: match.score,
      reason: match.reason,
    })),
  };
}

module.exports = { searchDirectors, reindexDirectorAi, ensureAiIndex };
