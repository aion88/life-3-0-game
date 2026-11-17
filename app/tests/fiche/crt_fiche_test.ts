import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const EVIDENCE = join(ROOT, 'production/qa/evidence');

for (const state of ['snow', 'dark', 'testcard'] as const) {
  test(`test_crt_fiche_has_no_panel : état ${state}`, async ({ page }) => {
    mkdirSync(EVIDENCE, { recursive: true });
    await page.goto(`/tools/fiche/crt.html?state=${state}`);
    await page.waitForSelector('html[data-ready="true"]');
    // AM-2.2 : le mur se mesure seul, aucun panneau d'interface dans la page
    expect(await page.locator('[data-ui]').count(), 'la fiche CRT ne monte aucun panneau').toBe(0);
    const file = join(EVIDENCE, `fiche-crt-${state}.png`);
    await page.screenshot({ path: file });
    const out = execFileSync('python3', ['-I', join(ROOT, 'tools/art/mesure_photo.py'), file], { encoding: 'utf8' });
    console.log(`--- ${state} ---\n${out}`);
    expect(out.length).toBeGreaterThan(0);
  });
}
