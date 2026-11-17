import { defineConfig } from '@playwright/test';

/** Suite d'interface C (`npx playwright test --config playwright.ui.config.ts`) [plan UI-C T4, étendue en T13]. Pages assemblées par esbuild, aucun serveur. */
export default defineConfig({
  testDir: 'tests/e2e-ui',
  testMatch: '**/*_test.ts',
  timeout: 60_000,
  workers: 1,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
