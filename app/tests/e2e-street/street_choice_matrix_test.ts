import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Matrice du panneau de choix [constat 33c, sonde de rev-uic-6] : 4 tailles x 4 prix réels x 4 options x refus oui ou non = 128 cas.
 * Dans chaque cas, l'option désignée, Confirmer et le refus sont dans la boîte du panneau (8 px de marge pour l'option tournée, 1 px sinon)
 * ET `elementFromPoint` en leur centre les touche. Le refus de 960 x 540 vit en Z-centre : il doit seulement exister et être touché.
 * Prix : 24, 63, 93 et 129 caractères de `fr.json`. Option o2 : libellé sur deux lignes.
 */
const fr = JSON.parse(readFileSync(new URL('../../src/data/strings/fr.json', import.meta.url), 'utf8')) as Record<string, string>;
const real = Object.fromEntries(Object.entries(fr).filter(([k]) => k.startsWith('street.ui.')));
const prices = Object.entries(fr).filter(([k]) => k.startsWith('w10.price.')).map(([, v]) => v).sort((a, b) => a.length - b.length);
const PRICES = [prices[0]!, prices[Math.floor(prices.length / 2)]!, fr['w10.price.checkpoint.bypass']!, prices.at(-1)!];
const SEVEN = ['checkpoint.j1', 'j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'permit.j1'];
const SIZES: { n: number; w: number; h: number }[] = [{ n: 7, w: 1280, h: 720 }, { n: 7, w: 1920, h: 1080 }, { n: 7, w: 960, h: 540 }, { n: 2, w: 1280, h: 720 }];

for (const sz of SIZES) {
  test(`test_matrix_panel_${sz.n}_groups_${sz.w}x${sz.h}_every_option_price_and_refusal`, async ({ page }) => {
    test.setTimeout(240_000);
    const out = await build({ entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text, css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.setViewportSize({ width: sz.w, height: sz.h });
    const band = Math.floor((sz.h - Math.floor(sz.w / 2.39)) / 2);
    const fails: string[] = [];
    for (const price of PRICES) for (const opt of ['o0', 'o1', 'o2', 'o6']) for (const refus of [true, false]) {
      await page.setContent('<body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body>');
      await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
      await page.evaluate(({ ids, band, real }) => {
        const list = ids.map((id: string, c: number) => ({ id, labelKey: c === 0 ? 'Le contrôle' : `Choix ${c}`, blocksExit: false, options: Array.from({ length: c === 0 ? 7 : 3 }, (_, o) => ({ id: `o${o}`, labelKey: o === 2 ? 'Une option au libellé long, qui passe sur deux lignes dans le panneau' : `Une option ${c}.${o}`, isRefusal: false, words: 1 + o })) }));
        const t = (k: string, pr?: Record<string, unknown>): string => (real[k] ?? k).replace(/\{(\w+)\}/g, (_m: string, n: string) => String(pr?.[n] ?? ''));
        const w = window as unknown as { Ui: { mountUi: (h: HTMLElement, i: unknown, o: unknown) => unknown }; ui: { setBracelet(n: number): void; setLetterboxBand(n: number): void; showChoices(c: unknown): void } };
        w.ui = w.Ui.mountUi(document.getElementById('host')!, { t, has: () => false, onChange: () => () => undefined, lang: () => 'fr', setLang: () => undefined, tPlural: (k: string, c: number, p?: Record<string, unknown>) => t(`${k}.${c === 1 ? 'one' : 'other'}`, p) }, { reducedMotion: true }) as typeof w.ui;
        w.ui.setBracelet(41); w.ui.setLetterboxBand(band); w.ui.showChoices(list);
      }, { ids: SEVEN.slice(0, sz.n), band, real });
      await page.waitForTimeout(120);
      await page.locator(`[data-choice="checkpoint.j1"] [data-option="${opt}"]`).evaluate((e) => { (e as HTMLElement).click(); });
      await page.evaluate(({ opt, price }) => (window as unknown as { ui: { showPrice(p: unknown): void } }).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: opt, textKey: price, isRefusal: false, inventoryParams: {} }), { opt, price });
      if (refus) await page.evaluate(() => (window as unknown as { ui: { showRefusal(r: unknown): void } }).ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'choiceClosed' }));
      await page.waitForTimeout(200);
      const bad = await page.evaluate(() => {
        const pn = document.querySelector('[data-ui="choices"]')!.getBoundingClientRect(); const bad: string[] = [];
        const d = (nm: string, e: Element | null, need: boolean): void => {
          if (!e) return; const q = e.getBoundingClientRect(); const pad = nm === 'option' ? 8 : 1;
          const inside = q.top >= pn.top - pad && q.bottom <= pn.bottom + pad;
          const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); const hit = h !== null && (h === e || e.contains(h));
          if (need && (!inside || !hit)) bad.push(`${nm}:${Math.round(q.top - pn.top)}/${Math.round(pn.bottom - q.bottom)}${hit ? '' : ' non touché'}`);
        };
        d('option', document.querySelector('[aria-pressed="true"]'), true); d('Confirmer', document.querySelector('[data-ui="confirm"]'), true); d('refus', document.querySelector('[data-ui="refusal"]'), true);
        return bad;
      });
      if (bad.length > 0) fails.push(`${price.length} car. ${opt} ${refus ? 'avec' : 'sans'} refus : ${bad.join(', ')}`);
    }
    expect(fails, `${fails.length} échecs sur 32`).toEqual([]);
  });
}
