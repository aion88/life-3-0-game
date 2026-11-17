import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/** La scène touche les bords de la fenêtre : aucune marge de 8 px du navigateur sur `body` [feuille C, reset de page]. */
test('test_frame_touches_viewport_edges_with_zero_margin', async ({ page }) => {
  const out = await build({ entryPoints: ['src/ui/frame.ts'], bundle: true, write: false, format: 'iife', globalName: 'F', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
  const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  const css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
  await page.route('http://t.test/**', (r) => {
    const u = new URL(r.request().url()).pathname;
    if (u.startsWith('/fonts/')) return r.fulfill({ body: readFileSync(`public${u}`), contentType: 'font/woff2' });
    return r.fulfill({ body: '<!doctype html><html><body><div id="app"></div></body></html>', contentType: 'text/html' });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://t.test/');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.evaluate(() => { (window as unknown as { F: { createFrame: (r: HTMLElement) => unknown } }).F.createFrame(document.getElementById('app')!); });
  const r = await page.evaluate(() => { const b = document.querySelector('[data-ui="frame"]')!.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, margin: getComputedStyle(document.body).margin, htmlH: document.documentElement.getBoundingClientRect().height }; });
  expect(r).toEqual({ x: 0, y: 0, w: 1280, h: 720, margin: '0px', htmlH: 720 });   // html garde une boîte : `waitForSelector('html[data-ready]')` (openCapture) l'exige visible
});
