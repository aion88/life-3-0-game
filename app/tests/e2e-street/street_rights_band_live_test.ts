import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Zones d'écran dans le runtime VIVANT au checkpoint (observation : les bandes 2,39:1 existent), en fr, aux trois tailles
 * [design/ui/2026-11-02-zones-ecran-ux.md §1, Z-1, Z-2]. Rien n'est injecté : on mesure ce que le runtime affiche.
 * Le pire cas (tous les droits, fiche, ligne la plus longue, six groupes) est mesuré sur le vrai `mountUi` par `tests/e2e-ui/street_zones_test.ts`.
 * `T9_SHOTS=<dossier>` écrit des captures de preuve.
 */
const MARGIN_REM = (JSON.parse(readFileSync('src/data/ui/zones.json', 'utf8')) as { marginRem: { v: number } }).marginRem.v;
const NAMED = ['day-date', 'bracelet', 'narration', 'card', 'carnet', 'right-line', 'choices', 'controls'] as const;
const SIZES = [{ width: 1920, height: 1080, mode: 'large' }, { width: 1280, height: 720, mode: 'medium' }, { width: 960, height: 540, mode: 'small' }] as const;

for (const vp of SIZES) {
  test(`test_zones_live_checkpoint_inside_useful_frame_${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await openCapture(page, { lang: 'fr', viewport: { width: vp.width, height: vp.height }, query: '' });
    await page.keyboard.down('KeyW');
    try { for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await st(page, 'state')).player.z <= -10.0) break; } } finally { await page.keyboard.up('KeyW'); }
    await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
    await settle(page, 1000);
    const root = page.locator('[data-ui="root"]');
    const band = await root.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue('--s-letterbox-band-px')));
    expect(band, 'les bandes existent en observation').toBeGreaterThan(0);
    expect(await root.getAttribute('data-zone-mode'), 'mode lu sur la largeur de U').toBe(vp.mode);
    const m = MARGIN_REM * await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));   // m de l'UX §1, lu dans le jeton
    const boxes = await page.evaluate((names) => {
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const n of names) {
        const e = document.querySelector<HTMLElement>(`[data-ui="root"] [data-ui="${n}"]`);
        if (e === null || e.closest('[hidden]') !== null || e.checkVisibility?.({ visibilityProperty: true }) === false) continue;
        const r = e.getBoundingClientRect(); if (r.width * r.height === 0) continue;
        out[n] = { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      return out;
    }, NAMED as readonly string[]);
    for (const n of ['day-date', 'bracelet', 'choices']) expect(boxes[n], `${n} visible au checkpoint`).toBeDefined();
    const eps = 0.5;
    for (const [n, b] of Object.entries(boxes)) {
      expect(b.x, `${n} : à m du bord gauche`).toBeGreaterThanOrEqual(m - eps);
      expect(b.x + b.w, `${n} : à m du bord droit`).toBeLessThanOrEqual(vp.width - m + eps);
      expect(b.y, `${n} : sous la bande haute, à m`).toBeGreaterThanOrEqual(band + m - eps);
      const floor = n === 'choices' && vp.mode === 'small' ? 0 : m;   // petit : le panneau descend jusqu'au bas du cadre utile, jamais dans la bande [zones UX §7.3, tranché team-lead 2026-11-03]
      expect(b.y + b.h, `${n} : au-dessus de la bande basse, à ${floor} px`).toBeLessThanOrEqual(vp.height - band - floor + eps);
    }
    const names = Object.keys(boxes);
    for (let a = 0; a < names.length; a++) for (let c = a + 1; c < names.length; c++) {
      const p = boxes[names[a]!]!, q = boxes[names[c]!]!;
      const apart = p.x + p.w <= q.x + eps || q.x + q.w <= p.x + eps || p.y + p.h <= q.y + eps || q.y + q.h <= p.y + eps;
      expect(apart, `${names[a]} et ${names[c]} ne se recouvrent pas`).toBe(true);
    }
    // Z-5 : le carnet ne retient que ce qui ne tient pas — si « + N » est montré, le droit suivant ne tiendrait pas entier
    const carnet = await page.evaluate(() => {
      const c = document.querySelector<HTMLElement>('[data-ui="carnet"]');
      if (c === null || c.dataset['state'] !== 'full') return null;
      const ul = c.querySelector('ul')!; const more = c.querySelector<HTMLElement>('[data-ui="carnet-more"]')!;
      const next = [...ul.querySelectorAll('li')].find((li) => li.hidden);
      if (more.hidden || next === undefined) return { more: false, nextFits: false };
      next.hidden = false; const fits = ul.scrollHeight <= ul.clientHeight + 0.5; next.hidden = true;
      return { more: true, nextFits: fits };
    });
    if (carnet !== null && carnet.more) expect(carnet.nextFits, 'carnet : « + N » seulement quand le droit suivant ne tient pas').toBe(false);
    if (process.env['T9_SHOTS']) await page.screenshot({ path: `${process.env['T9_SHOTS']}/zones-vivant-${vp.width}.png` });
  });
}
