import { expect, test, type Page } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Panneau d'options dans le runtime VIVANT, au checkpoint [revue T6, constats 11 et 12 ; spec C §3.2] : la ligne de prix et Confirmer
 * suivent l'option DÉSIGNÉE, celle-ci reste visible dans le panneau, plusieurs choix ouverts forment des groupes nommés, le panneau ne couvre pas le bracelet.
 * `T6_SHOTS=<dossier>` écrit des captures de preuve.
 */
const state = (page: Page) => st(page, 'state');
const press = (page: Page, selector: string): Promise<void> => page.locator(selector).evaluate((e) => { (e as HTMLElement).click(); });
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }]) {
  test(`test_live_checkpoint_price_line_follows_the_designated_option_at_${vp.width}x${vp.height}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await openCapture(page, { lang: 'fr', viewport: vp, query: info.project.name === 'webgl2' ? 'webgl' : '' });
    await page.keyboard.down('KeyW');
    try { for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await state(page)).player.z <= -10.0) break; } } finally { await page.keyboard.up('KeyW'); }
    await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
    await settle(page, 1000);

    // à la barrière, seul le choix du lieu est ouvert (playtest 2026-11-03 : un choix s'ouvre à son lieu) ; il est nommé par une action.
    // Plusieurs groupes ouverts ensemble : `street_place_arrival_live_test.ts` (le logement du J1) et le panneau monté (`street_choice_panel_test.ts`).
    const groups = await page.locator('[data-ui="choices"] [role="group"]').evaluateAll((gs) => gs.map((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent ?? ''));
    expect(groups, 'à la barrière : le seul choix du lieu').toEqual(['Te présenter au contrôle']);
    expect(groups.every((n) => n.trim() !== ''), `noms : ${JSON.stringify(groups)}`).toBe(true);
    expect(new Set(groups).size, 'noms distincts').toBe(groups.length);

    // option C : un seul groupe déplié, les autres repliés derrière leur en-tête [spec choix simultanés §3.2, A-2]
    const expanded = await page.locator('[data-ui="choice-name"][aria-expanded]').evaluateAll((hs) => hs.map((h) => h.getAttribute('aria-expanded')));
    expect(expanded.length, 'un groupe seul n\'a pas d\'en-tête à déplier ; sinon un en-tête par groupe').toBe(groups.length > 1 ? groups.length : 0);
    if (groups.length > 1) expect(expanded.filter((v) => v === 'true').length, 'exactement un groupe déplié').toBe(1);
    // le panneau se plafonne hors des bandes 2,39:1 posées par le runtime (observation au checkpoint) [§3.5, A-9]
    const band = await page.locator('[data-ui="root"]').evaluate((r) => parseFloat(r.style.getPropertyValue('--s-letterbox-band-px') || '0'));
    expect(band, 'bande posée par le runtime au checkpoint').toBeGreaterThan(0);
    const useful = await box(page, '[data-ui="choices"]');
    expect(useful.y, 'panneau sous la bande haute').toBeGreaterThanOrEqual(band - 1);
    expect(useful.y + useful.height, 'panneau au-dessus de la bande basse').toBeLessThanOrEqual(vp.height - band + 1);
    const heads = await page.locator('[data-ui="choice-name"]:visible').evaluateAll((hs) => hs.map((h) => Math.round(h.getBoundingClientRect().height)));
    expect(Math.min(...heads), `aucun en-tête n'est comprimé : ${JSON.stringify(heads)}`).toBeGreaterThanOrEqual(44);
    if (process.env['T6_SHOTS'] && vp.width === 1920) await page.screenshot({ path: `${process.env['T6_SHOTS']}/live-groups.png` });

    const panel = await box(page, '[data-ui="choices"]');
    const bracelet = await box(page, '[data-ui="bracelet"]');
    expect(panel.y >= bracelet.y + bracelet.height || panel.x >= bracelet.x + bracelet.width || panel.x + panel.width <= bracelet.x, 'panneau et bracelet disjoints').toBe(true);

    await press(page, '[data-choice="checkpoint.j1"] [data-ui="choice-name"]');   // le joueur déplie le groupe du checkpoint avant d'y désigner
    for (const option of ['comply', 'bypass', 'refuse']) {
      await press(page, `[data-choice="checkpoint.j1"] [data-option="${option}"]`);
      await page.waitForSelector('[data-ui="price"]');
      await settle(page, 500);
      const sel = `[data-choice="checkpoint.j1"] [data-option="${option}"]`;
      const same = await page.locator('[data-ui="price"]').evaluate((p, s) => (p.previousElementSibling === document.querySelector(s) || p.parentElement?.previousElementSibling === document.querySelector(s)), sel);
      expect(same, `${option} : la ligne de prix suit l'option désignée`).toBe(true);
      const b = await box(page, sel); const p = await box(page, '[data-ui="price"]'); const ok = await box(page, '[data-ui="confirm"]');
      const pn = await box(page, '[data-ui="choices"]');
      if (vp.height <= 540) { expect(p.y, `${option} : le haut de la ligne est dans le panneau`).toBeLessThan(pn.y + pn.height); expect(pn.y + pn.height, `${option} : Confirmer sous la ligne`).toBeGreaterThanOrEqual(ok.y + ok.height - 1); }
      expect(p.y, `${option} : la ligne est sous l'option`).toBeGreaterThanOrEqual(b.y + b.height - 20);   // l'option désignée est tournée : sa boîte englobante dépasse de quelques px
      expect(p.y - (b.y + b.height), `${option} : collée à l'option, pas à la fin du choix`).toBeLessThanOrEqual(48);
      // à 960 x 540 (mode petit, arbitrage §6.1) la ligne de prix défile SOUS l'option collée : seuls Confirmer (hors de la zone qui défile) et le haut de la ligne
      // sont garantis dans le panneau ; l'option et le prix entier sont épinglés par l'e2e AR-1 de street_choice_panel_test
      for (const [name, r] of ([['option désignée', b], ['ligne de prix', p], ['Confirmer', ok]] as const).filter(([n]) => vp.height > 760 || n === 'Confirmer')) {
        expect(r.y, `${option} : ${name} sous le haut du panneau`).toBeGreaterThanOrEqual(pn.y - 1);
        expect(r.y + r.height, `${option} : ${name} dans le panneau et l'écran`).toBeLessThanOrEqual(Math.min(pn.y + pn.height, vp.height) + 1);
      }
      if (process.env['T6_SHOTS'] && vp.width === 1920) await page.screenshot({ path: `${process.env['T6_SHOTS']}/live-${option}.png` });
      if (process.env['T6_SHOTS'] && vp.width !== 1920 && option === 'comply') await page.screenshot({ path: `${process.env['T6_SHOTS']}/live-${vp.width}-${option}.png` });
    }
  });
}
