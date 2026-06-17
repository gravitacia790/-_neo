# Гравитация NEO

Веб-платформа профессионального сообщества директоров школ Московской области. Система объединяет профили директоров и школ, поиск коллег и наставников, мероприятия, сообщения, уведомления, рейтинг активности и административные инструменты.

## Текущая архитектура

- приложение работает как единый Node.js-сервис: Express раздаёт SPA и обслуживает API;
- единственная рабочая база данных — PostgreSQL;
- схема изменяется версионируемыми миграциями из `server/migrations/postgres/`;
- Vitest использует совместимую PostgreSQL-базу в памяти через `pg-mem`;
- WebSocket обеспечивает обновление уведомлений без перезагрузки страницы;
- production-конфигурация рассчитана на same-origin развёртывание.

## Стек

- **Бэкенд:** Node.js 22 + Express 4, PostgreSQL (`pg`), JWT в httpOnly cookie, Zod, WebSocket (`ws`).
- **Фронтенд:** ванильный JS + HTML + CSS (same-origin с API).
- **Безопасность:** helmet (CSP), CSRF double-submit, rate limit, bcrypt, structured logs.
- **Качество:** Vitest, Supertest, Playwright, ESLint, Prettier, GitHub Actions.

## Запуск (development)

```bash
npm ci
copy .env.example .env   # Windows
# Задайте DATABASE_URL, JWT_SECRET (мин. 32 символа) и ADMIN_* в .env
npm run dev   # собирает фронтенд (Vite) и запускает сервер
```

> Фронтенд — ES-модули в `public/src/`, которые Vite собирает в `public/js/app.bundle.js`
> (бандл в git не хранится). `npm run dev` делает сборку и запуск; для продакшена сборка
> выполняется отдельно: `npm run build`, затем `npm start`. Исходники правьте только в `public/src/`.

Откройте http://localhost:3000

При первом запуске:
- применяются ожидающие миграции PostgreSQL
- создаётся администратор (если заданы `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- в development создаются 4 демо-директора (`elena@school11.ru` / `demo1234`)

## Production (рекомендуемая схема)

**Same-origin:** UI и API на одном домене. TLS на reverse-proxy (nginx/Caddy), Node слушает локально.

```bash
# .env
NODE_ENV=production
PORT=3000
JWT_SECRET=<случайная строка 48+ символов>
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gravitacia
ADMIN_EMAIL=admin@example.ru
ADMIN_PASSWORD=<сильный пароль 10+ символов>
```

```bash
npm ci
npm run build   # сборка фронтенд-бандла (нужны devDependencies)
npm start
```

### nginx (пример)

```nginx
server {
    listen 443 ssl http2;
    server_name gravitacia.example.ru;

  ssl_certificate     /etc/letsencrypt/live/gravitacia.example.ru/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/gravitacia.example.ru/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Node использует `trust proxy` — cookie `Secure` и rate limit работают корректно за прокси.

### Render (рекомендуется для быстрого production)

В репозитории есть `render.yaml` (Blueprint) для веб-сервиса.

1. Загрузите изменения в GitHub.
2. В Render: **New +** → **Blueprint** → выберите этот репозиторий.
3. Render создаст сервис `gravitacia-neo` и базу PostgreSQL.
4. В переменных окружения задайте:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (сильный, 10+ символов)
5. Дождитесь первого деплоя и откройте URL сервиса.

Важно:
- `DATABASE_URL` подключается к PostgreSQL из Blueprint;
- `JWT_SECRET` генерируется автоматически Blueprint-ом;
- при free-plan сервис может "засыпать", первый запрос после сна медленнее.

### Бэкапы

Используйте бэкапы PostgreSQL (dump/snapshot) на стороне вашего PostgreSQL-провайдера.

### Health checks

- `GET /health` — процесс жив
- `GET /ready` — PostgreSQL доступна

### Миграции PostgreSQL

```bash
npm run db:migrate          # применить up-миграции
npm run db:migrate:status   # статус миграций
npm run db:migrate:down     # откатить 1 миграцию
```

## Тесты

```bash
npm test
npm run lint
npm run format:check
npm run test:e2e
npm run load:smoke:http -- http://127.0.0.1:3000 200 20
```

Браузерные тесты запускают отдельный сервер на порту `3100` с временной базой `pg-mem`. Они не используют development или production PostgreSQL.

## Структура проекта

```
DS-neo/
├── server.js
├── server/
│   ├── db.js, migrate.js, auth.js, ws.js, config.js
│   ├── middleware/   (authRequired, csrf, safe, adminRequired)
│   ├── routes/       (auth, profile, directors, events, …)
│   ├── services/
│   └── migrations/postgres/   (up/down SQL-миграции)
├── public/
│   ├── src/          (ES-модули фронтенда — исходники)
│   ├── js/app.bundle.js  (сборка Vite, gitignored)
│   ├── css/, index.html, sw.js
├── test/             (API и интеграционные тесты)
├── e2e/              (браузерные сценарии)
├── docs/             (эксплуатация и техническое описание)
└── .github/workflows/ci.yml
```

Подробности эксплуатации и развёртывания находятся в [`docs/RUNBOOK.md`](docs/RUNBOOK.md), актуальное описание требований — в [`docs/ТЕХНИЧЕСКОЕ_ЗАДАНИЕ.md`](docs/ТЕХНИЧЕСКОЕ_ЗАДАНИЕ.md).
Release-checklist для запуска на 1500 пользователей: [`docs/GO_LIVE_1500.md`](docs/GO_LIVE_1500.md).

## API (кратко)

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход (cookie `token`) |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |
| GET/PUT | `/api/profile` | Профиль |
| GET | `/api/directors` | Список (`?q=`, `?page=`, `?limit=`) |
| GET/POST | `/api/events` | Мероприятия |
| GET | `/api/notifications` | Уведомления |
| POST | `/api/messages` | Сообщения |
| WS | `/ws` | Real-time (только с валидным `token`) |

Защищённые маршруты: cookie `token` **или** `Authorization: Bearer …`.

Для POST/PUT/DELETE нужен CSRF: cookie `csrf` + заголовок `X-CSRF-Token` (фронт делает это в `public/js/api.js`).

## Безопасность

- Пароли: bcrypt (10 раундов), блокировка после 5 неудачных входов.
- Восстановление пароля: 6-значный OTP-код на email (SMTP), хранится только в виде sha256-хэша, TTL 10 минут, до 5 попыток, без раскрытия существования аккаунта. SMTP настраивается через `SMTP_*` в `.env`.
- Регистрация директора требует решения администратора: администраторы получают внутреннее и push-уведомление о новой заявке, директор получает письмо после одобрения или отклонения.
- Интеграция с MAX: привязка аккаунта через deep-link/бота (`MAX_*` в `.env`); коды и уведомления могут доставляться в MAX. Webhook защищён секретом и исключён из CSRF.
- JWT в **httpOnly** cookie, `SameSite=Strict` в production.
- CSRF: double-submit (`csrf` cookie + `X-CSRF-Token`).
- WebSocket: без валидного токена соединение закрывается (`1008`).
- CORS в production отключён (ожидается same-origin).
- Helmet CSP: `connect-src` включает `wss:` для WebSocket.
