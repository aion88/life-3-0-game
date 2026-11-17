import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LINES, installClock, seedJson, seedSave, type SeedActs, continueIfAsked } from '../support/e2e';

/**
 * Libellés du kit et des jours MESURÉS dans le navigateur [spec C §3.4, P-15 ; plan UI-C T10] : jamais sous 18 px, la carte grandit en hauteur,
 * aucun mot coupé (ni coupure franche ni césure) ni collé au bord de sa colonne. La police est celle réellement chargée (`document.fonts.check`).
 */
const acts = JSON.parse(readFileSync('tests/fixtures/e2e/zero-name-acts.json', 'utf8')) as SeedActs[];
const MIN_PX = (JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { minTextPx: { v: number } }).minTextPx.v;
const EDGE_PX = 4;   // un mot garde au moins 4 px de jeu avant le bord de sa colonne

for (const lang of ['fr', 'en'] as const) {
  for (const [w, h] of [[1920, 1080], [960, 540]] as const) {
    test(`test_kit_and_day_text_whole_words_18px_${lang}_${w}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await installClock(page);
      await seedSave(page, seedJson({ lang, phase: 'bilan', line: LINES.w10, acts }));
      await page.goto('./?episode=semaine');
      await page.waitForSelector('html[data-ready="1"]');
      await continueIfAsked(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.fonts.check('600 18px "Inter C"')), 'Inter C chargée').toBe(true);
      const rows = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.c-kit-label, .c-kit-state, .c-day-date, .c-day-line')].map((e) => {
        const cs = getComputedStyle(e);
        const probe = document.createElement('span');
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        document.body.append(probe);
        const wordW = Math.max(...(e.textContent ?? '').split(/\s+/).filter(Boolean).map((t) => { probe.textContent = t; return probe.getBoundingClientRect().width; }));
        probe.remove();
        const card = e.closest<HTMLElement>('.c-kit-card');
        const content = e.parentElement!;
        return {
          text: e.textContent ?? '', cls: e.className, fs: parseFloat(cs.fontSize), hyphens: cs.hyphens, wordW, colW: e.getBoundingClientRect().width,
          overflow: e.scrollWidth - e.clientWidth, cardOverflowY: card ? card.scrollHeight - card.clientHeight : 0, cardH: card?.style.height ?? '', contentOverflow: content.scrollWidth - content.clientWidth,
        };
      }));
      expect(rows.length).toBeGreaterThan(10);
      for (const r of rows) {
        const id = `${r.cls} « ${r.text} »`;
        expect(r.fs, `${id} : taille`).toBeGreaterThanOrEqual(MIN_PX);
        expect(r.hyphens, `${id} : pas de césure`).not.toBe('auto');
        expect(r.overflow, `${id} : débordement horizontal`).toBeLessThanOrEqual(0);
        expect(r.contentOverflow, `${id} : débordement du parent`).toBeLessThanOrEqual(0);
        expect(r.colW - r.wordW, `${id} : le plus long mot (${Math.round(r.wordW)} px) tient dans sa colonne (${Math.round(r.colW)} px) avec ${EDGE_PX} px de jeu`).toBeGreaterThanOrEqual(EDGE_PX);
        expect(r.cardOverflowY, `${id} : la carte grandit, rien ne dépasse`).toBeLessThanOrEqual(0);
        expect(r.cardH, `${id} : hauteur de carte non fixée`).toBe('');
      }
      await ctx.close();
    });
  }
}

/** Nom du monde [spec C §3.4, amendement 2026-11-02] : 72 px au plus, 44 px au plus bas, deux lignes au plus, jamais coupé dans un mot, entier dans le bloc. */
const strings = (lang: 'fr' | 'en'): Record<string, string> => JSON.parse(readFileSync(`src/data/strings/${lang}.json`, 'utf8')) as Record<string, string>;
const ARRIVALS = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w10', 'w11'];   // les dix mondes d'arrivée (w07 et w12 sont des extinctions : pas de fiche)
const MAX_PX = (JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { type: { worldName: { v: { px: number } } } }).type.worldName.v.px;
const NAME_MIN_PX = (JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { shape: { worldNameMin: { v: number } } }).shape.worldNameMin.v;

for (const lang of ['fr', 'en'] as const) {
  test(`test_world_name_72_max_44_min_two_lines_whole_words_${lang}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await installClock(page);
    await seedSave(page, seedJson({ lang, phase: 'bilan', line: LINES.w10, acts }));
    await page.goto('./?episode=semaine');
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await page.evaluate(() => document.fonts.ready);
    const names = ARRIVALS.map((id) => strings(lang)[`world.${id}.name`]!);
    const rows = await page.evaluate((ns) => {
      const el = document.querySelector<HTMLElement>('[data-testid="bilan-world-name"]')!;
      return ns.map((n) => {
        el.textContent = n;
        el.style.setProperty('--word-chars', String(Math.max(1, ...n.split(' ').map((w) => w.length))));   // même règle que sheetC.ts
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        return { n, fs: parseFloat(cs.fontSize), hyphens: cs.hyphens, lines: Math.round(el.getBoundingClientRect().height / lh), overflow: el.scrollWidth - el.clientWidth };
      });
    }, names);
    for (const r of rows) {
      expect(r.fs, `${r.n} : taille`).toBeLessThanOrEqual(MAX_PX + 0.5);
      expect(r.fs, `${r.n} : taille`).toBeGreaterThanOrEqual(NAME_MIN_PX - 0.5);
      expect(r.lines, `${r.n} : lignes`).toBeLessThanOrEqual(2);
      expect(r.hyphens, `${r.n}`).toBe('none');
      expect(r.overflow, `${r.n} : un mot dépasse le bloc`).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  });
}

test('test_day_pills_centered_above_their_kit_card_at_1920', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await installClock(page);
  await seedSave(page, seedJson({ lang: 'fr', phase: 'bilan', line: LINES.w10, acts }));
  await page.goto('./?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  const centers = await page.evaluate(() => {
    const cx = (e: Element): number => { const r = e.getBoundingClientRect(); return r.x + r.width / 2; };
    return { days: [...document.querySelectorAll('[data-day-pill]')].map(cx), kit: [...document.querySelectorAll('[data-kit-card]')].map(cx) };
  });
  expect(centers.days).toHaveLength(7);
  expect(centers.kit).toHaveLength(7);
  centers.days.forEach((x, i) => { expect(Math.abs(x - centers.kit[i]!), `jour ${i + 1}`).toBeLessThanOrEqual(1); });
  await ctx.close();
});
