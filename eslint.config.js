const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

const frontendGlobals = [
  'API', 'APPSTATE', 'escapeHtml', 'escapeAttr', 'notify', 'showModal', 'confirmDialog', 'feedbackDialog',
  'getCurrentUserEmail', 'getCurrentUserName', 'isAdmin',
  'getCurrentDirectorName', 'getCurrentSchoolName',
  'setMyProfileCache', 'getMyProfileCache', 'getMySchoolCache',
  'directorsCache', 'mentorsCache', '__myProfile', '__mySchool',
  'showLoginModal', 'showRegisterModal', 'showForgotPasswordModal', 'showResetPasswordModal', 'logout', 'showMainApp',
  'initTabs', 'initPWA',
  'renderDirectors', 'renderMentors', 'renderEvents',
  'renderAdminPanel', 'renderGL', 'renderInternship', 'renderCalendar',
  'loadMyRating', 'setRatingPublic', 'updateProfileRatingDisplay',
  'addStrength', 'addSkill', 'saveProfile', 'saveSchool',
  'loadUserDataIntoForms', 'bindCreateEvent', 'bindDirectorSearch',
  'showDirectorDetail', 'promptAndRegister', 'pendingPhotoFile',
  'currentSearchTerm', '__currentPage', '__totalPages', '__searchTimer',
  'WS', 'NOTIF',
  'openMsgDropdown', 'showMessageModal',
  'renderStaticViews', 'initStaticViewBindings', 'initApp',
  'renderProfileView', 'renderSchoolView', 'renderEventsView', 'renderDirectorsView', 'renderMentorsView', 'renderExpertView',
  'clearFormErrors', 'markFieldInvalid', 'showFormStatus', 'setButtonBusy', 'collectFormData', 'validateProfileForm', 'validateSchoolForm', 'initPhotoUpload'
  , 'renderEventsState', 'buildEventCardHtml', 'bindEventListActions', 'openRegistrationModal',
  'renderDirectorCard', 'renderDirectorsState', 'bindDirectorActions', 'getDirectorsCache', 'normalizeMaxLink', 'getMaterialTypeLabel'
];

module.exports = [
  { ignores: ['node_modules/', 'docs/', 'public/uploads/'] },
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
    files: ['server/**/*.js', 'server.js', 'scripts/**/*.js'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      'no-console': 'off'
    }
  },
  // Фронтенд (SPA с глобальными функциями)
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...Object.fromEntries(frontendGlobals.map(g => [g, 'writable'])) },
      sourceType: 'script'
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'error',
      'no-redeclare': 'off',
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
