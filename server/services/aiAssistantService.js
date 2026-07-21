const { db } = require('../db');
const { searchDirectors } = require('./aiSearchService');
const logger = require('../logger');

const ANSWER_MODEL = process.env.OPENAI_ANSWER_MODEL || 'gpt-5.4-mini';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 12;

function getOpenAiKey() {
  return (process.env.OPENAI_API_KEY || '').trim();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function requestOpenAi(payload) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    const error = new Error('AI-ассистент пока не подключён: задайте OPENAI_API_KEY на сервере.');
    error.status = 503;
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((data.error && data.error.message) || 'AI-ассистент временно недоступен.');
    error.status = response.status >= 500 ? 503 : 400;
    logger.warn('ai.assistant_openai_failed', { status: response.status, message: error.message });
    throw error;
  }
  return data;
}

function getOutputText(data) {
  if (data && typeof data.output_text === 'string') return data.output_text.trim();
  if (!data || !Array.isArray(data.output)) return '';
  return data.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((item) => item.text || '')
    .join('')
    .trim();
}

async function loadSchoolContext(userId) {
  const row = await db
    .prepare(
      `SELECT u.name, p.experience, p.interests, p.city,
              s.name AS school_name, s.address, s.useful_experience, s.want_to_know
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN schools s ON s.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId);
  if (!row) return '';

  const strengths = await db.prepare('SELECT name FROM profile_strengths WHERE user_id = ?').all(userId);
  const skills = await db.prepare('SELECT name, level FROM profile_skills WHERE user_id = ?').all(userId);
  const tags = await db.prepare('SELECT tag FROM profile_tags WHERE user_id = ?').all(userId);
  const lines = [
    `Директор: ${row.name || ''}`,
    `Школа: ${row.school_name || ''}`,
    `Город/адрес: ${row.city || row.address || ''}`,
    `Опыт директора: ${row.experience || ''}`,
    `Интересы: ${row.interests || ''}`,
    `Практики школы: ${row.useful_experience || ''}`,
    `Что хочет развивать школа: ${row.want_to_know || ''}`,
    `Сильные стороны: ${strengths.map((item) => item.name).join(', ')}`,
    `Навыки: ${skills.map((item) => item.name + (item.level ? ` (${item.level})` : '')).join(', ')}`,
    `Теги опыта: ${tags.map((item) => item.tag).join(', ')}`,
  ];
  return lines.filter((line) => line.split(': ').slice(1).join(': ').trim()).join('\n');
}

function shouldSearchForColleagues(message) {
  const text = message.toLowerCase();
  return /(найд|подбер|порекоменду|коллег|директор|опыт.*помо|кто.*помоч|с кем.*обсуд|похож.*практи)/i.test(text);
}

async function getConversation(userId, conversationId) {
  if (!conversationId) return null;
  return db.prepare('SELECT id, user_id, title, created_at, updated_at FROM ai_conversations WHERE id = ? AND user_id = ?').get(conversationId, userId);
}

async function createConversation(userId, title) {
  const result = await db
    .prepare('INSERT INTO ai_conversations (user_id, title) VALUES (?, ?) RETURNING id, title, created_at, updated_at')
    .run(userId, normalizeText(title).slice(0, 100) || 'Новый разговор');
  return db.prepare('SELECT id, user_id, title, created_at, updated_at FROM ai_conversations WHERE id = ?').get(result.lastInsertRowid);
}

async function listConversations(userId) {
  return db
    .prepare('SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 30')
    .all(userId);
}

async function listMessages(userId, conversationId) {
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) return null;
  const messages = await db
    .prepare(
      `SELECT id, role, content, metadata_json, created_at
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(conversationId);
  return {
    conversation,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: parseMetadata(message.metadata_json),
      createdAt: message.created_at,
    })),
  };
}

function parseMetadata(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

async function sendMessage(user, conversationId, content) {
  const message = normalizeText(content).slice(0, MAX_MESSAGE_LENGTH);
  if (message.length < 2) {
    const error = new Error('Напишите вопрос или опишите ситуацию подробнее.');
    error.status = 400;
    throw error;
  }

  let conversation = await getConversation(user.id, conversationId);
  if (conversationId && !conversation) {
    const error = new Error('Разговор не найден.');
    error.status = 404;
    throw error;
  }
  if (!conversation) conversation = await createConversation(user.id, message.slice(0, 80));

  await db.prepare('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, \'user\', ?)').run(conversation.id, message);
  await db.prepare('UPDATE ai_conversations SET updated_at = NOW() WHERE id = ?').run(conversation.id);

  const history = await db
    .prepare(
      `SELECT role, content
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(conversation.id, MAX_HISTORY);
  history.reverse();

  let matches = [];
  let searchNote = '';
  if (shouldSearchForColleagues(message)) {
    try {
      const result = await searchDirectors(user, message);
      matches = result.matches || [];
      if (matches.length) {
        searchNote = '\nПодходящие коллеги из базы сообщества:\n' + matches.map((item, index) => `${index + 1}. ${item.director.name} — ${item.director.school || ''}: ${item.reason || ''}`).join('\n');
      } else {
        searchNote = '\nПо этому запросу подходящих коллег в базе не найдено.';
      }
    } catch (error) {
      logger.warn('ai.assistant_search_failed', { message: error.message });
      searchNote = '\nПоиск коллег сейчас недоступен. Не утверждай, что коллеги найдены.';
    }
  }

  const schoolContext = await loadSchoolContext(user.id);
  const historyText = history.map((item) => `${item.role === 'user' ? 'Директор' : 'Ассистент'}: ${item.content}`).join('\n');
  const prompt = [
    'Ты персональный AI-ассистент директора школы.',
    'Отвечай на русском языке, спокойно, практично и без выдуманных фактов.',
    'Помогай разобраться в ситуации, задавай уточняющие вопросы, если без них нельзя дать хороший совет.',
    'Предлагай конкретные шаги, риски и критерии результата.',
    'Не принимай кадровые решения самостоятельно и не выдавай предположения за факты.',
    'Если ниже приведены найденные коллеги, используй только эти данные и предложи директору самому решить, связываться ли с ними.',
    '\nКонтекст директора и школы:\n' + (schoolContext || 'Контекст школы пока не заполнен.'),
    '\nИстория разговора:\n' + (historyText || 'Это начало разговора.'),
    searchNote,
    '\nОтветь на последнее сообщение директора:\n' + message,
  ].join('\n');

  const data = await requestOpenAi({ model: ANSWER_MODEL, input: prompt });
  const answer = getOutputText(data) || 'Не удалось получить ответ. Попробуйте сформулировать ситуацию иначе.';
  const metadata = { matches: matches.map((item) => item.director), searchPerformed: shouldSearchForColleagues(message) };
  const inserted = await db
    .prepare('INSERT INTO ai_messages (conversation_id, role, content, metadata_json) VALUES (?, \'assistant\', ?, ?) RETURNING id, created_at')
    .run(conversation.id, answer, JSON.stringify(metadata));
  await db.prepare('UPDATE ai_conversations SET updated_at = NOW() WHERE id = ?').run(conversation.id);

  return {
    conversation: await getConversation(user.id, conversation.id),
    message: { id: inserted.lastInsertRowid, role: 'assistant', content: answer, metadata },
    matches,
  };
}

module.exports = { createConversation, listConversations, listMessages, sendMessage };
