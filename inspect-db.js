// Утилита для просмотра содержимого БД из терминала.
// Запуск: node inspect-db.js
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'data', 'gravitacia.db'));

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all();

console.log('=== ТАБЛИЦЫ В БД ===');
for (const t of tables) {
  const c = db.prepare(`SELECT COUNT(*) AS c FROM ${t.name}`).get().c;
  console.log(`  ${t.name.padEnd(25)} ${c} строк`);
}

console.log('\n=== USERS ===');
console.table(db.prepare('SELECT id, email, name, role, created_at FROM users').all());

console.log('=== RATINGS ===');
console.table(db.prepare(
  `SELECT u.id, u.email, r.total_score, r.is_public
   FROM ratings r JOIN users u ON u.id = r.user_id
   ORDER BY r.total_score DESC`
).all());

console.log('=== SCHOOLS ===');
console.table(db.prepare('SELECT user_id, name, address, students, teachers, type FROM schools').all());

console.log('=== PROFILES (краткая выжимка) ===');
console.table(db.prepare(
  'SELECT user_id, is_mentor, consent, city, photo IS NOT NULL AS has_photo FROM profiles'
).all());

console.log('=== EVENTS ===');
console.table(db.prepare('SELECT id, title, date, max_participants, creator_id, created_at FROM events').all());

console.log('=== EVENT_REGISTRATIONS ===');
console.table(db.prepare('SELECT * FROM event_registrations').all());

console.log('=== RATING_ACTIVITIES (последние 10) ===');
console.table(db.prepare(
  'SELECT id, user_id, type, description, points, created_at FROM rating_activities ORDER BY created_at DESC LIMIT 10'
).all());

db.close();
