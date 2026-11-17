import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';
import { CONTENT_HASH, SAVE_KEY, continueIfAsked } from '../support/e2e';

/**
 * Carte du questionnaire avec les vrais textes, pire cas : rien d'utile n'est coupé [retour de Cynthia, 2026-11-03 ; preuve
 * `production/qa/evidence/ui/2026-11-03-questionnaire/`]. Le haut (pastille, date, titre) et le bas (coût, Continuer, points, consigne) restent dans
 * la carte, à distance de son bord ; seules la scène et les options défilent, et un indicateur dit qu'il reste du texte plus bas.
 * Q21 porte la scène la plus longue et le coût le plus long, Q04 les libellés les plus longs ; tous deux ont quatre réponses.
 */
const questions = (JSON.parse(readFileSync('src/data/questionnaire.json', 'utf8')) as { questions: { key: string; order: number }[] }).questions
  .slice().sort((a, b) => a.order - b.order);

let server: PreviewServer;
let url = '';
test.beforeAll(async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'q-fit-'));
  await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  server = await preview({ logLevel: 'silent', build: { outDir }, preview: { port: 4288, strictPort: true } });
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { if (server) await new Promise<void>((r) => server.httpServer.close(() => r())); });

/** Ouvre la question `key` : les précédentes sont répondues dans la sauvegarde (phase `questionnaire`). */
async function openQuestion(page: Page, key: string, lang: 'fr' | 'en'): Promise<void> {
  const idx = questions.findIndex((q) => q.key === key);
  const answers = Object.fromEntries(questions.slice(0, idx).map((q) => [q.key, 'A']));
  await page.goto(url);
  await page.evaluate(([k, v]) => { localStorage.setItem(k!, v!); }, [SAVE_KEY, JSON.stringify({ v: 1, rev: 3, contentHash: CONTENT_HASH, lang, softened: false, phase: 'questionnaire', answers, acts: [] })]);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  await page.waitForSelector('[data-option]');
}

/**
 * Pour chaque sélecteur présent et non vide : sa boîte est dans la carte avec au moins le rembourrage de la carte de marge, et un clic en son centre
 * l'atteint (rien ne la recouvre, aucun bord ne la tranche). Renvoie la liste des fautes, vide si tout va.
 */
function faults(page: Page, selectors: readonly string[]): Promise<string[]> {
  return page.evaluate((sels) => {
    const card = document.querySelector('.c-q-card')!;
    const c = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const pad = Math.min(...[cs.paddingTop, cs.paddingBottom, cs.paddingLeft, cs.paddingRight].map(parseFloat)) - 0.5;
    const out: string[] = [];
    for (const sel of sels) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || el.hidden || (el.textContent ?? '').trim() === '' && el.children.length === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.top < c.top + pad || r.bottom > c.bottom - pad || r.left < c.left + pad || r.right > c.right - pad) {
        out.push(`${sel} hors de la carte ou collé au bord (élément ${r.top | 0}-${r.bottom | 0}, carte ${c.top | 0}-${c.bottom | 0}, marge ${pad})`);
        continue;
      }
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!hit || !(el.contains(hit) || hit.contains(el))) out.push(`${sel} recouvert ou tranché (le centre touche ${hit?.className ?? 'rien'})`);
    }
    return out;
  }, selectors);
}

const FIXED = ['[data-testid="q-date"]', '.c-q-title', '.c-dot-row', '.c-q-hint'] as const;
const ACT = ['[data-testid="q-cost"]', '[data-testid="q-continue"]'] as const;

/** fit.ts deliberately permits letterbox bleed to preserve readable text; the card must stay within its available frame. */
async function cardWithinAvailableFrame(page: Page): Promise<void> {
  const m = await page.evaluate(() => ({
    c: document.querySelector('.c-q-card')!.getBoundingClientRect().toJSON() as DOMRect,
    t: document.querySelector('.c-q')!.getBoundingClientRect().top,
    b: document.querySelector('.c-q')!.getBoundingClientRect().bottom,
  }));
  expect(m.c.top).toBeGreaterThanOrEqual(m.t - 0.5);
  expect(m.c.bottom).toBeLessThanOrEqual(m.b + 0.5);
}

/**
 * S'il reste du texte plus bas, l'indicateur est visible ; arrivé en bas de la zone qui défile, il disparaît et le bas de la dernière option est
 * dans la zone. « Entière » n'est pas exigé : à 960 x 540 confirmée, la zone mesure une ligne (les jetons de taille ne bougent pas, décision de Cynthia).
 */
async function scrollIndicatorTells(page: Page): Promise<void> {
  const body = page.locator('.c-q-body');
  const more = page.getByTestId('q-more');
  await body.evaluate(b => { b.scrollTop = 0; });
  const overflowing = await body.evaluate((b) => b.scrollHeight > b.clientHeight + 0.5);
  if (!overflowing) { await expect(more).toBeHidden(); return; }
  await expect(more).toBeVisible();
  await body.evaluate((b) => { b.scrollTop = b.scrollHeight; });
  await expect(more).toBeHidden();
  const lastReached = await body.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const last = [...b.querySelectorAll('[data-option]')].at(-1)!.getBoundingClientRect();
    return last.bottom <= r.bottom + 0.5 && last.bottom > r.top;
  });
  expect(lastReached, 'en bas de la zone, le bas de la dernière option est visible').toBe(true);
  await body.evaluate((b) => { b.scrollTop = 0; });
}

const CASES = [['Q21', 'fr'], ['Q04', 'fr'], ['Q21', 'en']] as const;
for (const [w, h] of [[1920, 1080], [1440, 900], [960, 540], [390, 844]] as const) {
  for (const [key, lang] of CASES) {
    test(`test_q_card_worst_case_${key}_${lang}_${w}x${h}_nothing_cut`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openQuestion(page, key, lang);

      expect(await faults(page, FIXED), 'au repos').toEqual([]);
      await cardWithinAvailableFrame(page);
      await scrollIndicatorTells(page);

      const option = page.locator('[data-option]').last();
      await option.click();
      expect(await faults(page, FIXED), 'désignée').toEqual([]);

      await expect(page.getByTestId('q-cost')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await faults(page, [...FIXED, ...ACT]), 'confirmée, coût affiché').toEqual([]);
      await cardWithinAvailableFrame(page);
      await scrollIndicatorTells(page);
    });
  }
}
