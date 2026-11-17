import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Le choix ACTIF est déplié d'office, sans clic [retour de Cynthia, build 35ed56c ; spec choix simultanés AR-8 et AR-9 révisés].
 * Deux choix ouverts, en navigateur (vraie mise en page) : à l'ouverture, un groupe est déplié et ses options sont visibles et touchables ;
 * quand un second choix arrive alors que la joueuse a déplié l'autre groupe ET que son pointeur est sur le panneau, c'est l'arrivant qui se déplie,
 * ses options visibles sans clic, l'autre groupe replié derrière son en-tête.
 */
const fr = JSON.parse(readFileSync(new URL('../../src/data/strings/fr.json', import.meta.url), 'utf8')) as Record<string, string>;
const real = Object.fromEntries(Object.entries(fr).filter(([k]) => k.startsWith('street.ui.') || k.startsWith('w10.choice.')));
const view = (id: string, opts: string[]) => ({ id, labelKey: `w10.choice.${id}`, blocksExit: false, options: opts.map((o, i) => ({ id: o, labelKey: `w10.choice.${id}.${o}`, isRefusal: false, words: i })) });
const LETTER = view('m3.letter', ['keep', 'refuse']);
const LIST = view('m4.list', ['read', 'pass']);
const CHECKPOINT = view('checkpoint.j1', ['comply', 'bypass', 'courtesy']);

/** Options du groupe : visibles (boîte non nulle, non masquées) et touchées par `elementFromPoint` en leur centre. */
const shown = (page: import('@playwright/test').Page, id: string) => page.evaluate((id) => [...document.querySelectorAll<HTMLElement>(`[data-choice="${id}"] [data-option]`)].map((o) => {
  const r = o.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return o.checkVisibility() && r.height > 0 && h !== null && (h === o || o.contains(h));
}), id);
const expanded = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-choice="${id}"] [data-ui="choice-name"]`).getAttribute('aria-expanded');

for (const vp of [{ width: 1920, height: 1080 }, { width: 960, height: 540 }]) {
  test(`test_two_open_choices_the_active_one_is_unfolded_without_a_click_at_${vp.width}x${vp.height}`, async ({ page }) => {
    const out = await build({ entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text, css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.setViewportSize(vp);
    await page.setContent('<body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body>');
    await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
    const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);
    await page.evaluate(({ band, real, list }) => {
      const t = (k: string, p?: Record<string, unknown>): string => (real[k] ?? k).replace(/\{(\w+)\}/g, (_m, n: string) => String(p?.[n] ?? ''));
      const w = window as unknown as { Ui: { mountUi: (h: HTMLElement, i: unknown, o: unknown) => unknown }; ui: { setBracelet(n: number): void; setLetterboxBand(n: number): void; showChoices(c: unknown): void } };
      w.ui = w.Ui.mountUi(document.getElementById('host')!, { t, has: (k: string) => k in real, onChange: () => () => undefined, lang: () => 'fr', setLang: () => undefined, tPlural: (k: string, c: number, p?: Record<string, unknown>) => t(`${k}.${c === 1 ? 'one' : 'other'}`, p) }, { reducedMotion: true }) as typeof w.ui;
      w.ui.setBracelet(41); w.ui.setLetterboxBand(band); w.ui.showChoices(list);
    }, { band, real, list: [LETTER, LIST] });
    await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.hasAttribute('data-zone-mode'));
    await page.waitForTimeout(100);

    // ouverture à deux choix : un groupe déplié, ses options visibles et touchables, sans clic
    expect(await expanded(page, LETTER.id), 'à l\'ouverture, le premier choix est déplié').toBe('true');
    expect(await shown(page, LETTER.id), 'ses options sont visibles sans clic').toEqual([true, true]);

    // la joueuse déplie l'autre groupe, laisse son pointeur sur le panneau ; le checkpoint arrive : c'est lui qui se déplie
    if (!(await page.locator(`[data-choice="${LIST.id}"] [data-ui="choice-name"]`).isVisible())) await page.locator('[data-ui="more-groups"]').click();   // mode petit : les autres en-têtes sont derrière « + N »
    await page.locator(`[data-choice="${LIST.id}"] [data-ui="choice-name"]`).click();
    const head = (await page.locator(`[data-choice="${LIST.id}"] [data-ui="choice-name"]`).boundingBox())!;
    await page.mouse.move(head.x + head.width / 2, head.y + head.height / 2);
    await page.evaluate((list) => (window as unknown as { ui: { showChoices(c: unknown): void } }).ui.showChoices(list), [CHECKPOINT, LETTER, LIST]);
    await page.waitForTimeout(150);
    expect(await expanded(page, CHECKPOINT.id), 'le choix actif (l\'arrivant) est déplié').toBe('true');
    expect(await shown(page, CHECKPOINT.id), 'ses options sont visibles et touchables sans clic').toEqual([true, true, true]);
    expect(await page.locator(`[data-choice="${LIST.id}"] [role="group"]`).isHidden(), 'le choix secondaire est replié').toBe(true);
  });
}
