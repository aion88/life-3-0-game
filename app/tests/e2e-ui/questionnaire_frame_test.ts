import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';

/**
 * La carte du questionnaire reste ENTIÈREMENT dans le cadre utile, entre les deux bandes 2,39:1 du cadre [plan UI-C T5, relecture I1 ; spec §6].
 * Mesure la boîte de la carte contre les bandes, à chaque état (repos, désignée, confirmée avec coût et « Continuer »), à 1920 x 1080 et 960 x 540.
 */
let server: PreviewServer;
let url = '';
test.beforeAll(async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'q-frame-'));
  await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  server = await preview({ logLevel: 'silent', build: { outDir }, preview: { port: 4176, strictPort: true } });
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { await new Promise<void>((r) => server.httpServer.close(() => r())); });

async function fits(page: Page): Promise<{ card: { top: number; bottom: number }; topBand: number; bottomBand: number; scrollH: number; clientH: number }> {
  return page.evaluate(() => {
    const c = document.querySelector('.c-q-card')!.getBoundingClientRect();
    const t = document.querySelector('[data-band="top"]')!.getBoundingClientRect();
    const b = document.querySelector('[data-band="bottom"]')!.getBoundingClientRect();
    const el = document.querySelector('.c-q-card')!;
    return { card: { top: c.top, bottom: c.bottom }, topBand: t.bottom, bottomBand: b.top, scrollH: el.scrollHeight, clientH: el.clientHeight };
  });
}

for (const [w, h] of [[1920, 1080], [960, 540]] as const) {
  test(`test_q_card_stays_between_letterbox_bands_${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url);
    await page.waitForSelector('html[data-ready="1"]');
    await page.locator('[data-lang="fr"]').click();
    await page.getByTestId('warning-continue').click();
    await page.waitForSelector('[data-option]');
    const check = async (state: string): Promise<void> => {
      const m = await fits(page);
      expect(m.card.top, `${state} : haut de la carte sous la bande haute`).toBeGreaterThanOrEqual(m.topBand - 0.5);
      expect(m.card.bottom, `${state} : bas de la carte au-dessus de la bande basse`).toBeLessThanOrEqual(m.bottomBand + 0.5);
    };
    await check('repos');
    const o = page.locator('[data-option]').nth(1);
    await o.click();
    await check('désignée');
    await o.click();
    await page.getByTestId('q-continue').waitFor({ state: 'visible' });
    await page.waitForTimeout(600);
    await check('confirmée');
    // scène réelle de quatre lignes : la carte défile en interne, elle ne sort pas du cadre
    await page.evaluate(() => { document.querySelector('[data-testid="q-scene"]')!.textContent = 'Ta commune consulte les habitants sur des caméras à reconnaissance faciale en direct pour le marché du samedi. Selon le ministère, ce procédé a conduit à plus de mille arrestations entre janvier 2024 et septembre 2025, et environ deux tiers du public l\'approuvent.'; });
    await check('scène longue');
  });
}
