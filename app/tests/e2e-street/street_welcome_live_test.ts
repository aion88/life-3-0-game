import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openCapture, settle, st } from '../support/street_capture';
import type { SeedActs } from '../support/e2e';

/**
 * Accueil du J1 et ligne d'objectif dans la rue VIVANTE, en français [design/gdd/2026-11-03-playtest-enjeu-onboarding.md §1 A, §3 A].
 * L'accueil se rejoue ligne à ligne (l'objet de la ligne s'allume, le téléphone vibre à l'appel), se passe d'un clic, gèle l'horloge tant
 * qu'il est ouvert ; la ligne d'objectif tient ensuite dans le cadre utile aux trois tailles, au logement comme dans la file (bandes 2,39:1).
 * Captures de preuve : `production/qa/evidence/ui/2026-11-03-accueil/`.
 */
const EVIDENCE = '../production/qa/evidence/ui/2026-11-03-accueil';
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });
const shot = async (page: Page, name: string): Promise<void> => { mkdirSync(EVIDENCE, { recursive: true }); await page.screenshot({ path: `${EVIDENCE}/${name}.png` }); };
const minute = async (page: Page): Promise<number> => (await st(page, 'state')).live.clock.minute;
const SIZES = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }];
const LINES = 7;

/** La boîte de l'objectif est dans le cadre utile, et son texte est en retrait du bord de la carte (jamais collé). */
async function expectObjectiveInFrame(page: Page, vp: { width: number; height: number }, label: string): Promise<void> {
  const band = await page.locator('[data-ui="root"]').evaluate((r) => parseFloat(getComputedStyle(r).getPropertyValue('--s-letterbox-band-px')) || 0);
  const o = (await page.locator('[data-ui="objective"]').boundingBox())!;
  expect(o, `${label} : objectif affiché`).not.toBeNull();
  expect(o.y, `${label} : sous la bande haute`).toBeGreaterThanOrEqual(band);
  expect(o.y + o.height, `${label} : au-dessus de la bande basse`).toBeLessThanOrEqual(vp.height - band);
  expect(o.x, `${label} : pas collé au bord gauche`).toBeGreaterThan(0);
  expect(o.x + o.width, `${label} : dans la largeur`).toBeLessThan(vp.width);
  const inset = await page.locator('[data-ui="objective"]').evaluate((el) => {
    const r = el.getBoundingClientRect(); const t = el.querySelector('.c-window')!.getBoundingClientRect();   // la fenêtre de texte, qui défile dans le remplissage
    return Math.min(t.left - r.left, r.right - t.right, r.bottom - t.bottom);
  });
  expect(inset, `${label} : le texte reste dans le remplissage`).toBeGreaterThanOrEqual(8);
  const shown = await page.locator('[data-ui="objective"] .c-window').evaluate((w) => w.clientHeight / parseFloat(getComputedStyle(w).lineHeight));
  expect(shown, `${label} : au moins deux lignes de texte visibles`).toBeGreaterThanOrEqual(1.95);
  // rien d'autre ne le recouvre : le centre de la carte touche la carte
  const hit = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e?.closest('[data-ui="objective"]') !== null; }, { x: o.x + o.width / 2, y: o.y + o.height / 2 });
  expect(hit, `${label} : non recouvert`).toBe(true);
}

test('test_live_welcome_plays_every_line_lights_each_object_and_freezes_the_clock', async ({ page }) => {
  test.setTimeout(240_000);
  await openCapture(page, { lang: 'fr', acts: [], query: '' });
  await settle(page, 0);
  await expect(page.locator('[data-ui="welcome"]')).toHaveCount(1);
  expect(await page.locator('[data-kit="phone"]').getAttribute('data-vibrate'), 'le téléphone vibre à l\'appel').toBe('true');
  await expect(page.locator('[data-ui="objective"]')).toHaveCount(0);
  const m0 = await minute(page);
  const lit: (string | null)[] = [];
  for (let i = 0; i < LINES; i++) {
    lit.push(await page.locator('[data-kit][data-lit="true"]').evaluateAll((es) => (es[0] as HTMLElement | undefined)?.dataset['kit'] ?? null));
    await st(page, 'step', 3000);                                          // 3 s de lecture par ligne
    await shot(page, `accueil-${String(i + 1).padStart(2, '0')}-1920`);
    await press(page, '[data-ui="welcome-next"]');
  }
  expect(lit).toEqual(['phone', 'bracelet', 'sectorCard', 'phone', 'permitBook', 'component', null]);
  expect(await minute(page), 'l\'horloge attend la fin de l\'accueil').toBe(m0);
  await expect(page.locator('[data-kit="phone"]')).toHaveCount(0);
  await st(page, 'step', 12_000, { render: false });                       // 12 s réelles : une heure de jeu
  expect(await minute(page)).toBe(m0 + 60);
  await st(page, 'step', 0);
  await expect(page.locator('[data-ui="objective"]')).toContainText(/Registre avant 12\s+h/);
});

