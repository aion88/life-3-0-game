import { test } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Capture VIVANTE pour Cynthia : la rue au checkpoint (joueur z <= -10.0), une option désignée, en français, 1920 x 1080.
 * Ne tourne que si `CYNTHIA_SHOTS=<dossier>` est posé ; sinon le test est ignoré (aucune assertion de rendu, c'est une preuve visuelle).
 */
test('test_cynthia_live_street_checkpoint_designated_option_fr_1920', async ({ page }, info) => {
  test.skip(process.env['CYNTHIA_SHOTS'] === undefined, 'capture de preuve : CYNTHIA_SHOTS=<dossier>');
  test.setTimeout(240_000);
  await openCapture(page, { lang: 'fr', viewport: { width: 1920, height: 1080 }, query: info.project.name === 'webgl2' ? 'webgl' : '' });
  await page.keyboard.down('KeyW');
  try {
    for (let t = 0; t < 60_000; t += 500) {
      await st(page, 'step', 500, { render: false });
      if ((await st(page, 'state')).player.z <= -10.0) break;
    }
  } finally { await page.keyboard.up('KeyW'); }
  await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
  await settle(page, 1000);
  await page.locator('[data-choice="checkpoint.j1"] [data-ui="choice-name"]').evaluate((e) => { (e as HTMLElement).click(); });
  await page.locator('[data-choice="checkpoint.j1"] [data-option="comply"]').evaluate((e) => { (e as HTMLElement).click(); });
  await page.waitForSelector('[data-ui="price"]');
  await settle(page, 500);
  await page.screenshot({ path: `${process.env['CYNTHIA_SHOTS']}/cynthia-apres-rue.png` });
});
