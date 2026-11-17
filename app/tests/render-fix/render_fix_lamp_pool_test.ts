import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCapture, settle, shootPng, st, decodePlate, pngSize } from '../support/street_capture';
import { yPrime } from '../../src/engine/view/caps';

/**
 * Flaque de lumière d'un lampadaire allumé [TV-02a-render] : vue presque verticale entre les deux lampadaires à z = 26.
 * Le sol au pied du lampadaire de l'est doit être plus clair que le sol de la même colonne à mi-chemin des lampadaires suivants (hors de la flaque), la nuit ;
 * le jour (lampes à 0) rien ne doit s'allumer : l'écart y reste sous celui de la nuit.
 */
async function pool(page: import('@playwright/test').Page, light: 'nuit' | 'jour'): Promise<{ under: number; around: number }> {
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  await st(page, 'setLight', light);
  await st(page, 'pose', 'flaque-lampadaire');
  const png = await shootPng(page, 'beauty');
  if (process.env['RENDER_FIX_OUT'] !== undefined) { mkdirSync(process.env['RENDER_FIX_OUT'], { recursive: true }); writeFileSync(`${process.env['RENDER_FIX_OUT']}/flaque_${light}.png`, png); }
  const { width, height } = pngSize(png);
  const { img, crop } = await decodePlate(page, png, width, height);
  const mean = (cx: number, cy: number, r: number): number => {
    let s = 0, n = 0;
    for (let y = Math.max(0, cy - r); y < cy + r; y++) for (let x = cx - r; x < cx + r; x++) { const i = (y * img.width + x) * 4; s += yPrime(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!); n++; }
    return s / n;
  };
  // pied du lampadaire de l'est : x = 5,4 m se projette à 1/8 de la largeur utile à droite du centre (60 m de vue verticale, 24 mm) ; même colonne en haut et en bas = hors flaque
  const cx = Math.round(crop.x + crop.w / 2 + crop.w * 0.125), cy = Math.round(crop.y + crop.h / 2), r = Math.round(crop.h / 16);
  const out = { under: mean(cx, cy, r), around: (mean(cx, Math.round(crop.y + crop.h * 0.07), r) + mean(cx, Math.round(crop.y + crop.h * 0.93), r)) / 2 };
  console.log(light, JSON.stringify(out));
  return out;
}

test('test_lit_lamp_throws_a_pool_on_the_road', async ({ page }) => {
  const night = await pool(page, 'nuit');
  expect(night.under).toBeGreaterThan(night.around * 1.5);
  expect(night.under).toBeLessThanOrEqual(0.45);   // bible §D.1 : 0,45 sous le lampadaire au plus (le sol ne doit pas délaver)
});

test('test_pool_is_a_night_effect_not_a_day_one', async ({ page }) => {
  const day = await pool(page, 'jour');
  const ratio = day.under / day.around;
  expect(ratio).toBeLessThan(1.3);
});
