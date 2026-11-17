import { expect, test } from '@playwright/test';
import { openCapture, settle, shootPng, st, decodePlate, pngSize, PLATES } from '../support/street_capture';
import { maskShare } from '../../src/engine/view/caps';

/**
 * Plaque C (place de jour) [TV-02a-render, design/art/2026-11-02-revision-plafonds-proposition.md] : la place et le ciel doivent se lire, le mur
 * d'écrans occupe au plus un tiers du cadre. Défaut d'origine : mur à la moitié du cadre, nuques coupées, ni place ni ciel (cadrage, pas couleur).
 */
test('test_place_plate_shows_the_place_and_the_sky_with_the_wall_under_a_third', async ({ page }) => {
  const plate = PLATES.find((p) => p.pose === 'place-jour')!;
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  await st(page, 'setLight', plate.light);
  await st(page, 'pose', plate.pose);
  const dec = async (k: 'beauty' | 'screens') => { const png = await shootPng(page, k); const s = pngSize(png); return decodePlate(page, png, s.width, s.height); };
  const beauty = await dec('beauty'), screens = await dec('screens');
  // part du cadre occupée par les ÉCRANS du mur (emprise rectangulaire) : le mur entier (cadre, halo, corps coupés) en occupe bien plus ; l'ancienne pose mesurait 0,33 ici
  // pour un mur à la moitié du cadre à l'œil, d'où un seuil de 0,15 pour tenir le tiers du cadre au plus de l'art-director
  const { img, crop } = screens;
  let x0 = img.width, x1 = -1, y0 = img.height, y1 = -1;
  for (let y = crop.y; y < crop.y + crop.h; y++) for (let x = crop.x; x < crop.x + crop.w; x++) { if (img.data[(y * img.width + x) * 4]! > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  const wall = x1 < 0 ? 0 : ((x1 - x0 + 1) * (y1 - y0 + 1)) / (crop.w * crop.h);
  expect(wall).toBeLessThanOrEqual(0.15);
  expect(maskShare(screens.img, screens.crop)).toBeGreaterThan(0);   // le mur reste dans le cadre (sinon la plaque n'est plus la place du checkpoint)
  // ciel : un bandeau du haut du cadre, au centre, est bleuté (le dôme V2) et non un mur ou un fond noir
  const b = beauty.img;
  let r = 0, bl = 0, n = 0;
  for (let y = beauty.crop.y + 2; y < beauty.crop.y + beauty.crop.h * 0.15; y++) for (let x = Math.round(b.width * 0.5); x < Math.round(b.width * 0.62); x++) { const i = (y * b.width + x) * 4; r += b.data[i]!; bl += b.data[i + 2]!; n++; }
  expect(bl / n, 'le ciel doit être visible en haut du cadre').toBeGreaterThan(r / n + 5);
});
