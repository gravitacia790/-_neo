# Go-Live Checklist (up to 1500 registered accounts)

This checklist is for the permanent launch of the closed, invitation-only club for school directors of Moscow Region. The number 1500 is an upper bound for registered accounts, not a concurrency target. See [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for the canonical product context.

Render is a temporary test platform and must not be treated as the permanent production environment. The permanent provider must be selected before opening real access.

## 1) Critical blockers

- PostgreSQL backups, recovery procedure, HTTPS and persistent upload storage must be configured on the permanent platform.
- If the service runs on more than one instance, `REDIS_URL` must be configured and reachable from all app instances, with `REDIS_ENABLED=true`.
- `/health` and `/ready` must return `200` after deployment.
- `npm run format:check`, `npm run lint`, `npm run check:buttons-db`, `npm test`, `npm run test:coverage`, `npm run build` and `npm run test:e2e` must pass.
- If invite-only access must be enforced technically, invite-token validation must be implemented and tested; the current application uses registration requests plus administrator approval.

## 2) Required environment

Set in production:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<random 48+ chars>
DATABASE_URL=postgres://...
ADMIN_EMAIL=admin@example.ru
ADMIN_PASSWORD=<strong 10+ chars>
TRUST_PROXY=1
REDIS_URL=redis://...
REDIS_ENABLED=true
WS_REDIS_CHANNEL=ws:broadcast
DB_POOL_MAX=20
API_RATE_LIMIT_MAX=600
WS_MAX_CONNECTIONS=2000
```

## 3) Multi-instance validation (only when using multiple instances)

- Deploy at least 2 app instances.
- Open user session A on instance #1 and session B on instance #2.
- Trigger event/message from A and verify B receives WS update.
- Verify logs:
  - `ws.redis_enabled`
  - `rate_limit.redis_enabled`

For a single-instance launch, record that decision explicitly and verify the instance, database and upload storage have adequate limits. Redis is still useful but is not a substitute for durable infrastructure.

## 4) Load smoke (HTTP)

Run against deployed service:

```bash
npm run load:smoke:http -- https://your-domain 1000 50
```

Acceptance guideline:

- `failed` is `0`.
- `5xx` responses are `0`.
- p95 latency should be stable and within your SLO target.

## 5) Operational checks

- `/ready` pool stats show low `waiting` during normal traffic.
- No recurrent `ws.redis_publish_failed` or `redis.client_error` logs.
- Database connection limits are compatible with:
  - `DB_POOL_MAX * number_of_instances`.

## 6) Rollout plan for an invitation-only club

1. Invite a small pilot group of directors.
2. Watch 30-60 min:
   - 5xx rate
   - p95 latency
   - reconnect rate for WS
   - rate-limit spikes
3. Move to 100% if stable.

## 7) Rollback criteria

Rollback immediately if:

- sustained elevated 5xx
- widespread WS delivery failures
- DB pool saturation (`waiting` grows continuously)
- authentication instability under load
