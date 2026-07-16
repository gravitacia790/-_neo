process.env.NODE_ENV = 'test';
process.env.PORT = process.env.E2E_PORT || '3100';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'playwright-jwt-secret-at-least-32-characters-long';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.ru';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
process.env.REDIS_ENABLED = 'false';
process.env.REDIS_URL = '';
