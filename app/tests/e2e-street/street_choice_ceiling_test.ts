import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Le plafond de zone change, fenêtre fixe [revue T6, demande team-lead 2026-11-03] : le bracelet grandit de 40 px (la zone du haut aussi, donc
 * le plafond du panneau descend), puis revient. Après chaque changement, sans redimensionner la fenêtre : le panneau a changé de hauteur, la fenêtre
 * du groupe déplié est recalée sur la place réelle (aucune limite plus haute que la place, aucune fenêtre qui déborde sans arrêt sous une ligne
 * entière), l'option désignée et Confirmer sont dans le panneau et reçoivent le clic, le haut de la ligne de prix est dans le panneau.
 * 3 tailles x première, milieu et dernière option du checkpoint, prix de 93 car., refus affiché.
 */
const fr = JSON.parse(readFileSync(new URL('../../src/data/strings/fr.json', import.meta.url), 'utf8')) as Record<string, string>;
const real = Object.fromEntries(Object.entries(fr).filter(([k]) => k.startsWith('street.ui.') || k.startsWith('w10.choice.checkpoint.j1.')));
const PRICE = fr['w10.price.checkpoint.bypass']!;
const CHECKPOINT = ['comply', 'buy.permission', 'buy.bons', 'buy.component', 'bypass', 'courtesy', 'refuse'].map((s) => `w10.choice.checkpoint.j1.${s}`);
const SEVEN = ['checkpoint.j1', 'j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'permit.j1'];

for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 960, height: 540 }]) {
  test(`test_choice_panel_${vp.width}x${vp.height}_ceiling_moves_with_a_fixed_window_and_the_group_window_is_snapped_again`, async ({ page }) => {
    test.setTimeout(120_000);
    const out = await build({ entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text, css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.setViewportSize(vp);
    const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);
    const fails: string[] = [];
    for (const opt of ['o0', 'o3', 'o6']) {
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
      await page.evaluate(({ opt, price }) => (window as unknown as { ui: { showPrice(p: unknown): void } }).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: opt, textKey: price, isRefusal: false, inventoryParams: {} }), { opt, price: PRICE });
      await page.evaluate(() => (window as unknown as { ui: { showRefusal(r: unknown): void } }).ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'choiceClosed' }));
      await page.waitForTimeout(150);
      const panelH = (): Promise<number> => page.evaluate(() => document.querySelector('[data-ui="choices"]')!.getBoundingClientRect().height);
      const h0 = await panelH();
      for (const step of ['shrunk', 'back'] as const) {
        await page.evaluate((pad) => { document.querySelector<HTMLElement>('[data-ui="bracelet"]')!.style.paddingBottom = pad; }, step === 'shrunk' ? '40px' : '');
        await page.waitForTimeout(150);
        const h = await panelH();
        if (step === 'shrunk' && !(h < h0 - 20)) fails.push(`${opt} ${step} : le plafond n'a pas bougé (${Math.round(h0)} -> ${Math.round(h)})`);
        if (step === 'back' && Math.abs(h - h0) > 0.5) fails.push(`${opt} ${step} : le panneau n'est pas revenu (${Math.round(h0)} -> ${Math.round(h)})`);
        const bad = await page.evaluate(() => {
          const pn = document.querySelector('[data-ui="choices"]')!.getBoundingClientRect(); const out: string[] = [];
          const chk = (nm: string, e: Element | null, pad: number): void => {
            if (e === null) { out.push(`${nm} absent`); return; }
            const q = e.getBoundingClientRect();
            if (q.top < pn.top - pad || q.bottom > pn.bottom + pad) out.push(`${nm} hors du panneau`);
            const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
            if (!(hit !== null && (hit === e || e.contains(hit)))) out.push(`${nm} ne reçoit pas le clic`);
          };
          chk('option', document.querySelector('[aria-pressed="true"]'), 8);
          chk('Confirmer', document.querySelector('[data-ui="confirm"]'), 1);
          const price = document.querySelector('[data-ui="price"]')!.getBoundingClientRect();
          if (price.top < pn.top - 1 || price.top > pn.bottom) out.push('haut du prix hors du panneau');
          const g = document.querySelector('[aria-pressed="true"]')!.closest<HTMLElement>('.c-street-group')!;
          const limit = parseFloat(g.style.maxHeight);
          if (Number.isFinite(limit) && limit > g.clientHeight + 0.5) out.push(`fenêtre non recalée (limite ${Math.round(limit)} > place ${g.clientHeight})`);
          if (!Number.isFinite(limit) && g.scrollHeight > g.clientHeight + 0.5) out.push(`fenêtre qui déborde sans arrêt sous une ligne entière (${g.clientHeight})`);
          return out;
        });
        for (const b of bad) fails.push(`${opt} ${step} : ${b}`);
      }
    }
    expect(fails).toEqual([]);
  });
}
