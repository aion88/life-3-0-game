import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../../src/ui/color';

/**
 * Anneau de focus double mesuré en PIXELS dans Chromium [spec C §3.0, I-2, B-1 de la relecture T4] : 3 px encre contre le bord, puis 3 px crème
 * à l'extérieur. Le test lit les pixels rendus, pas le texte de la feuille : un contour qui masque l'ombre ferait échouer la bande crème.
 */
const { palette } = JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { palette: Record<string, { v: string }> };
const hex = (r: number, g: number, b: number): string => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const GROUNDS = ['creme', 'blanc', 'lavande', 'rose', 'ciel', 'soleil', 'menthe', 'encre', 'grisAcier'] as const;
const RING_PX = (JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { shape: { focusRing: { v: number } } }).shape.focusRing.v;

test('test_focus_ring_double_and_3_to_1_on_every_palette_ground', async ({ page }) => {
  const out = await build({ stdin: { contents: "import './src/ui/c.css'; import './src/ui/font'; import { applyTheme } from './src/ui/theme'; (window as any).applyTheme = applyTheme;", resolveDir: '.', loader: 'ts' }, bundle: true, write: false, format: 'iife', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
  const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  const css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
  await page.route('**/fonts/*', (r) => r.fulfill({ body: readFileSync(`public/fonts/${new URL(r.request().url()).pathname.split('/').pop()}`), contentType: 'font/woff2' }));
  await page.setViewportSize({ width: 400, height: 200 });
  await page.setContent('<!doctype html><body style="margin:0"><div id="host"></div></body>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.evaluate(() => {
    const root = document.createElement('div');
    root.dataset['ui'] = 'root'; root.style.position = 'static';
    (window as unknown as { applyTheme: (e: HTMLElement) => void }).applyTheme(root);
    document.getElementById('host')!.append(root);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'c-action'; b.textContent = 'x'; b.id = 't';
    b.style.margin = '40px'; b.style.pointerEvents = 'auto';
    root.append(b);
  });
  await page.keyboard.press('Tab');   // :focus-visible vient du clavier
  for (const g of GROUNDS) {
    await page.evaluate((c) => { document.body.style.background = c; }, palette[g]!.v);
    const box = (await page.locator('#t').boundingBox())!;
    const shot = (await page.screenshot()).toString('base64');
    // Deux sondes sur le milieu du flanc gauche : 1,5 px (bande encre) et 4,5 px (bande crème) hors du bord.
    const px = await page.evaluate(async ({ b64, x, y, ring }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g2 = c.getContext('2d')!; g2.drawImage(img, 0, 0);
      const at = (dx: number): number[] => [...g2.getImageData(Math.round(x - dx), Math.round(y), 1, 1).data];
      return { inner: at(ring / 2), outer: at(ring * 1.5), far: at(ring * 2 + 6) };
    }, { b64: shot, x: box.x, y: box.y + box.height / 2, ring: RING_PX });
    const inner = hex(px.inner[0]!, px.inner[1]!, px.inner[2]!);
    const outer = hex(px.outer[0]!, px.outer[1]!, px.outer[2]!);
    const far = hex(px.far[0]!, px.far[1]!, px.far[2]!);
    expect(far, `fond ${g}`).toBe(palette[g]!.v);
    expect(inner, `bande intérieure sur ${g}`).toBe(palette['encre']!.v);
    expect(outer, `bande extérieure sur ${g}`).toBe(palette['creme']!.v);
    const best = Math.max(contrastRatio(inner, far), contrastRatio(outer, far));
    expect(best, `anneau contre ${g}`).toBeGreaterThanOrEqual(3);
  }
});
