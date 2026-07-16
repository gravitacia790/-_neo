const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const port = Number(process.env.E2E_PORT || 3100);
const baseUrl = `http://127.0.0.1:${port}`;
const serverPath = path.join(ROOT, 'server.js');
const playwrightCli = require.resolve('@playwright/test/cli');

const testEnv = {
  ...process.env,
  E2E_MANAGED_SERVER: 'true',
  NODE_ENV: 'test',
  PORT: String(port),
  JWT_SECRET: 'playwright-jwt-secret-at-least-32-characters-long',
  ADMIN_EMAIL: 'admin@test.ru',
  ADMIN_PASSWORD: 'admin123',
  REDIS_ENABLED: 'false',
  REDIS_URL: '',
};

let serverProcess;
let testProcess;
let shuttingDown = false;

function pipeServerOutput(stream, label) {
  stream.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
}

function stopProcess(child) {
  if (child && !child.killed) child.kill();
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcess(testProcess);
  stopProcess(serverProcess);
  setTimeout(() => process.exit(exitCode), 1000).unref();
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`E2E server exited before readiness with code ${serverProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (_) {
      // The server may still be applying migrations or binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`E2E server did not become ready within ${timeoutMs} ms`);
}

async function run() {
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: ROOT,
    env: testEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeServerOutput(serverProcess.stdout, 'e2e-server');
  pipeServerOutput(serverProcess.stderr, 'e2e-server-error');

  await waitForHealth(120000);

  testProcess = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
    cwd: ROOT,
    env: testEnv,
    stdio: 'inherit',
  });
  testProcess.on('exit', (code, signal) => {
    if (signal) {
      shutdown(1);
      return;
    }
    shutdown(code == null ? 1 : code);
  });
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

run().catch((error) => {
  console.error(`[e2e-runner] ${error.message}`);
  shutdown(1);
});
