import { defineConfig } from '@playwright/test';

/** `APP_BASE` fixe le chemin public de déploiement (défaut `/`). */
/** Ports des serveurs de preview, surchargeables (`PREVIEW_PORT`, `CAPTURE_PORT`) quand plusieurs agents capturent en parallèle ; défauts inchangés. */
const previewPort = process.env['PREVIEW_PORT'] ?? '4173';
const appBase = process.env['APP_BASE'] ?? '/';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*_test.ts',
  use: { baseURL: `http://localhost:${previewPort}${appBase}` },
  webServer: {
    command: 'npm run preview',
    url: `http://localhost:${previewPort}${appBase}`,
    reuseExistingServer: !process.env['CI'],
  },
});
