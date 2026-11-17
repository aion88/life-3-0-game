import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';

/** Real mouse and keyboard paths: one selection reveals its consequence and unlocks Continue immediately. */
let server: PreviewServer;
let url = '';
test.beforeAll(async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'q-continue-'));
  await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  server = await preview({ logLevel: 'silent', build: { outDir }, preview: { port: 4178, strictPort: true } });
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { if (server) await new Promise<void>((r) => server.httpServer.close(() => r())); });

/** Clic souris au centre de la boîte, comme un joueur (pas de `locator.click`, qui attend l'actionnabilité). */
async function mouseClick(page: Page, el: Locator): Promise<void> {
  const box = await el.boundingBox();
  expect(box, 'élément visible à l\'écran').not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

/** Vrai si le point central de l'élément tombe sur lui (ou un descendant) : ce qu'un clic souris atteindrait. */
const reachable = (el: Locator): Promise<boolean> => el.evaluate((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit !== null && b.contains(hit); });

/** Scène de quatre lignes, la longueur des textes réels (même texte que `questionnaire_frame_test`). */
const LONG_SCENE = 'Ta commune consulte les habitants sur des caméras à reconnaissance faciale en direct pour le marché du samedi. Selon le ministère, ce procédé a conduit à plus de mille arrestations entre janvier 2024 et septembre 2025, et environ deux tiers du public l\'approuvent.';

/** Apparence du bouton : ce qu'un joueur voit (fond, image de fond, curseur). */
const look = (el: Locator): Promise<string> => el.evaluate((b) => { const s = getComputedStyle(b); return `${s.backgroundColor}|${s.backgroundImage}|${s.cursor}`; });

test('test_questionnaire_mouse_path_reaches_question_two', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.waitForSelector('html[data-ready="1"]');
  await mouseClick(page, page.locator('[data-lang="fr"]'));
  await mouseClick(page, page.getByTestId('warning-continue'));
  await page.waitForSelector('[data-option]');
  const title = page.locator('.c-q-title');
  const firstTitle = await title.textContent();
  await page.evaluate((txt) => { document.querySelector('[data-testid="q-scene"]')!.textContent = txt; }, LONG_SCENE);

  const option = page.locator('[data-option]').first();
  await mouseClick(page, option);
  await expect(option).toHaveAttribute('data-state', 'selected');

  const go = page.getByTestId('q-continue');
  await expect(go).toBeVisible();
  await expect(go).toBeEnabled();
  await expect(page.getByTestId('q-cost')).toBeVisible();
  expect(await reachable(go)).toBe(true);
  expect((await look(go)).split('|')[2]).toBe('pointer');
  expect(await go.evaluate(b => getComputedStyle(b).backgroundImage)).toBe('none');
  mkdirSync('../production/qa/evidence/ui/2026-11-09-questionnaire-immediate', { recursive: true });
  await page.screenshot({ path: '../production/qa/evidence/ui/2026-11-09-questionnaire-immediate/desktop.png' });

  await mouseClick(page, go);
  await expect(title).not.toHaveText(firstTitle!);
  await expect(page.locator('[data-option][data-state="selected"]')).toHaveCount(0);
  await expect(page.locator('[data-option]').first()).toBeEnabled();
});

test('questionnaire keyboard selection is editable and continues without a timer', async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 });
  await page.goto(url); await page.waitForSelector('html[data-ready="1"]');
  await page.locator('[data-lang="fr"]').click(); await page.getByTestId('warning-continue').click();
  await page.waitForSelector('[data-option]');
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const first = page.locator('[data-option]').first(); const second = page.locator('[data-option]').nth(1);
  await first.focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('q-continue')).toBeEnabled();
  const before = await page.getByTestId('q-cost').textContent();
  await second.focus(); await page.keyboard.press('Space');
  await expect(second).toHaveAttribute('aria-pressed','true');
  await expect(first).toHaveAttribute('aria-pressed','false');
  await expect(page.getByTestId('q-cost')).not.toHaveText(before!);
  expect(await page.getByTestId('q-cost').evaluate(b => getComputedStyle(b).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  mkdirSync('../production/qa/evidence/ui/2026-11-09-questionnaire-immediate', { recursive: true });
  await page.screenshot({ path: '../production/qa/evidence/ui/2026-11-09-questionnaire-immediate/mobile.png', animations: 'disabled' });
  const title = await page.locator('.c-q-title').textContent();
  await page.getByTestId('q-continue').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.c-q-title')).not.toHaveText(title!);
});
