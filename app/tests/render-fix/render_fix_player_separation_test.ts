import { expect, test } from '@playwright/test';
import { openCapture, settle, shootPng, st, decodePlate, pngSize } from '../support/street_capture';

// Séparation joueur / mur d'écrans au front de la file (TV-02a-render, 2026-11-02) : le voile de bloom des écrans noyait le joueur bleu (rapport de luminance 1,59).
// Mesure : luminance Y' moyenne d'un carré de torse du joueur contre un carré d'écran pâle voisin, cadre 2,39 utile ; régions en fractions du cadre.
test('test_player_separates_from_pale_screens', async ({ page }) => {
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  await st(page, 'setLight', 'heureBleue');
  await st(page, 'pose', 'joueur-checkpoint');
  const png = await shootPng(page, 'beauty'); const s = pngSize(png);
  const { img, crop } = await decodePlate(page, png, s.width, s.height);
  const lum = (fx0: number, fx1: number, fy0: number, fy1: number): number => {
    let sum = 0, n = 0;
    for (let y = Math.round(crop.y + fy0 * crop.h); y < crop.y + fy1 * crop.h; y++) for (let x = Math.round(crop.x + fx0 * crop.w); x < crop.x + fx1 * crop.w; x++) {
      const i = (y * img.width + x) * 4; sum += (0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]!) / 255; n++;
    }
    return sum / n;
  };
  const body = lum(0.432, 0.479, 0.600, 0.749), wall = lum(0.503, 0.542, 0.525, 0.699);
  expect(wall / body, 'le joueur doit se détacher des écrans pâles (avant : 1,59)').toBeGreaterThanOrEqual(1.9);
});
