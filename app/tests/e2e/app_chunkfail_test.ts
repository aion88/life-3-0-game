import { expect, test, type Page } from '@playwright/test';
import { LINES, SAVE_KEY, seedJson, seedSave, continueIfAsked } from '../support/e2e';

test.use({ locale: 'en-US' });

/** Sauvegarde valide en phase `street`, réponses complètes, anglais : le fast-forward réel route droit vers la rue, sans rien écrire [plan 03 T15]. */
const SEED = seedJson({ lang: 'en', phase: 'street', line: LINES.w10 });

async function toStreet(page: Page): Promise<void> {
  await seedSave(page, SEED);
  await page.goto('./?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
}
const saved = (page: Page): Promise<string | null> => page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);

/** Le chunk de `runtime.ts` : nom relevé dans `dist/assets/` après `vite build` (`runtime-<hash>.js`), motif de route ci-dessous. */
const RUNTIME_CHUNK = '**/assets/runtime-*.js';
/** Fin du montage de l'écran réel : sa racine existe, ou l'erreur nommée des corps manquants, ou le panneau sans GPU. */
const STREET_UP = '[data-ui="street"]';

test('test_runtime_chunk_abort_shows_retry_then_recovers', async ({ page }) => {
  await page.route(RUNTIME_CHUNK, (r) => r.abort());
  await toStreet(page);
  const action = page.getByTestId('error-action');
  await expect(page.locator('body')).toContainText('The content could not be loaded.');
  await expect(action).toHaveText('Try again');
  const before = await saved(page);
  expect(before).toBe(SEED);
  await page.unroute(RUNTIME_CHUNK);
  const chunk = page.waitForResponse((r) => /\/assets\/runtime-.*\.js/.test(r.url()));
  await action.click();
  expect((await chunk).status()).toBe(200);
  await expect(page.locator(STREET_UP)).toHaveCount(1);
  await expect(action).toHaveCount(0);
  expect(await saved(page)).toBe(before);
});

test('test_runtime_chunk_missing_after_redeploy_reloads_and_keeps_save', async ({ page }) => {
  await page.route(RUNTIME_CHUNK, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' }));
  await toStreet(page);
  const action = page.getByTestId('error-action');
  await expect(action).toHaveText('Try again');
  const before = await saved(page);
  expect(before).toBe(SEED);
  await action.click();
  await expect(action).toHaveText('Reload the page');
  const reloaded = page.waitForEvent('load');
  await action.click();
  await reloaded;
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  expect(await saved(page)).toBe(before);
});
