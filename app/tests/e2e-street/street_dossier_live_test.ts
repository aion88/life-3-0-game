import { expect, test, type Page } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Barre « Dossier » dans le runtime VIVANT, en fr [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03].
 * Large : sous le bracelet, collée et même bord droit ; moyen et petit : à gauche du bracelet, même rangée, pas plus haute que lui ; dans le cadre utile (jamais sur une bande du 2,39:1), disjointe du panneau
 * d'options, sans aucun chiffre. Captures de preuve dans `production/qa/evidence/ui/2026-11-03-dossier/`.
 */
const SHOTS = '../production/qa/evidence/ui/2026-11-03-dossier';
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });

async function toCheckpoint(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await openCapture(page, { lang: 'fr', viewport, query: '' });
  await page.keyboard.down('KeyW');
  try { for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await st(page, 'state')).player.z <= -10.0) break; } } finally { await page.keyboard.up('KeyW'); }
  await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
  await settle(page, 1000);
}

for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }]) {
  test(`test_live_dossier_sits_under_the_bracelet_inside_the_useful_frame_at_${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await toCheckpoint(page, vp);
    const band = await page.locator('[data-ui="root"]').evaluate((r) => parseFloat(getComputedStyle(r).getPropertyValue('--s-letterbox-band-px')) || 0);
    expect(band, 'les bandes sont posées au checkpoint').toBeGreaterThan(0);
    const b = (await page.locator('[data-ui="bracelet"]').boundingBox())!;
    const d = (await page.locator('[data-ui="dossier"]').boundingBox())!;
    const mode = await page.locator('[data-ui="root"]').getAttribute('data-zone-mode');
    if (mode !== 'large') {   // moyen et petit : à gauche du bracelet, même rangée, sans grandir le bandeau haut (AR-13, Z-1, Z-4) [team-lead 2026-11-03]
      expect(d.y + d.height, 'pas plus haute que le bracelet').toBeLessThanOrEqual(b.y + b.height + 0.5);
      expect(Math.abs(d.y - b.y), 'même haut que le bracelet').toBeLessThanOrEqual(1);
      expect(b.x - (d.x + d.width), 'collée à gauche du bracelet').toBeGreaterThanOrEqual(0);
      expect(b.x - (d.x + d.width), 'collée à gauche du bracelet').toBeLessThanOrEqual(16);
      const date = (await page.locator('[data-ui="day-date"]').boundingBox())!;
      expect(d.x, 'à droite de la date').toBeGreaterThanOrEqual(date.x + date.width);
    } else {
      expect(d.y, 'sous le bracelet').toBeGreaterThanOrEqual(b.y + b.height - 0.5);
      expect(d.y - (b.y + b.height), 'collée au bracelet').toBeLessThanOrEqual(16);
      expect(Math.abs(d.x + d.width - (b.x + b.width)), 'même bord droit').toBeLessThanOrEqual(1);
    }
    expect(d.y + d.height, 'au-dessus de la bande basse').toBeLessThanOrEqual(vp.height - band);
    expect(d.x, 'dans la largeur').toBeGreaterThanOrEqual(0);
    expect(d.x + d.width, 'dans la largeur').toBeLessThanOrEqual(vp.width);
    const panel = await page.locator('[data-ui="choices"] ul').boundingBox();
    if (panel !== null) expect(panel.y >= d.y + d.height || panel.x >= d.x + d.width || panel.x + panel.width <= d.x, 'panneau et barre disjoints').toBe(true);
    // le texte ne touche jamais le bord de la pastille
    expect(await page.locator('[data-ui="dossier"]').getAttribute('title'), 'infobulle du gris').toBe('En gris : ce qui sera compté ce soir.');
    const hintShown = mode === 'large';   // grand : la ligne d'aide ; moyen et petit : l'infobulle seule, pour ne pas grandir le bandeau haut
    expect(await page.locator('[data-ui="dossier-hint"]').isVisible()).toBe(hintShown);
    if (hintShown) expect(await page.locator('[data-ui="dossier-hint"]').innerText()).toBe('En gris : ce qui sera compté ce soir.');
    const mark = (await page.locator('[data-ui="dossier-mark"]').boundingBox())!; const aud = (await page.locator('[data-ui="dossier-audition"]').boundingBox())!;
    expect(Math.abs(aud.x + aud.width - (mark.x + mark.width / 2)), '« audition » finit au trait').toBeLessThanOrEqual(1.5);
    for (const sel of ['[data-ui="dossier-name"]', '[data-ui="dossier-audition"]', ...(hintShown ? ['[data-ui="dossier-hint"]'] : [])]) {
      const t = (await page.locator(sel).boundingBox())!;
      expect(t.x - d.x, `${sel} loin du bord gauche`).toBeGreaterThanOrEqual(4);
      expect(d.x + d.width - (t.x + t.width), `${sel} loin du bord droit`).toBeGreaterThanOrEqual(4);
      expect(d.y + d.height - (t.y + t.height), `${sel} loin du bord bas`).toBeGreaterThanOrEqual(2);
    }
    expect(await page.locator('[data-ui="dossier-name"]').innerText()).toBe('Dossier');
    expect(await page.locator('[data-ui="dossier-audition"]').innerText()).toBe('audition');
    expect(await page.locator('[data-ui="dossier"]').innerText(), 'aucun chiffre').not.toMatch(/\d/);
    const fill = await page.locator('[data-ui="dossier-fill"]').evaluate((e) => ({ palier: (e as HTMLElement).dataset['palier'], w: e.getBoundingClientRect().width, track: e.parentElement!.getBoundingClientRect().width }));
    expect(fill.palier).toBe('courtesy');
    expect(fill.w / fill.track).toBeCloseTo(0.6, 1);
    await page.screenshot({ path: `${SHOTS}/checkpoint-${vp.width}.png` });
  });
}

test('test_live_dossier_greys_a_pending_segment_after_a_gesture', async ({ page }) => {
  test.setTimeout(240_000);
  await toCheckpoint(page, { width: 1920, height: 1080 });
  await press(page, '[data-choice="checkpoint.j1"] [data-option="comply"]');
  await page.waitForSelector('[data-ui="price"]');
  await press(page, '[data-ui="confirm"]');
  await st(page, 'step', 100, { render: false });
  await page.waitForTimeout(1800);
  expect(await page.locator('[data-ui="dossier-segment"]').count(), 'au moins un segment en attente').toBeGreaterThan(0);
  expect(await page.locator('[data-ui="dossier"]').innerText(), 'aucun chiffre').not.toMatch(/\d/);
  await page.locator('[data-ui="dossier"]').screenshot({ path: `${SHOTS}/barre-apres-geste.png` });
  await page.screenshot({ path: `${SHOTS}/apres-geste-1920.png` });
});
