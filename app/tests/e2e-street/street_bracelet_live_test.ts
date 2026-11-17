import { expect, test, type Page } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Bracelet, Œil, décompte dans le runtime VIVANT, au checkpoint [plan UI-C T7 ; spec C §3.2, §4].
 * Le bracelet atteint la taille de la spec (Œil 96 px, nombre 96 px), un refus descend à plat, une option qui coûte des mots joue pièces et confettis.
 * `T7_SHOTS=<dossier>` écrit des captures de preuve.
 */
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });
const shot = async (page: Page, name: string): Promise<void> => { if (process.env['T7_SHOTS']) await page.screenshot({ path: `${process.env['T7_SHOTS']}/${name}.png` }); };
const value = (page: Page): Promise<string> => page.locator('[data-ui="bracelet-value"]').innerText();

async function toCheckpoint(page: Page, reduced: boolean, viewport = { width: 1920, height: 1080 }): Promise<void> {
  await openCapture(page, { lang: 'fr', viewport, query: '' });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.down('KeyW');
  try { for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await st(page, 'state')).player.z <= -10.0) break; } } finally { await page.keyboard.up('KeyW'); }
  await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
  await settle(page, 1000);
}

test('test_live_bracelet_has_the_spec_size_and_one_fixed_eye', async ({ page }) => {
  test.setTimeout(240_000);
  await toCheckpoint(page, false);
  const eye = (await page.locator('[data-ui="bracelet"] .c-eye').boundingBox())!;
  const num = await page.locator('[data-ui="bracelet-value"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const box = (await page.locator('[data-ui="bracelet"]').boundingBox())!;
  expect(Math.round(eye.width)).toBe(64);   // Cynthia playtest 2026-11-03 : compteur réduit (96 avant)
  expect(num).toBe(64);
  expect(box.width).toBeGreaterThan(200);
  expect(await page.locator('[data-ui="bracelet-unit"]').innerText()).toBe('mots');
  await shot(page, 'bracelet-repos');
});

for (const option of ['refuse', 'comply']) {
  test(`test_live_confirm_${option}_counts_down_with_the_right_juice`, async ({ page }) => {
    test.setTimeout(240_000);
    await toCheckpoint(page, false);
    const before = Number(await value(page));
    await press(page, `[data-choice="checkpoint.j1"] [data-option="${option}"]`);
    await page.waitForSelector('[data-ui="price"]');
    await press(page, '[data-ui="confirm"]');
    await page.mouse.click(960, 300);                          // le choix se joue d'abord (séquence jouée) : un clic la passe, l'acte et son jus suivent
    await st(page, 'step', 100, { render: false });
    await page.waitForTimeout(220);
    await shot(page, `fete-${option}-milieu`);
    const coins = await page.locator('.c-coin').count();
    await page.waitForTimeout(1600);
    await shot(page, `fete-${option}-fin`);
    const after = Number(await value(page));
    // au checkpoint le refus ne coûte aucun mot (60 → 60) : il ne lance aucune pièce ; la courtoisie coûte des mots et en lance
    if (option === 'refuse') { expect(after, 'le refus du checkpoint ne coûte aucun mot').toBe(before); expect(coins, 'un refus ne lance aucune pièce').toBe(0); }
    else { expect(after, 'le nombre a baissé du prix').toBeLessThan(before); expect(coins, 'une option non refus lance des pièces').toBeGreaterThan(0); }
  });
}

/** Z-2 [design/ui/2026-11-02-zones-ecran-ux.md] : le bracelet tient dans le cadre utile, jamais sur une bande noire du 2,39:1, aux trois tailles. */
for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }]) {
  test(`test_live_bracelet_sits_inside_the_useful_frame_at_${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await toCheckpoint(page, false, vp);
    const band = await page.locator('[data-ui="root"]').evaluate((r) => parseFloat(getComputedStyle(r).getPropertyValue('--s-letterbox-band-px')) || 0);
    expect(band, 'les bandes sont posées au checkpoint').toBeGreaterThan(0);
    const b = (await page.locator('[data-ui="bracelet"]').boundingBox())!;
    expect(b.y, 'sous la bande haute').toBeGreaterThanOrEqual(band);
    expect(b.y + b.height, 'au-dessus de la bande basse').toBeLessThanOrEqual(vp.height - band);
    expect(b.x + b.width, 'dans la largeur').toBeLessThanOrEqual(vp.width);
    const panel = await page.locator('[data-ui="choices"]').boundingBox();
    if (panel !== null) expect(panel.y >= b.y + b.height || panel.x >= b.x + b.width || panel.x + panel.width <= b.x, 'panneau et bracelet disjoints').toBe(true);
    await shot(page, `bracelet-cadre-${vp.width}`);
  });
}
