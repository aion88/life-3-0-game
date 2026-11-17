import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LINES, seedJson, seedSave, continueIfAsked } from '../support/e2e';
import { PROD_URL, median, openCapture, st } from '../support/street_capture';

/**
 * Performance de la rue [plan 02a T13 ; art bible §C.8]. Seuils du plan : médiane du temps d'image sur 600 images en vue large au plus
 * 17,5 ms en WebGPU (16,67 ms + 5 %) et 35,0 ms en WebGL 2 (33,33 ms + 5 %) [calcul] ; octets reçus au premier chargement au plus
 * 15 000 000 et au chargement du monde au plus 30 000 000. Les seuils de TEMPS ne se jouent qu'avec `PERF_LOCAL=1` sur le projet `webgpu-mac` :
 * un runner sans GPU mesurerait le runner [propriétaire technical-director : machine de référence à fixer].
 * Budgets de scène (appels de dessin, triangles) : 600 et 1 200 000 [plan, Global Constraints], rapportés et comparés.
 */
const PERF_LOCAL = process.env['PERF_LOCAL'] === '1';
const FRAMES = 600;
const SMOKE_FRAMES = 20;
const BUDGET = { webgpu: 17.5, webgl2: 35.0 } as const;
const FIRST_LOAD_BYTES = 15_000_000;
const WORLD_BYTES = 30_000_000;
const DRAW_CALLS = 600;
const TRIANGLES = 1_200_000;

/** Intervalles réels entre `FRAMES` images (ms) en vue large [pose `checkpoint-large`, supposed, owner technical-artist]. */
async function frameIntervals(page: Page, frames = FRAMES, warm = 60): Promise<number[]> {
  await st(page, 'pose', 'checkpoint-large');
  return page.evaluate(async ({ n, w }) => {
    const out: number[] = [];
    let last = await new Promise<number>((r) => { requestAnimationFrame(r); });
    for (let i = 0; i < w; i++) last = await new Promise<number>((r) => { requestAnimationFrame(r); });   // chauffe : compilation asynchrone des pipelines
    for (let i = 0; i < n; i++) {
      const t = await new Promise<number>((r) => { requestAnimationFrame(r); });
      out.push(t - last);
      last = t;
    }
    return out;
  }, { n: frames, w: warm });
}

test.describe('rue : performance', () => {
  test('test_production_build_has_no_street_hooks', async ({ page, baseURL }) => {
    await page.goto(PROD_URL);
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    expect(await page.evaluate(() => '__street' in window)).toBe(false);
    // et la chaîne n'est dans aucun fichier du paquet de production
    const dir = join(process.cwd(), 'dist', 'assets');
    const hits = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f) && readFileSync(join(dir, f), 'utf8').includes('__street'));
    expect(hits, `__street trouvé dans ${hits.join(', ')} (${baseURL ?? ''})`).toEqual([]);
  });

  test('test_first_load_and_world_bytes_within_budget', async ({ page }) => {
    const sizes: { url: string; bytes: number }[] = [];
    const pending: Promise<void>[] = [];
    page.on('requestfinished', (req) => {
      pending.push(req.sizes().then((s) => { sizes.push({ url: req.url(), bytes: s.responseBodySize + s.responseHeadersSize }); }, () => undefined));
    });
    await seedSave(page, seedJson({ lang: 'fr', phase: 'street', line: LINES.w10 }));
    await page.goto(`${PROD_URL}?parcours=ancien`);
    await page.waitForSelector('html[data-ready="1"]');
    await continueIfAsked(page);
    await page.waitForSelector('.episode-hud');
    await page.waitForLoadState('networkidle');
    await Promise.all(pending);
    const world = sizes.filter((s) => s.url.includes('/worlds/')).reduce((a, s) => a + s.bytes, 0);
    const shell = sizes.filter((s) => !s.url.includes('/worlds/')).reduce((a, s) => a + s.bytes, 0);
    test.info().annotations.push({ type: 'bytes', description: `premier chargement (hors monde) ${shell} ; monde ${world} ; ${sizes.length} requêtes` });
    expect(shell).toBeLessThanOrEqual(FIRST_LOAD_BYTES);
    expect(world).toBeLessThanOrEqual(WORLD_BYTES);
  });

  test('test_scene_stays_within_draw_call_and_triangle_budget', async ({ page }) => {
    await openCapture(page, { query: 'webgl' });
    await st(page, 'pose', 'checkpoint-large');
    const s = await st(page, 'stats');
    test.info().annotations.push({ type: 'stats', description: `${s.drawCalls} appels de dessin ; ${s.triangles} triangles (toutes passes)` });
    expect(s.drawCalls).toBeGreaterThan(0);
    expect(s.drawCalls).toBeLessThanOrEqual(DRAW_CALLS);
    expect(s.triangles).toBeLessThanOrEqual(TRIANGLES);
  });

  test('test_frame_time_median_in_wide_view', async ({ page }, info) => {
    const webgl2Project = info.project.name === 'webgl2';
    await openCapture(page, { realtime: true, query: webgl2Project ? 'webgl' : '' });
    const backend = (await st(page, 'backend')) satisfies 'webgpu' | 'webgl2';
    // fumée (projet webgl2, rendu logiciel sur un runner) : quelques images suffisent à prouver que la boucle tourne, 600 n'y tiendraient pas
    const intervals = await frameIntervals(page, webgl2Project ? SMOKE_FRAMES : FRAMES, webgl2Project ? 3 : 60);
    const med = median(intervals);
    info.annotations.push({ type: 'frame-median-ms', description: `${backend} : ${med.toFixed(2)} ms sur ${intervals.length} images` });
    expect(intervals).toHaveLength(webgl2Project ? SMOKE_FRAMES : FRAMES);
    if (webgl2Project || !PERF_LOCAL) return;                          // fumée : la boucle tourne, aucun seuil de temps hors machine de référence
    expect(backend).toBe('webgpu');
    expect(med).toBeLessThanOrEqual(BUDGET.webgpu);
  });

  test('test_frame_time_median_in_wide_view_webgl2_fallback', async ({ page }, info) => {
    test.skip(info.project.name !== 'webgpu-mac' || !PERF_LOCAL, 'PERF_LOCAL=1 sur le projet webgpu-mac seulement');
    await openCapture(page, { realtime: true, query: 'webgl' });
    expect(await st(page, 'backend')).toBe('webgl2');
    const med = median(await frameIntervals(page));
    info.annotations.push({ type: 'frame-median-ms', description: `webgl2 : ${med.toFixed(2)} ms` });
    expect(med).toBeLessThanOrEqual(BUDGET.webgl2);
  });
});