for (const vp of SIZES) {
  test(`test_live_welcome_skips_in_one_click_and_objective_sits_in_the_useful_frame_at_${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await openCapture(page, { lang: 'fr', acts: [], query: '', viewport: vp });
    await settle(page, 0);
    await shot(page, `accueil-01-${vp.width}`);
    await press(page, '[data-ui="welcome-skip"]');
    await st(page, 'step', 0);
    await expect(page.locator('[data-ui="welcome-skip"]'), 'l\'accueil du J1 est fermé d\'un clic').toHaveCount(0);
    await expect(page.locator('[data-kit="phone"]')).toHaveCount(0);   // reste au plus la ligne de la lettre, qui entre dans le kit le J1
    await expectObjectiveInFrame(page, vp, `logement ${vp.width}`);
    await shot(page, `objectif-logement-${vp.width}`);
    // dans la file du checkpoint : bandes 2,39:1 posées, l'objectif reste entre elles
    for (const [choice, option] of [['j1.phone', 'take'], ['j1.component', 'leave']] as const) {
      await press(page, `[data-choice="${choice}"] [data-option="${option}"]`); await press(page, '[data-ui="confirm"]'); await st(page, 'step', 0);
    }
    await page.keyboard.down('KeyW');
    try { for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await st(page, 'state')).player.z <= -10.0) break; } } finally { await page.keyboard.up('KeyW'); }
    await settle(page, 1000);
    await expectObjectiveInFrame(page, vp, `file ${vp.width}`);
    if (await page.locator('[data-ui="welcome"]').count() > 0) {                 // la ligne de la lettre, si elle passe ici : boutons dans le cadre utile
      const band = await page.locator('[data-ui="root"]').evaluate((r) => parseFloat(getComputedStyle(r).getPropertyValue('--s-letterbox-band-px')) || 0);
      for (const sel of ['[data-ui="welcome-line"]', '[data-ui="welcome-next"]']) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(b.y, `${sel} sous la bande haute`).toBeGreaterThanOrEqual(band); expect(b.y + b.height, `${sel} au-dessus de la bande basse`).toBeLessThanOrEqual(vp.height - band);
      }
    }
    await shot(page, `objectif-file-${vp.width}`);
  });
}

/** Le relevé du soir devient une scène : titre, six lignes, ligne du narrateur, dans le cadre utile [§3 A]. Le J3 de `full-week.json`. */
test('test_live_evening_is_a_scene_with_title_and_narrator_line', async ({ page }) => {
  test.setTimeout(240_000);
  const week = JSON.parse(readFileSync('tests/e2e-street/full-week.json', 'utf8')) as SeedActs[];
  const fr = JSON.parse(readFileSync('src/data/strings/fr.json', 'utf8')) as Record<string, string>;
  const eveningMinute = (JSON.parse(readFileSync('src/data/worlds/w10.json', 'utf8')) as { street: { moments: { eveningMinute: number } } }).street.moments.eveningMinute;
  const vp = { width: 1920, height: 1080 };
  await openCapture(page, { lang: 'fr', viewport: vp, query: '', acts: week.slice(0, week.findIndex((a) => a.day === 3 && a.kind === 'sleep')) });
  while ((await minute(page)) < eveningMinute) await st(page, 'step', 6000, { render: false });
  await settle(page, 500);
  await expect(page.locator('[data-ui="evening-title"]')).toHaveText(fr['w10.evening.scene.title']!);
  await expect(page.locator('[data-ui="evening-scene"] [data-ui="evening"] li')).toHaveCount(6);
  await expect(page.locator('[data-ui="evening-narration"]')).toHaveText(fr['w10.evening.scene.thanks']!);
  const s = (await page.locator('[data-ui="evening-scene"]').boundingBox())!;
  expect(s.y + s.height, 'la scène tient dans la hauteur').toBeLessThanOrEqual(vp.height);
  await page.waitForTimeout(600);
  await shot(page, 'soir-scene-j3-1920');
});
