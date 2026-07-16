const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const e2ePort = Number(process.env.E2E_PORT || 3100);
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const e2eEnvScript = path.join(__dirname, 'scripts', 'e2e-env.js');
const e2eServerPath = path.join(__dirname, 'server.js');
const e2eServerCommand = `${process.execPath} -r "${e2eEnvScript}" "${e2eServerPath}"`;
const managedByRunner = process.env.E2E_MANAGED_SERVER === 'true';

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
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: managedByRunner
    ? undefined
    : {
        command: e2eServerCommand,
        url: `${e2eBaseUrl}/health`,
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          NODE_ENV: 'test',
          PORT: String(e2ePort),
          JWT_SECRET: 'playwright-jwt-secret-at-least-32-characters-long',
          ADMIN_EMAIL: 'admin@test.ru',
          ADMIN_PASSWORD: 'admin123',
          REDIS_ENABLED: 'false',
          REDIS_URL: '',
        },
      },
});
