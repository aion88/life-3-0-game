import { defineConfig } from '@playwright/test';

/** Prise des plaques d'essai du correctif de rendu : serveur de capture lancé à la main (`CAPTURE_URL`), aucun `webServer`. */
export default defineConfig({
  testDir: 'tests/render-fix',
  testMatch: '**/*_test.ts',
  timeout: 120_000,
  workers: 1,
  projects: [
    { name: 'webgl2', use: { browserName: 'chromium' } },
    { name: 'webgpu-mac', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
});
