import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Le focus d'une option de rue garde son ombre pleine et son liseré ET porte l'anneau [spec C §3.0, §3.2 ; revue T6, 17]. Mesuré en PIXELS dans
 * Chromium : `[data-ui="root"] button:focus-visible` battait `.c-street-option:focus-visible` par spécificité, ce qu'un test sur le texte du CSS ne voit pas.
 */
const theme = JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { palette: Record<string, { v: string }>; shape: Record<string, { v: number }> };
const RING = theme.shape['focusRing']!.v;
const OFFSET = theme.shape['shadowOffset']!.v;
const P = (k: string): string => theme.palette[k]!.v;
const hexOf = (d: number[]): string => `#${d.slice(0, 3).map((v) => v!.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const close = (a: string, b: string, tol = 3): boolean => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= tol);

for (const pressed of [false, true]) {
  test(`test_focused_street_option_keeps_shadow_and_rim_and_has_the_ring_${pressed ? 'designated' : 'rest'}`, async ({ page }) => {
    const out = await build({
      stdin: { contents: "import './src/ui/c.css'; import './src/street/ui/ui.css'; import './src/ui/font'; import { applyTheme } from './src/ui/theme'; (window as any).applyTheme = applyTheme;", resolveDir: '.', loader: 'ts' },
      bundle: true, write: false, format: 'iife', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'],
    });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
    const css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.route('http://t.test/**', (r) => {
      const u = new URL(r.request().url()).pathname;
      if (u.startsWith('/fonts/')) return r.fulfill({ body: readFileSync(`public${u}`), contentType: 'font/woff2' });
      return r.fulfill({ body: '<!doctype html><html><body></body></html>', contentType: 'text/html' });
    });
    await page.setViewportSize({ width: 500, height: 240 });
    await page.goto('http://t.test/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.evaluate((on) => {
      (window as unknown as { applyTheme: (e: HTMLElement) => void }).applyTheme(document.body);
      document.body.style.background = 'var(--c-creme)';
      const root = document.createElement('div');
      root.dataset['ui'] = 'root'; root.style.position = 'static';
      (window as unknown as { applyTheme: (e: HTMLElement) => void }).applyTheme(root);
      document.body.append(root);
      const b = document.createElement('button');
      b.type = 'button'; b.id = 't'; b.className = 'c-option c-street-option'; b.textContent = 'x'; b.setAttribute('aria-pressed', String(on));
      b.style.cssText = 'display:block;margin:60px 100px;width:300px;pointer-events:auto';
      root.append(b);
    }, pressed);
    const box = (await page.locator('#t').boundingBox())!;
    const sample = async (pts: { x: number; y: number }[]): Promise<string[]> => {
      const b64 = (await page.screenshot()).toString('base64');
      const px = await page.evaluate(async ({ b64, pts }) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
        return pts.map((p) => [...g.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data]);
      }, { b64, pts });
      return px.map(hexOf);
    };
    const cx = box.x + box.width / 2;
    const col = (k: number): { x: number; y: number } => ({ x: cx, y: Math.floor(box.y + box.height) + k + 0.4 });   // rangée k sous le bord bas
    const flank = (d: number): { x: number; y: number } => ({ x: box.x - d, y: box.y + box.height / 2 });
    const [shadowRest] = await sample([col(Math.floor(OFFSET / 2))]);
    expect(close(shadowRest!, P('creme')), 'l\'ombre existe au repos').toBe(false);
    await page.keyboard.press('Tab');
    const rows = await sample(Array.from({ length: OFFSET + RING + 2 }, (_, k) => col(k)));
    const [ringInner, ringOuter] = await sample([flank(RING / 2), flank(RING * 1.5)]);
    expect(rows.some((r) => close(r, shadowRest!)), 'l\'option focalisée garde son ombre pleine sous l\'anneau').toBe(true);
    expect(ringInner, 'bande encre de l\'anneau').toBe(P('encre'));
    expect(ringOuter, pressed ? 'liseré blanc de la désignation conservé' : 'bande crème de l\'anneau').toBe(P(pressed ? 'blanc' : 'creme'));
  });
}
