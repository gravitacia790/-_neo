const path = require('path');
const fs = require('fs');
const { db, pool } = require('./db');

const MIGRATIONS_TABLE = 'schema_migrations';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations', 'postgres');
const FILE_RE = /^(\d+)_([a-z0-9_]+)\.(up|down)\.sql$/i;

async function ensureMigrationsTable() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function readMigrationCatalog() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }

  const byVersion = new Map();
  const files = fs.readdirSync(MIGRATIONS_DIR).sort();

  for (const file of files) {
    const match = file.match(FILE_RE);
    if (!match) continue;

    const version = Number(match[1]);
    const name = match[2];
    const kind = match[3].toLowerCase();
    const key = String(version);
    const existing = byVersion.get(key) || { version, name, up: null, down: null };
    existing[kind] = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    byVersion.set(key, existing);
  }

  return Array.from(byVersion.values()).sort((a, b) => a.version - b.version);
}

async function getAppliedRows() {
  await ensureMigrationsTable();
  return db.prepare(`SELECT version, name FROM ${MIGRATIONS_TABLE} ORDER BY version`).all();
}

async function migrateUp() {
  const catalog = readMigrationCatalog();
  const appliedRows = await getAppliedRows();
  const applied = new Set(appliedRows.map((row) => Number(row.version)));
  const pending = catalog.filter((m) => !applied.has(m.version));

  let count = 0;
  for (const migration of pending) {
    if (!migration.up) {
      throw new Error(`Missing up migration for version ${migration.version}`);
    }
    const tx = db.transaction(async (trx) => {
      await trx.exec(migration.up);
      await trx
        .prepare(`INSERT INTO ${MIGRATIONS_TABLE} (version, name) VALUES (?, ?)`)
        .run(migration.version, migration.name);
    });
    await tx();
    console.log(`[migrate] up ${migration.version}_${migration.name}`);
    count++;
  }

  if (count === 0) {
    console.log('[migrate] up-to-date');
  }
}

async function migrateDown(steps) {
  const downSteps = Math.max(Number(steps) || 1, 1);
  const catalog = readMigrationCatalog();
  const byVersion = new Map(catalog.map((m) => [Number(m.version), m]));
  const appliedRows = await getAppliedRows();
  const targets = appliedRows
    .map((row) => ({ version: Number(row.version), name: row.name }))
    .sort((a, b) => b.version - a.version)
    .slice(0, downSteps);

  if (!targets.length) {
    console.log('[migrate] nothing to rollback');
    return;
  }

  for (const applied of targets) {
    const migration = byVersion.get(applied.version);
    if (!migration || !migration.down) {
      throw new Error(`Missing down migration for version ${applied.version}`);
    }
    const tx = db.transaction(async (trx) => {
      await trx.exec(migration.down);
      await trx.prepare(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = ?`).run(applied.version);
    });
    await tx();
    console.log(`[migrate] down ${applied.version}_${applied.name}`);
  }
}

async function migrationStatus() {
  const catalog = readMigrationCatalog();
  const appliedRows = await getAppliedRows();
  const applied = new Set(appliedRows.map((row) => Number(row.version)));

  const rows = catalog.map((m) => ({
    version: m.version,
    name: m.name,
    applied: applied.has(m.version) ? 'yes' : 'no',
  }));

  if (!rows.length) {
    console.log('[migrate] no migration files found');
    return;
  }

  rows.forEach((row) => {
    console.log(`[migrate] ${row.version} ${row.name} applied=${row.applied}`);
  });
}

async function runMigrations(opts) {
  const options = opts || {};
  const direction = options.direction || 'up';
  if (direction === 'down') {
    return migrateDown(options.steps || 1);
  }
  if (direction === 'status') {
    return migrationStatus();
  }
  return migrateUp();
}

if (require.main === module) {
  const cmd = (process.argv[2] || 'up').toLowerCase();
  const steps = process.argv[3];

  runMigrations({
    direction: cmd === 'status' ? 'status' : cmd === 'down' ? 'down' : 'up',
    steps,
  })
    .then(async () => {
      await pool.end();
    })
    .catch(async (err) => {
      console.error('[migrate] failed:', err.message);
      try {
        await pool.end();
      } catch (_) {
        // ignore shutdown errors
      }
      process.exit(1);
    });
}

module.exports = { runMigrations, migrateUp, migrateDown, migrationStatus };
