import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCapture, settle, shootPng, st, decodePlate, pngSize } from '../support/street_capture';

/**
 * Captures EN JEU de la caméra joueur [TV-02a-render] : marche (caméra 16:9 de la rue, pas de pose de plaque), puis file d'attente
 * (mode observation, atteint en marchant vers le mur). Sortie : `RENDER_FIX_OUT`, un PNG par mode.
 */

/** Luminance Y' moyenne et part des pixels sous 0,03 dans le cadre utile 2,39 (hors bandes noires). */
async function darkness(page: Page, png: Buffer): Promise<{ mean: number; dark: number }> {
  const sz = pngSize(png);
  const { img, crop } = await decodePlate(page, png, sz.width, sz.height);
  let sum = 0, dark = 0, n = 0;
  for (let y = crop.y; y < crop.y + crop.h; y++) for (let x = crop.x; x < crop.x + crop.w; x++) {
    const i = (y * img.width + x) * 4; const l = (0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]!) / 255;
    sum += l; if (l < 0.03) dark++; n++;
  }
  return { mean: sum / n, dark: dark / n };
}
const OUT = process.env['RENDER_FIX_OUT'] ?? '../production/qa/evidence/street/2026-11-02/render-fix/tmp';
test('render-fix: caméra joueur, marche puis file', async ({ page }, info) => {
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  const marche = await shootPng(page, 'beauty');
  writeFileSync(`${dir}/ingame_marche.png`, marche);
  // « il fait trop noir » (Cynthia, 2026-11-03) : la rue doit se lire (avant : moyenne 0,19, après réglage 0,29)
  expect((await darkness(page, marche)).mean, 'rue en marche trop sombre').toBeGreaterThanOrEqual(0.26);
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })); });
  let mode = (await st(page, 'state')).mode;
  for (let i = 0; i < 80 && mode !== 'observation'; i++) { await st(page, 'step', 1000, { render: false }); mode = (await st(page, 'state')).mode; }
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })); });
  info.annotations.push({ type: 'mode', description: `${mode} z=${(await st(page, 'state')).player.z}` });
  await settle(page);
  const file = await shootPng(page, 'beauty');
  writeFileSync(`${dir}/ingame_file.png`, file);
  const d = await darkness(page, file);   // file d'attente : mur d'immeuble et personnages lisibles (avant : 0,114 et 23 % sous 0,03)
  expect(d.mean, 'file trop sombre').toBeGreaterThanOrEqual(0.18);
  expect(d.dark, 'part de pixels noirs').toBeLessThanOrEqual(0.2);
});
