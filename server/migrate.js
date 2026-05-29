const path = require('path');
const fs = require('fs');
const { db } = require('./db');

const MIGRATIONS_TABLE = '_migrations';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getApplied() {
  const rows = db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`).all();
  return new Set(rows.map((r) => r.name));
}

function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return;
  }

  ensureMigrationsTable();
  const applied = getApplied();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).run(file);
    });
    tx();
    console.log(`[migrate] Применена миграция: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('[migrate] Все миграции уже применены');
  }
}

module.exports = { runMigrations };
