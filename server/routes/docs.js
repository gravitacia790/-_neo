const express = require('express');
const swaggerUi = require('swagger-ui-express');
const authRequired = require('../middleware/authRequired');
const adminRequired = require('../middleware/adminRequired');

const SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Гравитация NEO API',
    version: '2.0.0',
    description: 'API профессионального сообщества директоров школ Московской области',
  },
  servers: [{ url: '/', description: 'Local' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['director', 'admin'] },
          approval_status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        },
      },
      Error: { type: 'object', properties: { error: { type: 'string' } } },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Director: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' },
          school: { type: 'string' },
          city: { type: 'string' },
          isMentor: { type: 'boolean' },
          photo: { type: 'string', nullable: true },
          rating: {
            type: 'object',
            nullable: true,
            properties: { totalScore: { type: 'integer' }, public: { type: 'boolean' } },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [], cookieAuth: [] }],
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['name', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Заявка создана и ожидает подтверждения администратора',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    pendingApproval: { type: 'boolean', example: true },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          409: { description: 'Email занят' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string' }, password: { type: 'string' } },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Успех' },
          401: { description: 'Неверные данные' },
          403: { description: 'Заявка ещё не одобрена или отклонена' },
        },
      },
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Выход', responses: { 200: { description: 'Успех' } } },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Текущий пользователь',
        security: [{ bearerAuth: [], cookieAuth: [] }],
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/directors': {
      get: {
        tags: ['Directors'],
        summary: 'Список директоров с пагинацией',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          { in: 'query', name: 'q', schema: { type: 'string' }, description: 'Поиск' },
        ],
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/directors/mentors': {
      get: { tags: ['Directors'], summary: 'Наставники', responses: { 200: { description: 'Успех' } } },
    },
    '/api/directors/{id}': {
      get: {
        tags: ['Directors'],
        summary: 'Детально о директоре',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Успех' }, 404: { description: 'Не найдено' } },
      },
    },
    '/api/profile': {
      get: { tags: ['Profile'], summary: 'Профиль + школа', responses: { 200: { description: 'Успех' } } },
      put: { tags: ['Profile'], summary: 'Обновить профиль', responses: { 200: { description: 'Успех' } } },
    },
    '/api/profile/school': {
      get: { tags: ['Profile'], summary: 'Информация о школе', responses: { 200: { description: 'Успех' } } },
      put: { tags: ['Profile'], summary: 'Обновить школу', responses: { 200: { description: 'Успех' } } },
    },
    '/api/profile/photo': {
      post: {
        tags: ['Profile'],
        summary: 'Загрузить фото',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/events': {
      get: { tags: ['Events'], summary: 'Все мероприятия', responses: { 200: { description: 'Успех' } } },
      post: { tags: ['Events'], summary: 'Создать мероприятие', responses: { 200: { description: 'Успех' } } },
    },
    '/api/events/{id}/register': {
      post: {
        tags: ['Events'],
        summary: 'Зарегистрировать сотрудника',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/events/{id}': {
      delete: {
        tags: ['Events'],
        summary: 'Удалить мероприятие',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/extras/{category}': {
      get: {
        tags: ['Extras'],
        summary: 'Категория доп. программ',
        parameters: [
          {
            in: 'path',
            name: 'category',
            required: true,
            schema: { type: 'string', enum: ['gl', 'internship', 'calendar'] },
          },
        ],
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/extras/{category}/{eventId}/register': {
      post: {
        tags: ['Extras'],
        summary: 'Регистрация на доп. программу',
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/ratings/me': {
      get: { tags: ['Ratings'], summary: 'Мой рейтинг', responses: { 200: { description: 'Успех' } } },
    },
    '/api/ratings/me/visibility': {
      put: { tags: ['Ratings'], summary: 'Изменить видимость рейтинга', responses: { 200: { description: 'Успех' } } },
    },
    '/api/ratings/by-id/{id}': {
      get: {
        tags: ['Ratings'],
        summary: 'Рейтинг по ID',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Успех' } },
      },
    },
    '/api/admin/users': {
      get: { tags: ['Admin'], summary: 'Все пользователи (admin)', responses: { 200: { description: 'Успех' } } },
    },
  },
};

const router = express.Router();

router.use(
  '/',
  authRequired,
  adminRequired,
  swaggerUi.serve,
  swaggerUi.setup(SPEC, {
    customSiteTitle: 'Гравитация NEO API',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

router.get('/json', authRequired, adminRequired, (req, res) => res.json(SPEC));

module.exports = router;
