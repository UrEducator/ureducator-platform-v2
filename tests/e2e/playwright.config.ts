import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// The project's Playwright pins one Chromium revision; the sandbox may ship another. Use whichever is installed.
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1248/chrome-linux64/chrome',
  '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
];
const executablePath = process.env.PW_CHROMIUM ?? CANDIDATES.find((p) => existsSync(p));

export default defineConfig({
  testDir: './specs', outputDir: './.results', timeout: 60_000, expect: { timeout: 10_000 },
  fullyParallel: false, workers: 1, retries: 0, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'], launchOptions: { ...(executablePath ? { executablePath } : {}) } },
  webServer: [
    { command: 'node tests/e2e/build-harness.mjs && node tests/e2e/.build/mock-server.cjs', url: 'http://127.0.0.1:4010/__health', reuseExistingServer: false, cwd: '../..', env: { HARNESS_PORT: '4010', OWNER_BOOTSTRAP_EMAIL: 'owner@example.test' } },
    { command: 'node tests/e2e/static-server.mjs apps/web/.next-mock 3100', url: 'http://127.0.0.1:3100/', reuseExistingServer: false, cwd: '../..' },
  ],
});
