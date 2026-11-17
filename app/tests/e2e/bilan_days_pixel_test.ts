import { expect, test, type Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LINES, installClock, seedJson, seedSave, type SeedActs, continueIfAsked } from '../support/e2e';
import { decodeInBrowser } from '../support/street_capture';

/**
 * Les jours du bilan sont identiques AU PIXEL entre « zéro nom » et « recruté » [spec C §3.4, §9.3 ; ruling GD point 1 ; plan UI-C T10].
 * Les textes de la rangée sont rendus invisibles, chaque pastille est capturée seule (`locator.screenshot`, Context7 le 2026-11-02), puis les PNG
 * sont DÉCODÉS en pixels par le navigateur : les octets PNG ne sont pas comparés (la compression peut varier sans que les pixels changent).
 * Les deux semaines peuvent ne pas avoir la même longueur : la comparaison porte sur les `min(n1, n2)` premiers jours, jamais à vide.
 */
const fixture = (name: string): SeedActs[] => JSON.parse(readFileSync(`tests/fixtures/e2e/${name}`, 'utf8')) as SeedActs[];

interface Shot { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }

async function dayPills(browser: Browser, acts: readonly SeedActs[]): Promise<Shot[]> {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    await installClock(page);
    await seedSave(page, seedJson({ lang: 'fr', phase: 'bilan', line: LINES.w10, acts }));
    await page.goto('./?episode=semaine');
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await expect(page.getByTestId('bilan-days-row')).toHaveCount(1);
    await page.addStyleTag({ content: '[data-testid="bilan-days-row"] [data-day-date], [data-testid="bilan-days-row"] [data-day-line] { visibility: hidden !important; }' });
    const n = await page.locator('[data-day-pill]').count();
    const out: Shot[] = [];
    for (let i = 0; i < n; i++) {
      const png = await page.locator('[data-day-pill]').nth(i).screenshot({ animations: 'disabled' });
      const px = await decodeInBrowser(page, png);
      out.push({ width: px.width, height: px.height, data: px.data });
    }
    return out;
  } finally { await ctx.close(); }
}

test('test_days_row_pixel_identical_zero_name_vs_recruited', async ({ browser }) => {
  const zero = await dayPills(browser, fixture('zero-name-acts.json'));
  const recruited = await dayPills(browser, fixture('recruited-acts.json'));
  const n = Math.min(zero.length, recruited.length);
  expect(n, 'au moins une pastille à comparer').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const a = zero[i]!, b = recruited[i]!;
    expect({ w: a.width, h: a.height }, `dimensions du jour ${i + 1}`).toEqual({ w: b.width, h: b.height });
    let maxAbsDiff = 0;
    for (let k = 0; k < a.data.length; k++) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(a.data[k]! - b.data[k]!));
    expect(maxAbsDiff, `pastille du jour ${i + 1}`).toBe(0);
  }
  // la pastille n'est pas vide : elle a bien un cœur crème sur du ciel, donc plus d'une couleur
  const distinct = new Set<string>();
  const a0 = zero[0]!;
  for (let k = 0; k < a0.data.length; k += 4) distinct.add(`${a0.data[k]},${a0.data[k + 1]},${a0.data[k + 2]}`);
  expect(distinct.size).toBeGreaterThan(2);
});

test('test_last_message_never_cut_at_1920x1080_in_redirected_world', async ({ browser }) => {
  // Monde redirigé : le nom du monde calculé est long, le bloc du monde porte une ligne de plus. Le message du dernier relevé doit rester entier dans la fenêtre.
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    await installClock(page);
    await seedSave(page, seedJson({ lang: 'fr', phase: 'bilan', line: LINES.redirected, acts: fixture('zero-name-acts.json') }));
    await page.goto('./?episode=semaine');
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await expect(page.getByTestId('bilan-world-redirect')).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const box = await page.getByTestId('bilan-message').boundingBox();
    expect(box, 'le message est rendu').not.toBeNull();
    expect(box!.y, 'haut du message dans la fenêtre').toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, 'bas du message dans la fenêtre, avec 16 px de marge').toBeLessThanOrEqual(1080 - 16);
  } finally { await ctx.close(); }
});
