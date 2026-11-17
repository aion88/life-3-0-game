import { expect, test } from '@playwright/test';
import { openCapture, settle, st } from '../support/street_capture';

/**
 * Marge interne des options de rue, mesurée en PIXELS dans le runtime VIVANT (checkpoint, fr, 1920 x 1080) [retour de Cynthia 2026-11-02].
 * L'option est rendue deux fois, texte visible puis transparent (la pastille de prix est masquée dans les deux) : la différence donne les glyphes
 * du libellé, et tout pixel qui n'est pas le fond de l'option (bordure, coins arrondis, scène derrière) est un mur. Distance glyphe-mur >= MIN_GAP_PX.
 */
const MIN_GAP_PX = 20;

test('test_live_street_options_keep_their_text_off_the_border', async ({ page }, info) => {
  test.setTimeout(240_000);
  await openCapture(page, { lang: 'fr', viewport: { width: 1920, height: 1080 }, query: info.project.name === 'webgl2' ? 'webgl' : '' });
  await page.keyboard.down('KeyW');
  try {
    for (let t = 0; t < 60_000; t += 500) { await st(page, 'step', 500, { render: false }); if ((await st(page, 'state')).player.z <= -10.0) break; }
  } finally { await page.keyboard.up('KeyW'); }
  await page.waitForSelector('[data-choice="checkpoint.j1"]', { state: 'attached' });
  await settle(page, 1000);
  await page.locator('[data-choice="checkpoint.j1"] [data-ui="choice-name"]').evaluate((e) => { (e as HTMLElement).click(); });
  await page.locator('[data-choice="checkpoint.j1"] [data-option="comply"]').evaluate((e) => { (e as HTMLElement).click(); });
  await settle(page, 500);
  for (const option of ['comply', 'bypass']) {
    const opt = page.locator(`[data-choice="checkpoint.j1"] [data-option="${option}"]`);
    await opt.scrollIntoViewIfNeeded();
    // le fond de l'option est translucide (build 35ed56c) : la scène passerait au travers et ferait de faux murs ; la mesure porte sur la géométrie, on repose l'encre pleine
    await opt.evaluate((e) => { if (e.getAttribute('aria-pressed') !== 'true') e.style.setProperty('background-color', 'var(--c-encre)', 'important'); });
    await opt.evaluate((e) => { e.querySelectorAll<HTMLElement>('[data-ui="price-pill"]').forEach((p) => { p.style.setProperty('visibility', 'hidden', 'important'); }); });
    const withText = (await opt.screenshot()).toString('base64');
    await opt.evaluate((e) => { e.style.setProperty('color', 'transparent', 'important'); e.querySelectorAll<HTMLElement>('*').forEach((c) => c.style.setProperty('color', 'transparent', 'important')); });
    const bare = (await opt.screenshot()).toString('base64');
    const gap = await page.evaluate(async ({ a, b }) => {
      const load = async (s: string): Promise<ImageData> => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height);
      };
      const w = await load(a); const n = await load(b);
      const W = w.width, H = w.height;
      const mid = ((H >> 1) * W + 3) * 4;   // à l'intérieur, tout près du bord gauche : le fond de l'option est la couleur la plus fréquente de la rangée centrale
      const counts = new Map<string, number>();
      for (let x = 0; x < W; x++) { const i = ((H >> 1) * W + x) * 4; const k = `${n.data[i]},${n.data[i + 1]},${n.data[i + 2]}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
      const bg = [...counts.entries()].sort((p, q) => q[1] - p[1])[0]![0].split(',').map(Number);
      void mid;
      const isBg = (i: number): boolean => Math.abs(n.data[i]! - bg[0]!) + Math.abs(n.data[i + 1]! - bg[1]!) + Math.abs(n.data[i + 2]! - bg[2]!) < 30;
      const glyphs: number[] = []; const walls: number[] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (isBg(i) && Math.abs(w.data[i]! - n.data[i]!) + Math.abs(w.data[i + 1]! - n.data[i + 1]!) + Math.abs(w.data[i + 2]! - n.data[i + 2]!) > 60) glyphs.push(x, y);   // un glyphe est posé sur le fond de l'option : un pixel qui change hors du fond (coin arrondi, scène derrière qui bouge) n'en est pas un
        else if (!isBg(i)) walls.push(x, y);
      }
      let min = Infinity;
      for (let g = 0; g < glyphs.length; g += 2) for (let k = 0; k < walls.length; k += 2) {
        const dx = glyphs[g]! - walls[k]!, dy = glyphs[g + 1]! - walls[k + 1]!;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < min) min = d;
      }
      return { min, glyphs: glyphs.length / 2 };
    }, { a: withText, b: bare });
    expect(gap.glyphs, `${option} : du texte à mesurer`).toBeGreaterThan(50);
    expect(gap.min, `${option} : distance glyphe-bordure`).toBeGreaterThanOrEqual(MIN_GAP_PX);
  }
});
