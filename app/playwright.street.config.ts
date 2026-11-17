import { defineConfig } from '@playwright/test';

/**
 * Suite de la rue (`npm run e2e:street`) [plan 02a T12, T13]. Deux serveurs : le build de production sur 4173 (parcours de reprise,
 * absence de `__street`, octets reçus) et le build de capture sur 4174 (`VITE_CAPTURE=1`, `window.__street`, pas à pas). Deux projets :
 * `webgl2` (Chromium livré par Playwright, WebGL 2 logiciel, tourne partout, sans mesure de temps) et `webgpu-mac` (Chrome installé,
 * `channel: 'chrome'`, WebGPU et WebGL 2 sur le GPU de la machine ; seul projet qui juge les temps et la parité). Le plan 00 ne déclare
 * aucun de ces deux projets et son `playwright.config.ts` n'est pas touché.
 */
/** Ports surchargeables (`PREVIEW_PORT`, `CAPTURE_PORT`) pour des suites parallèles ; défauts inchangés (4173, 4174). */
const previewPort = process.env['PREVIEW_PORT'] ?? '4173';
const capturePort = process.env['CAPTURE_PORT'] ?? '4174';
const appBase = process.env['APP_BASE'] ?? '/';

export default defineConfig({
  testDir: 'tests/e2e-street',
  testMatch: '**/*_test.ts',
  timeout: 120_000,
  workers: 1,
  use: { baseURL: `http://localhost:${previewPort}${appBase}` },
  projects: [
    { name: 'webgl2', use: { browserName: 'chromium' } },
    { name: 'webgpu-mac', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: [
    { command: 'npm run build && npm run preview', url: `http://localhost:${previewPort}${appBase}`, reuseExistingServer: !process.env['CI'] },
    { command: 'npm run build:capture && npm run preview:capture', url: `http://localhost:${capturePort}/`, reuseExistingServer: !process.env['CI'] },
  ],
});
