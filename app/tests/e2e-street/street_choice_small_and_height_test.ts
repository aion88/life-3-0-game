import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Panneau de choix, deux garanties [spec choix simultanés §6.3 AR-13 ; revue T6, constat 34] :
 * 1. AR-13, 960 x 540 (mode petit), groupe du checkpoint avec ses VRAIS libellés, 7 groupes, première, milieu et dernière option désignées,
 *    4 prix réels, avec et sans refus : sans que le joueur défile, l'option désignée est entière dans la zone qui défile, au moins une ligne
 *    entière de la ligne de prix y est visible, chaque option porte sa pastille SUR SA LIGNE et mesure au plus 56 px.
 * 2. La hauteur du panneau vient du budget de zone de la fenêtre : à une taille donnée, elle ne bouge ni avec l'option, ni avec le prix, ni avec le refus.
 */
const fr = JSON.parse(readFileSync(new URL('../../src/data/strings/fr.json', import.meta.url), 'utf8')) as Record<string, string>;
const real = Object.fromEntries(Object.entries(fr).filter(([k]) => k.startsWith('street.ui.') || k.startsWith('w10.choice.checkpoint.j1.')));
const prices = Object.entries(fr).filter(([k]) => k.startsWith('w10.price.')).map(([, v]) => v).sort((a, b) => a.length - b.length);
const PRICES = [prices[0]!, prices[Math.floor(prices.length / 2)]!, fr['w10.price.checkpoint.bypass']!, prices.at(-1)!];
const CHECKPOINT = ['comply', 'buy.permission', 'buy.bons', 'buy.component', 'bypass', 'courtesy', 'refuse'].map((s) => `w10.choice.checkpoint.j1.${s}`);
const SEVEN = ['checkpoint.j1', 'j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'permit.j1'];
const OPTIONS = ['o0', 'o3', 'o6'];

interface Probe { mode: string; panelH: number; optionWhole: boolean; fullPriceLines: number; maxOptionH: number; pills: number; options: number; pillsInline: boolean }

for (const vp of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`test_choice_panel_${vp.width}x${vp.height}_height_from_the_zone_budget${vp.width === 960 ? '_and_AR13_option_on_one_line_with_a_whole_price_line' : ''}`, async ({ page }) => {
    test.setTimeout(240_000);
    const out = await build({ entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text, css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.setViewportSize(vp);
    const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);
    const heights = new Set<number>(); const fails: string[] = [];
    for (const price of PRICES) for (const opt of OPTIONS) for (const refus of [false, true]) {
      await page.setContent('<body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body>');
      await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
      await page.evaluate(({ ids, cp, band, real }) => {
        const list = ids.map((id: string, c: number) => ({ id, labelKey: c === 0 ? 'Le contrôle' : `Choix ${c}`, blocksExit: false, options: (c === 0 ? cp : ['Une option', 'Une autre option', 'Une troisième option']).map((k: string, o: number) => ({ id: `o${o}`, labelKey: k, isRefusal: false, words: 1 + o })) }));
        const t = (k: string, p?: Record<string, unknown>): string => (real[k] ?? k).replace(/\{(\w+)\}/g, (_m, n: string) => String(p?.[n] ?? ''));
        const w = window as unknown as { Ui: { mountUi: (h: HTMLElement, i: unknown, o: unknown) => unknown }; ui: { setBracelet(n: number): void; setLetterboxBand(n: number): void; showChoices(c: unknown): void } };
        w.ui = w.Ui.mountUi(document.getElementById('host')!, { t, has: (k: string) => k in real, onChange: () => () => undefined, lang: () => 'fr', setLang: () => undefined, tPlural: (k: string, c: number, p?: Record<string, unknown>) => t(`${k}.${c === 1 ? 'one' : 'other'}`, p) }, { reducedMotion: true }) as typeof w.ui;
        w.ui.setBracelet(41); w.ui.setLetterboxBand(band); w.ui.showChoices(list);
      }, { ids: SEVEN, cp: CHECKPOINT, band, real });
      await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.hasAttribute('data-zone-mode'));
      await page.locator(`[data-choice="checkpoint.j1"] [data-option="${opt}"]`).evaluate((e) => { (e as HTMLElement).click(); });
      await page.evaluate(({ opt, price }) => (window as unknown as { ui: { showPrice(p: unknown): void } }).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: opt, textKey: price, isRefusal: false, inventoryParams: {} }), { opt, price });
      if (refus) await page.evaluate(() => (window as unknown as { ui: { showRefusal(r: unknown): void } }).ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'choiceClosed' }));
      await page.waitForTimeout(150);
      const r: Probe = await page.evaluate(() => {
        const panel = document.querySelector('[data-ui="choices"]')!.getBoundingClientRect();
        const o = document.querySelector<HTMLElement>('[aria-pressed="true"]')!; const g = o.closest<HTMLElement>('.c-street-group')!; const gr = g.getBoundingClientRect();
        const or = o.getBoundingClientRect();
        const p = document.querySelector<HTMLElement>('[data-ui="price"]')!; const cs = getComputedStyle(p); const lh = parseFloat(cs.lineHeight); const pt = parseFloat(cs.paddingTop) || 0; const pb = parseFloat(cs.paddingBottom) || 0;
        const top = p.getBoundingClientRect().top + pt; const n = Math.max(1, Math.round((p.offsetHeight - pt - pb) / lh));
        let full = 0; for (let k = 0; k < n; k++) if (top + k * lh >= gr.top - 0.5 && top + (k + 1) * lh <= gr.bottom + 0.5) full++;
        const opts = [...g.querySelectorAll<HTMLElement>('.c-street-option')];
        // pastille en ligne : à droite du libellé et sur sa hauteur (le libellé ne passe pas au-dessus d'elle)
        const inline = opts.every((x) => { const pl = x.querySelector('[data-ui="price-pill"]')?.getBoundingClientRect(); const lb = x.querySelector('[data-ui="option-label"]')!.getBoundingClientRect(); return pl !== undefined && pl.left >= lb.right - 1 && pl.top < lb.bottom && pl.bottom > lb.top; });
        return { mode: document.querySelector<HTMLElement>('[data-ui="root"]')!.dataset['zoneMode'] ?? '', panelH: Math.round(panel.height), optionWhole: or.top >= gr.top - 8 && or.bottom <= gr.bottom + 8, fullPriceLines: full, maxOptionH: Math.max(...opts.map((x) => x.offsetHeight)), pills: g.querySelectorAll('[data-ui="price-pill"]').length, options: opts.length, pillsInline: inline };
      });
      heights.add(r.panelH);
      const tag = `${price.length} car. ${opt}${refus ? ' +refus' : ''}`;
      if (vp.width === 960) {
        if (r.mode !== 'small') fails.push(`${tag} : mode ${r.mode}`);
        if (!r.optionWhole) fails.push(`${tag} : option désignée hors de la zone qui défile`);
        if (r.fullPriceLines < 1) fails.push(`${tag} : aucune ligne entière du prix visible`);
        if (r.maxOptionH > 56) fails.push(`${tag} : option de ${r.maxOptionH} px (> 56)`);
        if (r.pills !== r.options || !r.pillsInline) fails.push(`${tag} : pastille absente ou pas sur la ligne du libellé`);
      }
    }
    expect(fails, 'AR-13 à 960 x 540').toEqual([]);
    expect([...heights], `hauteur du panneau à ${vp.width} x ${vp.height}, quels que soient l'option, le prix et le refus`).toHaveLength(1);
  });
}
