import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';
import { LINES, continueIfAsked, seedJson, seedSave } from '../support/e2e';

/**
 * Les années du fast-forward restent dans le cadre utile, entre les deux bandes 2,39:1 [playtest Cynthia 2026-11-03 : « les années en haut sont cropées »].
 * Cause : le `main` de l'écran se posait sur toute la scène (`inset: 0`, marge de 6vh) sans lire `--band-h`, donc le compteur passait sous la bande haute.
 * Mesure la boîte de chaque élément d'année (`[data-ff="year"]`, compteur et pastille de chaque une) contre les bandes, en français,
 * à 1440 x 900 et 1920 x 1080, tout au long de l'écran ; la une entière reste aussi dans le cadre. Puis le mouvement réduit (I-9).
 */
let server: PreviewServer;
let url = '';
test.beforeAll(async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'ff-frame-'));
  await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  server = await preview({ logLevel: 'silent', build: { outDir }, preview: { port: 4183, strictPort: true } });
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { await new Promise<void>((r) => server.httpServer.close(() => r())); });

interface Box { readonly text: string; readonly top: number; readonly bottom: number }
async function measure(page: Page): Promise<{ years: Box[]; topBand: number; bottomBand: number }> {
  // la une entière compte comme une boîte : son année ne doit pas être le seul morceau visible
  return page.evaluate(() => {
    const t = document.querySelector('[data-band="top"]')!.getBoundingClientRect();
    const b = document.querySelector('[data-band="bottom"]')!.getBoundingClientRect();
    const years = [...document.querySelectorAll('[data-ff="year"], [data-testid="ff-une"]')].map((e) => {
      const r = e.getBoundingClientRect();
      return { text: e.matches('[data-ff="year"]') ? e.textContent ?? '' : `une ${(e as HTMLElement).dataset['year']}`, top: r.top, bottom: r.bottom };
    });
    return { years, topBand: t.bottom, bottomBand: b.top };
  });
}

for (const [w, h] of [[1440, 900], [1920, 1080]] as const) {
  test(`test_ff_years_stay_between_letterbox_bands_fr_${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.clock.install();
    await seedSave(page, seedJson({ lang: 'fr', phase: 'fastforward', line: LINES.w10 }));
    await page.goto(url);
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await page.waitForSelector('[data-testid="ff-year"]');
    const seen = new Set<string>();
    for (let ms = 0; ms <= 8_000; ms += 250) {
      const m = await measure(page);
      if (m.years.length === 0) break; // l'écran est parti vers la rue
      for (const y of m.years) {
        seen.add(y.text);
        expect(y.top, `${y.text} à ${ms} ms : haut sous la bande haute`).toBeGreaterThanOrEqual(m.topBand - 0.5);
        expect(y.bottom, `${y.text} à ${ms} ms : bas au-dessus de la bande basse`).toBeLessThanOrEqual(m.bottomBand + 0.5);
      }
      await page.clock.runFor(250);
    }
    for (const y of ['2027', '2028', '2029', '2030']) expect([...seen], y).toContain(`une ${y}`);
  });
}

test('test_ff_fronts_reduced_motion_is_a_fade_of_at_most_120ms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await seedSave(page, seedJson({ lang: 'fr', phase: 'fastforward', line: LINES.w10 }));
  await page.goto(url);
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await page.waitForSelector('[data-testid="ff-year"]');
  let seen = 0;
  for (let ms = 0; ms < 6_000; ms += 100) {
    const anims = await page.evaluate(() => document.getAnimations().map((a) => {
      const e = a.effect as KeyframeEffect;
      return { duration: Number(e.getTiming().duration), props: e.getKeyframes().flatMap((k) => Object.keys(k)) };
    }));
    for (const a of anims) {
      seen++;
      expect(a.duration).toBeLessThanOrEqual(120);
      expect(a.props).not.toContain('transform');
    }
    await page.clock.runFor(100);
  }
  expect(seen).toBeGreaterThan(0);
});
