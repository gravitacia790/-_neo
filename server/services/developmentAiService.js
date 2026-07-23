const { db } = require('../db');
const logger = require('../logger');

const MODEL = process.env.OPENAI_ANSWER_MODEL || 'gpt-5.4-mini';

function getOutputText(data) {
  if (data && typeof data.output_text === 'string') return data.output_text.trim();
  return '';
}

async function loadContext(userId) {
  const row = await db
    .prepare(
      `SELECT u.name, p.experience, p.interests, p.city, s.name AS school_name, s.useful_experience, s.want_to_know
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN schools s ON s.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId);
  if (!row) return '';
  return [
    'Директор: ' + (row.name || ''),
    'Школа: ' + (row.school_name || ''),
    'Город: ' + (row.city || ''),
    'Опыт: ' + (row.experience || ''),
    'Интересы: ' + (row.interests || ''),
    'Что хочет развивать школа: ' + (row.want_to_know || ''),
    'Полезный опыт школы: ' + (row.useful_experience || ''),
  ]
    .filter((line) => line.split(': ').slice(1).join(': ').trim())
    .join('\n');
}

function parsePlan(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const result = JSON.parse(match[0]);
    if (!result || typeof result.title !== 'string' || !Array.isArray(result.actions)) return null;
    const actions = result.actions
      .filter((action) => action && typeof action.title === 'string' && action.title.trim())
      .slice(0, 4)
      .map((action, index) => ({
        title: action.title.trim().slice(0, 300),
        description: String(action.description || '').trim().slice(0, 2000),
        weekNumber: Math.min(Math.max(Number(action.weekNumber) || index + 1, 1), 4),
      }));
    if (actions.length < 2) return null;
    return {
      title: result.title.trim().slice(0, 180),
      focusArea: String(result.focusArea || '').trim().slice(0, 300),
      outcome: String(result.outcome || '').trim().slice(0, 1000),
      actions,
    };
  } catch (_) {
    return null;
  }
}

async function generatePlan(user, request) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('AI-наставник пока не подключён.');
    error.status = 503;
    throw error;
  }
  const context = await loadContext(user.id);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        input:
          'Ты методист и AI-наставник директора школы. Создай реалистичный трек развития на 4 недели. ' +
          'Не выдумывай нормативные требования и не используй персональные данные учеников. ' +
          'Верни строго JSON без markdown: {"title":string,"focusArea":string,"outcome":string,"actions":[{"title":string,"description":string,"weekNumber":number}]}. ' +
          'Дай 3 или 4 небольших, выполнимых практики: по одной на неделю.\n\nКонтекст директора:\n' +
          context +
          '\n\nЗапрос директора:\n' +
          request,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (_) {
    const error = new Error('Не удалось связаться с AI-наставником. Попробуйте ещё раз.');
    error.status = 503;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.warn('development.ai_plan_failed', {
      status: response.status,
      code: data && data.error && data.error.code ? data.error.code : undefined,
      type: data && data.error && data.error.type ? data.error.type : undefined,
    });
    const error = new Error(
      response.status === 401
        ? 'AI-наставник не авторизован. Проверьте ключ OpenAI на сервере.'
        : 'AI-наставник временно недоступен. Попробуйте ещё раз немного позже.'
    );
    error.status = response.status >= 500 ? 503 : 400;
    throw error;
  }
  const plan = parsePlan(getOutputText(data));
  if (!plan) {
    const error = new Error('Не удалось подготовить понятный трек. Сформулируйте цель немного конкретнее.');
    error.status = 502;
    throw error;
  }
  return plan;
}

module.exports = { generatePlan };
