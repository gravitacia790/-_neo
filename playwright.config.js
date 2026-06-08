const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      JWT_SECRET: 'playwright-jwt-secret-at-least-32-characters-long',
      ADMIN_EMAIL: 'admin@test.ru',
      ADMIN_PASSWORD: 'admin123',
    },
  },
});

