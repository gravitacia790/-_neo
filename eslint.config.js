const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules/', 'docs/', 'public/uploads/', 'public/js/'] },
  js.configs.recommended,
  prettier,
  // Конфиг ESLint
  {
    files: ['eslint.config.js'],
    languageOptions: { globals: globals.node }
  },
  // Playwright E2E + config
  {
    files: ['e2e/**/*.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }], 'no-console': 'off' }
  },
  // Бэкенд + скрипты
  {
    files: ['server/**/*.js', 'server.js', 'scripts/**/*.js', 'vite.config.js'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      'no-console': 'off'
    }
  },
  // Фронтенд ES-модули (public/src) — настоящие импорты, ловим забытые связи
  {
    files: ['public/src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
      sourceType: 'module',
      ecmaVersion: 2022,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-var': 'off',
      'prefer-const': 'off',
      'no-console': 'off'
    }
  },
  // Service Worker
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker },
      sourceType: 'script'
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-var': 'off',
      'prefer-const': 'off'
    }
  },
  // Тесты
  {
    files: ['test/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest }, sourceType: 'module' },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }], 'no-console': 'off' }
  }
];
