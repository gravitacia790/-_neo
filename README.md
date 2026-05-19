# Гравитация

Профессиональное сообщество директоров школ Московской области.

## Стек

- **Бэкенд:** Node.js + Express 4, SQLite (better-sqlite3), JWT-авторизация (bcryptjs), Zod-валидация, Multer для загрузки фото.
- **Фронтенд:** ванильный JS + HTML + CSS, PWA (manifest + service worker).
- **Безопасность:** helmet, compression, morgan, серверная проверка ролей.

## Запуск

```bash
npm install
copy .env.example .env   # на Windows
# отредактируйте JWT_SECRET в .env
npm start
```

Откройте http://localhost:3000

При первом запуске автоматически:
- создаётся БД `data/gravitacia.db`
- создаётся администратор (email/пароль из `.env`)
- сидируются 4 демо-директора с рейтингами

## Структура проекта

```
DS/
├── server.js                # точка входа
├── server/
│   ├── db.js                # инициализация SQLite, миграции, сиды
│   ├── auth.js              # JWT, bcrypt
│   ├── middleware/
│   │   ├── authRequired.js
│   │   └── adminRequired.js
│   └── routes/
│       ├── auth.js          # /api/auth (login, register, me)
│       ├── profile.js       # /api/profile (профиль + школа + фото)
│       ├── directors.js     # /api/directors (список + детали)
│       ├── events.js        # /api/events (CRUD + регистрации)
│       ├── ratings.js       # /api/ratings
│       ├── extras.js        # /api/extras (gl, internship, calendar)
│       └── admin.js         # /api/admin
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/                  # фронт на fetch + JWT в localStorage
│   └── uploads/             # фото директоров
├── data/                    # SQLite-файл (создаётся автоматически)
└── archive/                 # старые версии
```

## API кратко

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход, возвращает JWT |
| GET | `/api/auth/me` | Текущий пользователь |
| GET / PUT | `/api/profile` | Получить / сохранить профиль директора |
| POST | `/api/profile/photo` | Загрузить фото |
| GET / PUT | `/api/profile/school` | Информация о школе |
| GET | `/api/directors` | Все директора (с поиском `?q=...`) |
| GET | `/api/directors/:id` | Детали |
| GET | `/api/directors/mentors` | Только наставники |
| GET / POST | `/api/events` | Список / создание |
| POST | `/api/events/:id/register` | Записать сотрудника |
| DELETE | `/api/events/:id` | Удалить (только своё) |
| GET | `/api/extras/:category` | gl / internship / calendar |
| POST | `/api/extras/:category/:eventId/register` | Запись на доп. программу |
| GET | `/api/ratings/:email` | Рейтинг с проверкой видимости |
| PUT | `/api/ratings/me/visibility` | Переключить публичность |
| GET | `/api/admin/users` | Только для админа |

Все защищённые роуты требуют `Authorization: Bearer <token>`.

## Что изменилось со версии 1.0

- Данные больше **не** хранятся в `localStorage` каждого пользователя — теперь общая БД.
- Авторизация серверная (bcrypt + JWT), а не «кто угодно может стать админом через DevTools».
- `localStorage` на клиенте используется только для хранения JWT-токена и кэша текущего пользователя.

## Безопасность

- Пароли — bcryptjs (10 раундов).
- JWT в `Authorization`-заголовке, срок жизни 7 дней.
- Helmet с CSP под inline-скрипты текущего фронта.
- Multer ограничен 1 МБ и только image/jpeg|png|webp.
- Все входящие тела проходят валидацию Zod.
