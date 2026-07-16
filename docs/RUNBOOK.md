# RUNBOOK — Гравитация

Operational guide for local development, production deployment, checks, and basic incident handling.

Product context and the canonical terminology are in [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). This runbook describes the operational implementation, not a change to the closed-club access policy.

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

The product is a closed club for school directors of Moscow Region. Launch access is invitation-only and the scale target is up to 1500 registered accounts, not 1500 concurrent users. The current technical flow is a registration request followed by administrator approval; mandatory invite-token validation is not currently implemented.

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
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
WS_REDIS_CHANNEL=ws:broadcast
```

Production startup fails intentionally when required secrets are missing or weak.

Set `REDIS_ENABLED=false` only for local or single-instance operation without Redis. For multiple app instances, shared rate limiting and WebSocket delivery require a reachable Redis and a consistent `REDIS_URL`.

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
  "pool": {
    "total": 5,
    "idle": 4,
    "waiting": 0
  }
}
```

If `/ready` returns `503`, the process is alive but cannot use PostgreSQL.

## 7. Quality Gate

Run before deploy:

```bash
npm run format:check
npm run lint
npm run check:buttons-db
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

CI is configured in `.github/workflows/ci.yml`.

## 8. Deployment

Render is configured through `render.yaml` as a temporary test environment. It is not the planned permanent production platform.

Recommended flow:

1. Push changes to GitHub.
2. Create or update the Render Blueprint.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. Confirm `DATABASE_URL` is connected from the managed PostgreSQL database.
5. Deploy.
6. Check `/health` and `/ready`.
7. Log in with a deliberately created test/admin account. Do not enable demo seeding unless the environment is explicitly for testing.

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

Render and other temporary/ephemeral environments are suitable for testing only while uploads remain on local disk. For permanent production, move uploads to object storage such as S3, Cloudflare R2, Supabase Storage, or another persistent storage provider before accepting real user content.

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

Password reset (self-service, OTP):

- `POST /api/auth/forgot-password` issues a 6-digit code, stored only as a SHA-256 hash with a 10-minute TTL; previous active codes are invalidated;
- the code is delivered by email via SMTP (`server/services/notifier.js`). Configure `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` (see `.env.example`);
- after configuring SMTP, send a live check with `npm run mail:test -- recipient@example.com`; the command prints only whether settings are present and does not echo the password;
- if SMTP is not configured, email is silently skipped — outside production the code is returned in the API response for dev/test only (never in production);
- `POST /api/auth/reset-password` takes `{ email, code, password }`; max 5 attempts per code, then it is invalidated;
- responses never reveal whether an account exists (anti-enumeration);
- the `forgot-password`/`reset-password` endpoints are rate-limited (5 / 15 min);
- if the user has linked MAX (see below), the code is also delivered to MAX.

MAX messenger integration (account linking + code/notification delivery):

- enable by setting `MAX_BOT_TOKEN`, `MAX_BOT_NAME`, `MAX_WEBHOOK_SECRET` (and optionally `MAX_API_BASE`, default `https://platform-api.max.ru`);
- create the bot via `@MasterBot` in MAX; the token is sent in the `Authorization` header (no `Bearer` prefix);
- subscribe the webhook: `POST {MAX_API_BASE}/subscriptions` with your public URL `https://<host>/api/integrations/max/webhook?secret=<MAX_WEBHOOK_SECRET>` and `update_types: ["bot_started"]` (HTTPS with a trusted CA is required by MAX);
- linking flow: user clicks "Привязать MAX" in profile → `POST /api/integrations/max/link` returns a deep link `https://max.ru/<bot>?start=<nonce>` (nonce TTL 15 min) → user opens the bot → MAX calls the webhook with `bot_started` + payload → `max_user_id` is stored in `profiles`; one MAX account maps to one profile;
- endpoints: `GET /api/integrations/max/status`, `POST /api/integrations/max/link`, `POST /api/integrations/max/unlink` (auth required); `POST /api/integrations/max/webhook` (public, secret-protected, CSRF-exempt);
- without `MAX_BOT_TOKEN` the integration is off and the profile linking block is hidden; message sending fails soft (logged, never throws).

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
- `npm run check:buttons-db` passes
- `npm test` passes
- `npm run test:coverage` passes with the agreed threshold and no critical area is untested
- `npm run build` passes
- `npm run test:e2e` passes
- if more than one app instance is used: Redis configured and reachable (`REDIS_ENABLED=true`, `REDIS_URL`), and WS multi-instance delivery verified (Pub/Sub)
- HTTP load smoke completed in the target environment (`npm run load:smoke:http -- <url> 1000 50`)

Extended release-readiness checklist for up to 1500 registered accounts:

- [`docs/GO_LIVE_1500.md`](GO_LIVE_1500.md)
