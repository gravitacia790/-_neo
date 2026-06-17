const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET должен быть не короче 32 символов'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_PASSWORD: z.string().optional().or(z.literal('')),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
  DATABASE_URL: z.string().optional().or(z.literal('')),
  COOKIE_DOMAIN: z.string().optional().or(z.literal('')),
  VAPID_SUBJECT: z.string().optional().or(z.literal('')),
  VAPID_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  VAPID_PRIVATE_KEY: z.string().optional().or(z.literal('')),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(100).max(10000).default(600),
  WS_MAX_CONNECTIONS: z.coerce.number().int().min(100).max(50000).default(2000),
  REDIS_URL: z.string().optional().or(z.literal('')),
  WS_REDIS_CHANNEL: z.string().default('ws:broadcast'),
  SMTP_HOST: z.string().optional().or(z.literal('')),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.string().optional().or(z.literal('')),
  SMTP_USER: z.string().optional().or(z.literal('')),
  SMTP_PASS: z.string().optional().or(z.literal('')),
  MAIL_FROM: z.string().optional().or(z.literal('')),
  MAX_BOT_TOKEN: z.string().optional().or(z.literal('')),
  MAX_BOT_NAME: z.string().optional().or(z.literal('')),
  MAX_API_BASE: z.string().optional().or(z.literal('')),
  MAX_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
});

function validateConfig(env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error('[config] Некорректная конфигурация окружения: ' + details);
  }

  const config = parsed.data;
  if (config.NODE_ENV !== 'test' && !config.DATABASE_URL) {
    throw new Error('[config] DATABASE_URL обязателен для запуска вне test-среды');
  }
  if (config.NODE_ENV === 'production') {
    if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
      throw new Error('[config] В production должны быть заданы ADMIN_EMAIL и ADMIN_PASSWORD');
    }
    if (config.ADMIN_PASSWORD === 'admin123' || config.ADMIN_PASSWORD.length < 10) {
      throw new Error('[config] В production ADMIN_PASSWORD слишком слабый');
    }
    const weakJwt =
      config.JWT_SECRET === 'change-me-to-a-long-random-string' ||
      config.JWT_SECRET.startsWith('change-me-to-a-long-random-string');
    if (weakJwt) {
      throw new Error('[config] В production запрещён шаблонный JWT_SECRET');
    }
  }
  return config;
}

function getAuthCookieOptions(config) {
  const isProd = config.NODE_ENV === 'production';
  const opts = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
  if (config.COOKIE_DOMAIN) opts.domain = config.COOKIE_DOMAIN;
  return opts;
}

module.exports = { validateConfig, getAuthCookieOptions };
