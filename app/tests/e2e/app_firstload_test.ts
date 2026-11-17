import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const BUDGET_BYTES = 15_000_000; // design §9

test('test_first_load_under_budget_and_no_world_chunk', async ({ page }) => {
  const bodies: Promise<number>[] = [];
  const urls: string[] = [];
  page.on('response', (res) => {
    urls.push(res.url());
    bodies.push(res.body().then((b) => b.length, () => 0));
  });
  await page.goto('./');
  await page.waitForSelector('html[data-ready="1"]');
  const total = (await Promise.all(bodies)).reduce((a, b) => a + b, 0);
  console.log(`first-load decoded bytes: ${total}`);
  expect(total).toBeLessThanOrEqual(BUDGET_BYTES);
  expect(urls.filter((u) => u.includes('w10'))).toEqual([]);
});

const FONT_BUDGET_BYTES = 200_000; // Chambre noire : Instrument Serif + Atkinson Hyperlegible Next, plus Montserrat/Inter gardées pour ?parcours=ancien ; même plafond que tests/unit/ui/ui_font_test.ts

test('test_first_load_with_screens_font_under_budget', async ({ page, baseURL }) => {
  const fontsPath = new URL('fonts/', baseURL).pathname; // `/fonts/` en local, `/<dépôt>/fonts/` sous `APP_BASE` (CI)
  const fonts: { url: string; bytes: Promise<number> }[] = [];
  page.on('response', (res) => {
    if (/\.(woff2?|ttf|otf)(\?|$)/.test(res.url())) fonts.push({ url: res.url(), bytes: res.body().then((b) => b.length, () => 0) });
  });
  await page.goto('./');
  await page.waitForSelector('html[data-ready="1"]');
  await page.evaluate(() => document.fonts.ready);
  const sizes = await Promise.all(fonts.map(async (f) => ({ url: f.url, bytes: await f.bytes })));
  console.log(`font bytes: ${JSON.stringify(sizes.map((s) => [s.url.split('/').pop(), s.bytes]))}`);
  // le navigateur ne charge une face que quand un texte l'utilise ; tout vient de /fonts/ (même origine), jamais d'ailleurs
  const allowed = (JSON.parse(readFileSync('public/fonts/fonts.lock.json', 'utf8')) as { files: { file: string }[] }).files.map((f) => f.file).sort();   // les faces vendorisées, épinglées par le verrou
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) {
    expect(new URL(s.url).pathname.startsWith(fontsPath)).toBe(true);
    expect(allowed).toContain(s.url.split('/').pop());
  }
  expect(sizes.reduce((a, s) => a + s.bytes, 0)).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
  // pire cas : toutes les faces chargées, mesurées sur le paquet construit (aucun woff : le navigateur ne le demande pas)
  const built = readdirSync('dist/fonts').filter((n) => n.endsWith('.woff2'));
  expect(built.sort()).toEqual(allowed);
  expect(built.reduce((a, n) => a + statSync(`dist/fonts/${n}`).size, 0)).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
});
