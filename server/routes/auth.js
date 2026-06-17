const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const { getAuthCookieOptions } = require('../config');
const { createResetCode, loginUser, registerDirector, resetPasswordWithCode } = require('../services/authService');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z
    .string()
    .email()
    .max(160)
    .transform((e) => e.toLowerCase().trim()),
  phone: z.string().max(40).optional().default(''),
  password: z.string().min(6).max(200),
});

const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim()),
  code: z.string().regex(/^\d{6}$/, 'Код состоит из 6 цифр'),
  password: z.string().min(6).max(200),
});

function getCookieOpts() {
  return getAuthCookieOptions({
    NODE_ENV: process.env.NODE_ENV || 'development',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',
  });
}

function setTokenCookie(res, token) {
  res.cookie('token', token, getCookieOpts());
}

function clearTokenCookie(res) {
  const opts = getCookieOpts();
  const clearOpts = { path: opts.path, secure: opts.secure, sameSite: opts.sameSite };
  if (opts.domain) clearOpts.domain = opts.domain;
  res.clearCookie('token', clearOpts);
}

router.post(
  '/register',
  safe('auth')(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.issues });
    const { name, email, phone, password } = parsed.data;

    const result = await registerDirector({ name, email, phone, password });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(202).json(result);
  })
);

router.post(
  '/login',
  safe('auth')(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
    const { email, password } = parsed.data;

    const result = await loginUser({ email, password });
    if (result.error) return res.status(result.status).json({ error: result.error });
    const { user, token } = result;
    setTokenCookie(res, token);
    res.json({ user, token: process.env.NODE_ENV === 'production' ? undefined : token });
  })
);

router.post(
  '/logout',
  safe('auth')((req, res) => {
    clearTokenCookie(res);
    res.json({ ok: true });
  })
);

router.post(
  '/forgot-password',
  safe('auth')(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });
    const result = await createResetCode(parsed.data.email);
    res.json(result);
  })
);

router.post(
  '/reset-password',
  safe('auth')(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Неверный код или пароль (мин. 6 символов)' });
    const result = await resetPasswordWithCode(parsed.data.email, parsed.data.code, parsed.data.password);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.get(
  '/me',
  authRequired,
  safe('auth')((req, res) => {
    res.json({ user: req.user });
  })
);

module.exports = router;
