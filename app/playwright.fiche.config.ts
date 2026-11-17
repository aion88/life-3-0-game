import { defineConfig } from '@playwright/test';

/**
 * Fiche machine du mur de CRT [plan 03 T1, étape 5] : `npm run fiche:crt`.
 * Rend le mur dans ses trois états à 1440 x 900 avec un profil de couleur sRGB forcé, enregistre les captures dans
 * `production/qa/evidence/` puis lance `tools/art/mesure_photo.py` sur chacune. Preuve ADVISORY, signée par l'art-director.
 */
/** Port surchargeable (`FICHE_PORT`) ; défaut inchangé. */
const fichePort = process.env['FICHE_PORT'] ?? '4174';

export default defineConfig({
  testDir: 'tests/fiche',
  testMatch: '**/*_test.ts',
  workers: 1,
  use: {
    baseURL: `http://localhost:${fichePort}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    launchOptions: { args: ['--force-color-profile=srgb'] },
  },
  webServer: {
    command: `npx vite --port ${fichePort} --strictPort`,
    url: `http://localhost:${fichePort}/tools/fiche/crt.html`,
    reuseExistingServer: !process.env['CI'],
  },
});
