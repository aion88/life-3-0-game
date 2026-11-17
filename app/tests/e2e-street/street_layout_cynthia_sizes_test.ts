import { expect, test, type Page } from '@playwright/test';
import { lineWith, playGuided } from '../support/guided_e2e';
import { advance, installClock, seedSave, seedJson, continueIfAsked } from '../support/e2e';
import { readFileSync } from 'node:fs';

/**
 * Retours de Cynthia du 2026-11-08 : la mise en page tient dans les fenêtres RÉELLES d'un Chrome de Mac (barre d'onglets et d'adresse retirées),
 * pas seulement en 16:9 pur. Les questions d'entrée se lisent en entier sans défiler, à chaque question, avant et après la confirmation (la ligne de coût
 * s'ajoute). Mesure par boîtes, jamais par capture.
 */
test.use({ locale: 'fr-FR' });
test.setTimeout(300_000);

/** Fenêtres de Cynthia (viewport utile d'un Chrome de Mac) puis les anciennes tailles 16:9. */
export const REAL_SIZES = [
  { width: 1440, height: 780 }, { width: 1512, height: 860 }, { width: 1366, height: 660 }, { width: 1280, height: 650 }, { width: 1024, height: 600 },
  { width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 },
] as const;

const timing = JSON.parse(readFileSync('src/data/ui/timing.json', 'utf8')) as { minReadMs: number; costDelayMs: number };

interface Fit { readonly size: string; readonly bodyOverflow: number; readonly cardOverflow: number; readonly inside: boolean; readonly box: string }

/** Ce que la carte du questionnaire coûte en défilement et si elle sort de la fenêtre. */
async function measureCard(page: Page, size: { width: number; height: number }): Promise<Fit> {
  await page.setViewportSize(size);
  await page.waitForTimeout(150);
  return page.evaluate((s) => {
    const card = document.querySelector('.c-q-card') as HTMLElement;
    const body = document.querySelector('.c-q-body') as HTMLElement;
    const r = card.getBoundingClientRect();
    return {
      size: `${s.width}x${s.height}`, bodyOverflow: body.scrollHeight - body.clientHeight, cardOverflow: card.scrollHeight - card.clientHeight,
      inside: r.top >= -0.5 && r.left >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5,
      box: `${Math.round(r.top)}..${Math.round(r.bottom)} / ${window.innerHeight}`,
    };
  }, size);
}

for (const lang of ['fr', 'en'] as const) test(`test_questionnaire_fits_without_scroll_at_real_chrome_sizes_${lang}`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installClock(page);
  await seedSave(page, seedJson({ lang, phase: 'questionnaire' }));
  await page.goto('./');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  const bad: string[] = [];
  for (let q = 0; q < 11; q++) {
    await expect(page.locator('.c-q-card')).toBeVisible();
    const check = async (phase: string): Promise<void> => {
      for (const sz of REAL_SIZES) {
        const f = await measureCard(page, sz);
        if (f.bodyOverflow > 1 || f.cardOverflow > 1 || !f.inside) bad.push(`Q${q + 1} ${phase} ${f.size} : corps +${f.bodyOverflow}, carte +${f.cardOverflow}, dedans=${String(f.inside)} (${f.box})`);
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    };
    await check('ouverte');
    const option = page.locator('[data-option]').first();
    await option.click();
    await option.click();
    await advance(page, timing.minReadMs + timing.costDelayMs + 200);
    await check('confirmée');
    await page.getByTestId('q-continue').click();
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

/** Chemin nommé jusqu'à l'audition (trois noms) : l'issue s'ouvre, comme dans `street_guided_week_test`. */
const NAMED = { 'j3.marlene': 'name', 'j3.who': 'nadia', 'j4.neighbour': 'name', 'j4.who': 'fille', 'j5.bruno': 'name', 'j5.who': 'marlene', 'audition.j7': 'all' };
const SMALL = { width: 640, height: 360 };   // le parcours n'éprouve pas le rendu : une petite fenêtre, le WebGL logiciel est lent

/** La boîte `selector` tient-elle ENTIÈRE dans la fenêtre ? Rend la phrase du défaut, `null` si elle tient. */
async function boxProblem(page: Page, selector: string, sz: { width: number; height: number }): Promise<string | null> {
  await page.setViewportSize(sz);
  await page.waitForTimeout(400);   // la mise en page de la rue se remesure à la fenêtre
  const m = await page.evaluate((sel) => {
    const box = document.querySelector(sel) as HTMLElement | null;
    if (box === null) return null;
    const r = box.getBoundingClientRect();
    // les parties qui doivent rester visibles (le relevé, son bouton de fin de semaine, la ligne du narrateur, le bouton de l'issue) tiennent elles aussi :
    // une boîte rognée par un parent perdrait le bouton sans que la boîte le dise
    const last = [...box.querySelectorAll('[data-ui="recap"], [data-ui="recap-week"], [data-ui="evening-narration"], [data-ui="outcome-continue"]')].map((e) => e.getBoundingClientRect().bottom).reduce((a, b) => Math.max(a, b), 0);
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), last: Math.round(last), scroll: box.scrollHeight - box.clientHeight, vh: window.innerHeight, vw: window.innerWidth };
  }, selector);
  if (m === null) return `${sz.width}x${sz.height} : ${selector} absent`;
  const ok = m.top >= 0 && m.bottom <= m.vh && m.left >= 0 && m.right <= m.vw && m.last <= m.vh;
  return ok ? null : `${sz.width}x${sz.height} : ${selector} de ${m.top} à ${m.bottom} pour ${m.vh} de haut, dernière partie à ${m.last}`;
}

test('test_outcome_and_recap_fit_the_window_at_real_chrome_sizes', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize(SMALL);
  await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: lineWith({ Q11: 'C', Q04: 'A', Q05: 'C', Q16: 'B' }) }));
  await page.goto('/?episode=semaine');
  await page.waitForSelector('html[data-ready="1"]');
  await continueIfAsked(page);
  const bad: string[] = [];
  const seen = new Set<string>();
  /** Mesure une fois par relevé (par jour) puis rend la fenêtre au parcours. */
  const measure = async (name: string, selector: string): Promise<void> => {
    if (seen.has(name)) return;
    seen.add(name);
    for (const sz of REAL_SIZES) {
      const p = await boxProblem(page, selector, sz);
      if (p !== null) bad.push(`${name} ${p}`);
      if (process.env['SHOT_DIR'] !== undefined && sz.width === 1280 && sz.height === 650) await page.screenshot({ path: `${process.env['SHOT_DIR']}/${name.replace(/ /g, '_')}.png` });   // pour l'oeil, hors preuve
    }
    await page.setViewportSize(SMALL);
  };
  await playGuided(page, NAMED, { through: 7, onBeat: async (_beat, _scene, st) => {
    if (await page.locator('[data-ui="recap"]').count() > 0) await measure(`relevé du J${st.day}`, '[data-ui="evening-scene"]');
  } });
  await expect(page.locator('[data-ui="outcome"]')).toBeVisible();
  await measure('issue', '[data-ui="outcome"]');
  await page.locator('[data-ui="outcome"] button').click();
  await expect(page.locator('[data-ui="recap"]')).toBeVisible();
  await measure('relevé du dernier soir', '[data-ui="evening-scene"]');
  expect(seen.size, `relevés mesurés : ${[...seen].join(', ')}`).toBeGreaterThanOrEqual(3);
  expect(bad, bad.join('\n')).toEqual([]);
});
