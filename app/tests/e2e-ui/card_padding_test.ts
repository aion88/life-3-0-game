import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Marge interne des cartouches (retour de Cynthia, 2026-11-02 : « le texte est collé aux bordures ») : mesurée en PIXELS dans Chromium.
 * On rend la carte deux fois, texte visible puis texte transparent ; la différence donne les pixels des glyphes. La distance de chaque glyphe
 * au pixel le plus proche qui n'est pas le fond de la carte (bordure, coins arrondis, extérieur) doit atteindre `MIN_GLYPH_GAP_PX`.
 */
const MIN_GLYPH_GAP_PX = 24;
const SELECTORS = ['right-line', 'evening', 'controls', 'narration', 'carnet', 'carnet-scroll', 'card', 'evening-message', 'day-date', 'bubble'] as const;

for (const kind of SELECTORS) {
  test(`test_card_text_keeps_${MIN_GLYPH_GAP_PX}px_from_every_border_${kind}`, async ({ page }) => {
    const out = await build({
      stdin: { contents: "import './src/ui/c.css'; import './src/street/ui/ui.css'; import './src/street/ui/zones.css'; import './src/street/ui/bubble.css'; import './src/ui/font'; import { applyTheme } from './src/ui/theme'; (window as any).applyTheme = applyTheme;", resolveDir: '.', loader: 'ts' },
      bundle: true, write: false, format: 'iife', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'],
    });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
    const css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.route('http://t.test/**', (r) => {
      const u = new URL(r.request().url()).pathname;
      if (u.startsWith('/fonts/')) return r.fulfill({ body: readFileSync(`public${u}`), contentType: 'font/woff2' });
      return r.fulfill({ body: '<!doctype html><html><body></body></html>', contentType: 'text/html' });
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://t.test/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.evaluate((k) => {
      const root = document.createElement('div');
      root.dataset['ui'] = 'root';
      (window as unknown as { applyTheme: (e: HTMLElement) => void }).applyTheme(root);
      document.body.append(root);
      const tag = k === 'evening' ? 'ul' : (k === 'carnet' || k === 'carnet-scroll' || k === 'bubble') ? 'div' : 'p';
      const el = document.createElement(tag);
      el.dataset['ui'] = k === 'carnet-scroll' ? 'carnet' : k; el.dataset['kind'] = k;
      el.className = ({ 'right-line': 'c-right-line c-sober', evening: 'c-card c-card--secondary c-card--ink c-sober', controls: 'c-card c-card--secondary c-card--ink c-sober', narration: 'c-card c-card--secondary c-card--ink', bubble: 'c-bubble', carnet: 'c-card c-card--secondary c-sober', 'carnet-scroll': 'c-card c-card--secondary c-sober', card: 'c-card c-card--document', 'evening-message': 'c-sticker', 'day-date': 'c-pill c-pill--soleil c-day-date' } as Record<string, string>)[k]!;
      if (k === 'carnet' || k === 'carnet-scroll') {
        // même structure que `carnet.ts` : la carte garde son remplissage, seule la liste défile ; `carnet-scroll` est plein et plafonné (le cas qui coupait la dernière ligne)
        const ul = document.createElement('ul'); ul.className = 'c-carnet__list';
        const n = k === 'carnet' ? 1 : 12;
        for (let i = 0; i < n; i++) { const li = document.createElement('li'); li.textContent = 'Une ligne de texte assez longue pour passer à la ligne dans la carte.'; ul.append(li); }
        el.append(ul);
        if (k === 'carnet-scroll') { el.style.maxHeight = '360px'; el.style.bottom = 'auto'; el.style.top = '0'; }
      } else if (tag === 'ul') { const li = document.createElement('li'); li.textContent = 'Une ligne de texte assez longue pour passer à la ligne dans la carte.'; el.append(li); }
      else if (k === 'right-line') { const a = document.createElement('span'); a.dataset['half'] = '1'; a.className = 'c-half c-half--ink'; a.textContent = 'Ici, tu ne sors pas du secteur sans passer par le contrôle.'; const b = document.createElement('span'); b.dataset['half'] = '2'; b.className = 'c-half c-half--creme'; b.textContent = 'Voilà.'; el.append(a, b); }
      else if (k === 'bubble') { const p = document.createElement('p'); p.className = 'c-bubble__text'; p.textContent = 'Une ligne de texte assez longue pour passer à la ligne dans la bulle.'; el.append(p); }
      else el.textContent = 'Une ligne de texte assez longue pour passer à la ligne dans la carte.';
      root.append(el);
    }, kind);
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator(`[data-kind="${kind}"]`);
    const shotWith = (await card.screenshot()).toString('base64');
    await card.evaluate((e) => { e.style.setProperty('color', 'transparent', 'important'); e.querySelectorAll<HTMLElement>('*').forEach((c) => c.style.setProperty('color', 'transparent', 'important')); });
    const shotBare = (await card.screenshot()).toString('base64');
    // une carte à deux fonds (ligne de droit) : le fond de référence est celui de la moitié où se trouve le pixel (coordonnées de la capture)
    const bands = await card.evaluate((e) => { const c = e.getBoundingClientRect(); return [...e.querySelectorAll('[data-half]')].map((h) => { const r = h.getBoundingClientRect(); return { y0: Math.round(r.top - c.top), y1: Math.round(r.bottom - c.top), x0: Math.round(r.left - c.left), x1: Math.round(r.right - c.left) }; }); });
    const gap = await page.evaluate(async ({ a, b, bands }) => {
      const load = async (s: string): Promise<ImageData> => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height);
      };
      const w = await load(a); const n = await load(b);
      const W = w.width, H = w.height;
      const centre = (n.width >> 1) + (n.height >> 1) * n.width;
      const bg = [n.data[centre * 4]!, n.data[centre * 4 + 1]!, n.data[centre * 4 + 2]!];
      const diff = (i: number): boolean => Math.abs(w.data[i]! - n.data[i]!) + Math.abs(w.data[i + 1]! - n.data[i + 1]!) + Math.abs(w.data[i + 2]! - n.data[i + 2]!) > 60;
      const refs = bands.map((r) => { const c = ((r.x0 + r.x1) >> 1) + ((r.y0 + r.y1) >> 1) * n.width; return { ...r, rgb: [n.data[c * 4]!, n.data[c * 4 + 1]!, n.data[c * 4 + 2]!] }; });
      const isBg = (i: number): boolean => {
        const p = i >> 2; const x = p % W, y = (p / W) | 0;
        const band = refs.find((r) => y >= r.y0 && y < r.y1 && x >= r.x0 && x < r.x1);
        const ref = band?.rgb ?? bg;
        return Math.abs(n.data[i]! - ref[0]!) + Math.abs(n.data[i + 1]! - ref[1]!) + Math.abs(n.data[i + 2]! - ref[2]!) < 30;
      };
      const glyphs: number[] = []; const walls: number[] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (diff(i)) glyphs.push(x, y); else if (!isBg(i)) walls.push(x, y); }
      let min = Infinity;
      for (let g = 0; g < glyphs.length; g += 2) for (let k = 0; k < walls.length; k += 2) {
        const dx = glyphs[g]! - walls[k]!, dy = glyphs[g + 1]! - walls[k + 1]!;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < min) min = d;
      }
      return { min, glyphs: glyphs.length / 2, walls: walls.length / 2 };
    }, { a: shotWith, b: shotBare, bands });
    expect(gap.glyphs, 'il y a du texte à mesurer').toBeGreaterThan(50);
    expect(gap.min, `distance minimale glyphe-bord (${kind})`).toBeGreaterThanOrEqual(MIN_GLYPH_GAP_PX);
  });
}
