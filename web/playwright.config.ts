import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', fullyParallel: false, workers: 1,
  timeout: 45000, expect: { timeout: 10000 }, outputDir: '/tmp/hive-wars-playwright-results',
  reporter: [['list'], ['json', { outputFile: '/tmp/hive-wars-playwright.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173/preview/', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/preview/', reuseExistingServer: false, timeout: 10000 },
});
