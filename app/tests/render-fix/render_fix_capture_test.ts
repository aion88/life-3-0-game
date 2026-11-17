import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PLATES, openCapture, settle, shootPng, st } from '../support/street_capture';

/**
 * Prise des quatre plaques d'essai pour la correction du rendu [TV-02a-render] : même séquence que `street_caps_test.ts` (openCapture,
 * settle, setLight, pose, shoot), sans seuils ni fiche. Sortie : `RENDER_FIX_OUT` (dossier), un PNG par plaque.
 */
const OUT = process.env['RENDER_FIX_OUT'] ?? '../production/qa/evidence/street/2026-11-02/render-fix/tmp';
for (const plate of PLATES) {
  test(`render-fix: ${plate.pose}`, async ({ page }, info) => {
    mkdirSync(`${OUT}/${info.project.name}`, { recursive: true });
    await openCapture(page, { lang: 'fr' });
    await settle(page);
    await st(page, 'setLight', plate.light);
    await st(page, 'pose', plate.pose);
    const png = await shootPng(page, 'beauty');
    writeFileSync(`${OUT}/${info.project.name}/${plate.file}`, png);
  });
}
