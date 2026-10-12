import { defineConfig } from '@playwright/test';
const previewURL = `http://127.0.0.1:${process.env.HIVE_PREVIEW_PORT ?? 4173}/preview/`;
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', fullyParallel: false, workers: 1,
  timeout: 45000, expect: { timeout: 10000 }, outputDir: '/tmp/hive-wars-playwright-results',
  reporter: [['list'], ['json', { outputFile: '/tmp/hive-wars-playwright.json' }]],
  use: { baseURL: previewURL, headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/serve.mjs', url: previewURL, reuseExistingServer: false, timeout: 10000 },
});
