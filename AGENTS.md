# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

### Product overview

**Gravitacia NEO** is a single Node.js monolith: Express serves a vanilla JS SPA from `public/` on one port. PostgreSQL is required for manual dev; tests use in-memory `pg-mem` when `NODE_ENV=test`.

### Services

| Service | Port | Required for |
|---------|------|--------------|
| Node app (`npm start`) | 3000 | All dev and E2E |
| PostgreSQL 16 | 5432 | Manual browser dev only (not needed for `npm test` / `npm run test:e2e`) |

### PostgreSQL (manual dev only)

Automated tests (`npm test`, `npm run test:e2e`) use `pg-mem` and do **not** need PostgreSQL.

For `npm start` with a real database:

```bash
sudo service postgresql start
sudo -u postgres createdb gravitacia 2>/dev/null || true
```

Connection string: `postgres://postgres:postgres@localhost:5432/gravitacia`

### Environment file

Copy `.env.example` to `.env` and set at minimum:

- `JWT_SECRET` — at least 32 characters
- `DATABASE_URL` — PostgreSQL connection string (required when `NODE_ENV` is not `test`)

Demo login after first start (seeded automatically): `elena@school11.ru` / `demo1234`

### Common commands

See `package.json` scripts and `README.md`. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `npm ci` |
| Start dev server | `npm start` |
| Lint | `npm run lint` |
| API tests | `npm test` |
| E2E tests | `npm run test:e2e` (Playwright starts server with `NODE_ENV=test`) |
| Migrations | `npm run db:migrate` |

### Gotchas

- **No separate frontend dev server** — UI is static files under `public/`, served by Express.
- **Playwright E2E** starts its own server via `playwright.config.js` with `NODE_ENV=test`; do not rely on an already-running `npm start` instance for E2E.
- **First `npm start`** runs migrations and seeds demo directors; ensure PostgreSQL is up or startup fails on `DATABASE_URL`.
- **Web Push** is optional; omit VAPID env vars unless testing notifications.
- **E2E flakiness**: some mobile "more tabs" tests (`#moreRow button[data-tab="gl"]`) may timeout in headless Chromium; 8/10 E2E tests passing is typical in cloud VMs.

### Health checks

- `GET http://localhost:3000/health` — process alive
- `GET http://localhost:3000/ready` — PostgreSQL reachable
