import { expect, test } from '@playwright/test';
import { yPrime } from '../../src/engine/view/caps';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCapture, settle, shootPng, st, decodePlate, pngSize } from '../support/street_capture';

/**
 * Mesure du dôme de ciel [TV-02a-render] : moyenne sRGB d'un carré de 48 px au centre du cadre pour trois visées (1,5°, 15°, 88° d'élévation, soit
 * l'horizon, le milieu et le zénith du dégradé) dans chacun des trois états. Sortie : `RENDER_FIX_OUT/sky_samples.json`, lu par le script de calage.
 */
const OUT = process.env['RENDER_FIX_OUT'] ?? '../production/qa/evidence/street/2026-11-02/render-fix/tmp';
test('render-fix: ciel, échantillons des trois arrêts', async ({ page }, info) => {
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  const out: Record<string, Record<string, [number, number, number]>> = {};
  for (const light of ['jour', 'heureBleue', 'nuit'] as const) {
    out[light] = {};
    await st(page, 'setLight', light);
    for (const pose of ['ciel-horizon', 'ciel-milieu', 'ciel-zenith']) {
      await st(page, 'pose', pose);
      const png = await shootPng(page, 'beauty');
      const { width, height } = pngSize(png);
      const { img, crop } = await decodePlate(page, png, width, height);
      const cx = Math.round(crop.x + crop.w / 2), cy = Math.round(crop.y + crop.h / 2);
      const sum = [0, 0, 0]; let n = 0;
      for (let y = cy - 24; y < cy + 24; y++) for (let x = cx - 24; x < cx + 24; x++) { const i = (y * img.width + x) * 4; sum[0]! += img.data[i]!; sum[1]! += img.data[i + 1]!; sum[2]! += img.data[i + 2]!; n++; }
      out[light]![pose] = [sum[0]! / n, sum[1]! / n, sum[2]! / n];
    }
  }
  mkdirSync(`${OUT}/${info.project.name}`, { recursive: true });
  writeFileSync(`${OUT}/${info.project.name}/sky_samples.json`, JSON.stringify(out, null, 1));
});

/** Cibles de sortie de la spec (ciel-jour-spec §7) : le dôme doit les atteindre à 6 niveaux près par canal, et le dégradé doit se lire en niveaux de gris. */
const TARGETS: Record<string, Record<string, readonly [number, number, number]>> = {
  jour: { 'ciel-horizon': [0xD9, 0xDE, 0xE2], 'ciel-milieu': [0xA9, 0xC0, 0xDA], 'ciel-zenith': [0x6F, 0x93, 0xC4] },
  heureBleue: { 'ciel-horizon': [0x6E, 0x77, 0x81], 'ciel-milieu': [0x58, 0x65, 0x73], 'ciel-zenith': [0x40, 0x4B, 0x58] },
  nuit: { 'ciel-horizon': [0x13, 0x19, 0x26], 'ciel-milieu': [0x0F, 0x15, 0x20], 'ciel-zenith': [0x0B, 0x0F, 0x17] },
};
test('test_sky_dome_reaches_the_output_targets_and_is_not_a_flat_colour', async ({ page }) => {
  await openCapture(page, { lang: 'fr' });
  await settle(page);
  for (const light of ['jour', 'heureBleue'] as const) {
    await st(page, 'setLight', light);
    const got: Record<string, readonly number[]> = {};
    for (const pose of ['ciel-horizon', 'ciel-milieu', 'ciel-zenith']) {
      await st(page, 'pose', pose);
      const png = await shootPng(page, 'beauty');
      const { width, height } = pngSize(png);
      const { img, crop } = await decodePlate(page, png, width, height);
      const cx = Math.round(crop.x + crop.w / 2), cy = Math.round(crop.y + crop.h / 2);
      const sum = [0, 0, 0]; let n = 0;
      for (let y = cy - 24; y < cy + 24; y++) for (let x = cx - 24; x < cx + 24; x++) { const i = (y * img.width + x) * 4; for (let c = 0; c < 3; c++) sum[c]! += img.data[i + c]!; n++; }
      got[pose] = sum.map((v) => v / n);
      TARGETS[light]![pose]!.forEach((t, c) => { expect(Math.abs(got[pose]![c]! - t), `${light} ${pose} canal ${c}`).toBeLessThanOrEqual(6); });
      if (pose === 'ciel-zenith') {   // pas de bloom sur le ciel : le masque émissif est noir sur le ciel
        const mask = await decodePlate(page, await shootPng(page, 'mask'), width, height);
        const i = (cy * mask.img.width + cx) * 4;
        expect(yPrime(mask.img.data[i]!, mask.img.data[i + 1]!, mask.img.data[i + 2]!)).toBeLessThan(0.01);
      }
    }
    const y = (c: readonly number[]): number => yPrime(c[0]!, c[1]!, c[2]!);
    expect(y(got['ciel-horizon']!) - y(got['ciel-zenith']!), `${light} écart zénith-horizon`).toBeGreaterThanOrEqual(0.15);   // §4.1
    expect(y(got['ciel-horizon']!)).toBeGreaterThan(y(got['ciel-milieu']!));
    expect(y(got['ciel-milieu']!)).toBeGreaterThan(y(got['ciel-zenith']!));
  }
});
