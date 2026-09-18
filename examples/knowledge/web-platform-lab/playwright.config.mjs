import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 10_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: 1,
  reporter: 'line',
  webServer: {
    command: 'node server.mjs',
    cwd: new URL('.', import.meta.url).pathname,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    channel: 'chrome',
    trace: 'retain-on-failure'
  }
});
