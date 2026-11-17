import { expect, test } from '@playwright/test';
import { openCapture, settle, shootPng, st, decodePlate, pngSize, PLATES, profileFor } from '../support/street_capture';
import { checkCaps } from '../../src/engine/view/caps';

/**
 * `__street.setWindows(visible)` [TV-02a-render] : cache les fenêtres allumées (« chaud commun », art bible §B.1 : les fenêtres intérieures ne
 * comptent pas comme accent de monde). Le second rendu du checkpoint, fenêtres éteintes, ne garde que le sodium des lampes.
 */
async function accent(page: import('@playwright/test').Page): Promise<number> {
  const plate = PLATES[0]!;
  const dec = async (k: 'beauty' | 'mask' | 'skin') => { const png = await shootPng(page, k); const s = pngSize(png); return decodePlate(page, png, s.width, s.height); };
  const b = await dec('beauty'), m = await dec('mask'), sk = await dec('skin');
  const r = checkCaps(b.img, m.img, b.crop, { ...profileFor(plate.profile), accentMax: 0 }, sk.img);   // plafond 0 : le rapport donne la part mesurée
  return r.findings.find((f) => f.code === 'accent')?.measured ?? 0;
}

test('test_windows_off_removes_their_share_of_the_accent', async ({ page }) => {
  const plate = PLATES[0]!;
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  await st(page, 'setLight', plate.light);
  await st(page, 'pose', plate.pose);
  const on = await accent(page);
  await st(page, 'setWindows', false);
  const off = await accent(page);
  await st(page, 'setWindows', true);
  expect(on - off).toBeGreaterThan(0.01);                    // les fenêtres pèsent plus d'un point (mesuré : 2,57)
  expect(await accent(page)).toBeCloseTo(on, 3);             // les remettre rend l'image d'origine
});
