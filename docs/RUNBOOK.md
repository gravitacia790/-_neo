# RUNBOOK - Gravitacia NEO

Operational guide for local development, production deployment, checks, and basic incident handling.

## 1. Purpose

This document helps a developer or operator:

- run the project locally;
- verify that the service is healthy;
- apply PostgreSQL migrations;
- deploy the app;
- understand required environment variables;
- diagnose common production issues.

## 2. Runtime

Local development:

- Node.js `22.5+`
- npm `10+`
- PostgreSQL connection string in `DATABASE_URL`

Production:

- Node.js `22.x`
- PostgreSQL database
- HTTPS termination through the platform or a reverse proxy
- persistent external storage for user uploads if profile photos must survive redeploys

The app serves the static frontend from `public/` and the API from the same Express process.

## 3. Environment

Create `.env` from `.env.example` and set the real values.

Required outside tests:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<random string, at least 32 chars>
DATABASE_URL=postgres://user:password@host:5432/database
ADMIN_EMAIL=admin@example.ru
ADMIN_PASSWORD=<strong password, at least 10 chars>
TRUST_PROXY=1
```

Optional:

```env
COOKIE_DOMAIN=.example.ru
ALLOWED_ORIGINS=https://example.ru
VAPID_SUBJECT=mailto:admin@example.ru
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

Production startup fails intentionally when required secrets are missing or weak.

## 4. Local Start

Install dependencies:

```bash
npm install
```

Apply migrations:

```bash
npm run db:migrate
```

Start the server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## 5. Migrations

Migration files live in `server/migrations/postgres/`.

Apply pending migrations:

```bash
npm run db:migrate
```

Check migration status:

```bash
npm run db:migrate:status
```

Rollback one migration:

```bash
npm run db:migrate:down
```

The server also runs pending migrations during startup.

## 6. Health Checks

Liveness:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "uptime": 123.45
}
```

Readiness:

```http
GET /ready
```

Expected response:

```json
{
  "status": "ready",
  "db": "ok",
  "postgresVersion": "...",
  "users": 5
}
```

If `/ready` returns `503`, the process is alive but cannot use PostgreSQL.

## 7. Quality Gate

Run before deploy:

```bash
npm run format:check
npm run lint
npm test
npm run test:e2e
```

CI is configured in `.github/workflows/ci.yml`.

## 8. Deployment

Render is configured through `render.yaml`.

Recommended flow:

1. Push changes to GitHub.
2. Create or update the Render Blueprint.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. Confirm `DATABASE_URL` is connected from the managed PostgreSQL database.
5. Deploy.
6. Check `/health` and `/ready`.
7. Log in as the seeded admin.

For another platform, use:

```bash
npm ci --omit=dev
npm start
```

Make sure migrations run successfully before accepting traffic.

## 9. Data And Uploads

Primary data is stored in PostgreSQL.

Profile photos are currently written to:

```text
public/uploads/
```

For production with multiple instances, ephemeral disks, or frequent redeploys, move uploads to object storage such as S3, Cloudflare R2, Supabase Storage, or another persistent storage provider.

Back up:

- PostgreSQL database;
- object storage or `public/uploads/` if local uploads are still used;
- environment variable values stored in the deployment platform.

## 10. Common Issues

Server does not start:

- check `JWT_SECRET`;
- check `DATABASE_URL`;
- check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in production;
- check startup logs for migration errors.

`/ready` returns `503`:

- PostgreSQL is unavailable;
- `DATABASE_URL` is wrong;
- migrations failed;
- network access to the database is blocked.

Login does not work:

- account may be locked after repeated failed attempts;
- cookies may be blocked or sent over HTTP while production requires secure cookies;
- `JWT_SECRET` changed and old sessions are invalid.

Profile photos do not upload:

- file is larger than 1 MB;
- file is not JPEG, PNG, or WebP;
- the process cannot write to `public/uploads/`;
- the hosting platform does not preserve local files.

Password reset:

- reset tokens are intentionally not exposed in production;
- a real email delivery flow is required before enabling self-service password reset in production.

## 11. Production Checklist

- `NODE_ENV=production`
- strong `JWT_SECRET`
- strong `ADMIN_PASSWORD`
- PostgreSQL backups enabled
- upload storage strategy decided
- HTTPS enabled
- `/health` returns `200`
- `/ready` returns `200`
- `npm run format:check` passes
- `npm run lint` passes
- `npm test` passes
- `npm run test:e2e` passes
