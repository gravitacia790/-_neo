# Гравитация NEO

Профессиональное сообщество директоров школ Московской области.

## Стек

- **Бэкенд:** Node.js 22+ + Express 4, PostgreSQL (`pg`), JWT в httpOnly cookie, Zod, WebSocket (`ws`).
- **Фронтенд:** ванильный JS + HTML + CSS (same-origin с API).
- **Безопасность:** helmet (CSP), CSRF double-submit, rate limit, bcrypt, structured logs.

## Запуск (development)

```bash
npm install
copy .env.example .env   # Windows
# Задайте JWT_SECRET (мин. 32 символа) и ADMIN_* в .env
npm start
```

Откройте http://localhost:3000

При первом запуске:
- создаются таблицы в PostgreSQL (если отсутствуют)
- создаётся администратор (если заданы `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- сидируются 4 демо-директора (`elena@school11.ru` / `demo1234`)

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
npm ci --omit=dev
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
3. Render создаст сервис `gravitacia-neo` и диск `gravitacia-data`.
4. В переменных окружения задайте:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (сильный, 10+ символов)
5. Дождитесь первого деплоя и откройте URL сервиса.

Важно:
- задайте `DATABASE_URL` в переменных окружения сервиса;
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
```

## Структура проекта

```
DS-neo/
├── server.js
├── server/
│   ├── db.js, migrate.js, auth.js, ws.js, config.js
│   ├── middleware/   (authRequired, csrf, safe, adminRequired)
│   ├── routes/       (auth, profile, directors, events, …)
│   ├── services/
│   └── migrations/
├── public/           (SPA + js/api.js)
└── test/
```

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
- JWT в **httpOnly** cookie, `SameSite=Strict` в production.
- CSRF: double-submit (`csrf` cookie + `X-CSRF-Token`).
- WebSocket: без валидного токена соединение закрывается (`1008`).
- CORS в production отключён (ожидается same-origin).
- Helmet CSP: `connect-src` включает `wss:` для WebSocket.
