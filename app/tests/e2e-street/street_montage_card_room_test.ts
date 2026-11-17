import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * MESURE de la carte de montage [plan semaine condensée T3 Step 1 bis, R-3, R-COND.2] aux 6 tailles de Cynthia : la carte (texte seul) avec le panneau
 * d'options ouvert à côté (temps `choice` de carte), puis la carte avec sa ligne de fin et la barre « Continuer ». Relevé : hauteur, défilement, police
 * calculée, recouvrement carte/panneau/barre. Deux jeux de textes : le PIRE (ligne S1 la plus longue des jours 2 et 3, fait B + source, fin la plus longue)
 * et le TYPIQUE (fait E, ligne courte). Les textes de carte réels sont ceux de T10 ; ces longueurs en sont des bornes. Table écrite dans MONTAGE_MEASURE_OUT.
 */
const fr = JSON.parse(readFileSync(new URL('../../src/data/strings/fr.json', import.meta.url), 'utf8')) as Record<string, string>;
const SIZES = [{ width: 960, height: 540 }, { width: 1280, height: 650 }, { width: 1366, height: 660 }, { width: 1440, height: 780 }, { width: 1512, height: 860 }, { width: 1920, height: 1080 }];
const POSTURE = 'Mardi et mercredi, tu as parlé comme lundi : peu.';
const TEXTS = {
  worst: { line: fr['w10.scene.j3.pylone.warn.me']!, fact: fr['w10.fact.B']!, source: fr['w10.fact.B.source']!, tail: fr['w10.msg.appointment']! },
  typical: { line: fr['w10.scene.j3.marlene.1']!, fact: fr['w10.fact.E']!, source: fr['w10.fact.E.source']!, tail: fr['w10.msg.patience']! },
} as const;
const OPTIONS = ['w10.choice.checkpoint.j2.comply', 'w10.choice.checkpoint.j2.buy.permission', 'w10.choice.checkpoint.j2.bypass', 'w10.choice.j2.component.hide'];

interface Probe { size: string; set: string; state: string; mode: string; cardH: number; scrollH: number; clientH: number; scrolls: boolean; fontPx: number; lineH: number; bodyH: number; overlapPanel: boolean; overlapBar: boolean; withinBand: boolean; cardBottom: number; barTop: number }
const rows: Probe[] = [];

for (const vp of SIZES) for (const set of ['worst', 'typical'] as const) {
  test(`test_montage_card_room_${vp.width}x${vp.height}_${set}`, async ({ page }) => {
    test.setTimeout(240_000);
    const out = await build({ entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text, css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
    await page.setViewportSize(vp);
    const band = Math.max(0, Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2));
    for (const state of ['choice', 'end'] as const) {
      await page.setContent('<body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body>');
      await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
      const t = TEXTS[set];
      await page.evaluate(({ state, band, fr, t, posture, options }) => {
        const dict: Record<string, string> = { ...fr, 'k.line': t.line, 'k.posture': posture, 'k.fact': t.fact, 'k.source': t.source, 'w10.msg.appointment': t.tail };
        const tr = (k: string, p?: Record<string, unknown>): string => (dict[k] ?? k).replace(/\{(\w+)\}/g, (_m, n: string) => String(p?.[n] ?? ''));
        const i18n = { t: tr, has: (k: string) => k in dict, onChange: () => () => undefined, lang: () => 'fr', setLang: () => undefined, tPlural: (k: string, c: number, p?: Record<string, unknown>) => tr(`${k}.${c === 1 ? 'one' : 'other'}`, p) };
        const w = window as unknown as { Ui: { mountUi: (h: HTMLElement, i: unknown, o: unknown) => unknown }; ui: Record<string, (...a: unknown[]) => void> };
        w.ui = w.Ui.mountUi(document.getElementById('host')!, i18n, { reducedMotion: true }) as typeof w.ui;
        w.ui['setBracelet']!(41); w.ui['setLetterboxBand']!(band); w.ui['showDayDate']!(3);
        const view = { day: 3, lineKeys: ['k.line'], postureKey: 'k.posture', fact: { key: 'k.fact', sourceKey: 'k.source' }, tail: state === 'end' ? { kind: 'palier', palier: 'appointment' } : null };
        w.ui['showMontage']!(view);
        if (state === 'choice') w.ui['showDestinations']!({ id: 'c.card', labelKey: options[0]!, blocksExit: false, priced: true, options: options.map((o: string, i: number) => ({ id: `o${i}`, labelKey: o, isRefusal: false, words: i })) });
        else w.ui['showContinue']!(true);
      }, { state, band, fr, t, posture: POSTURE, options: OPTIONS });
      await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.hasAttribute('data-zone-mode'));
      await page.waitForTimeout(200);
      const r = await page.evaluate(({ band }) => {
        const card = document.querySelector<HTMLElement>('[data-ui="montage"]')!;
        const cr = card.getBoundingClientRect(); const cs = getComputedStyle(card.querySelector('p')!);
        const panel = document.querySelector<HTMLElement>('[data-ui="choices"]'); const bar = document.querySelector<HTMLElement>('[data-ui="advance"]');
        const hit = (a: DOMRect, b: Element | null): boolean => { if (b === null || b.getBoundingClientRect().width === 0 || (b as HTMLElement).hidden) return false; const x = b.getBoundingClientRect(); return a.left < x.right && a.right > x.left && a.top < x.bottom && a.bottom > x.top; };
        const kids = [...card.children].map((k) => k.getBoundingClientRect());
        return {
          mode: document.querySelector<HTMLElement>('[data-ui="root"]')!.dataset['zoneMode'] ?? '', cardH: Math.round(cr.height), scrollH: card.scrollHeight, clientH: card.clientHeight, scrolls: card.scrollHeight > card.clientHeight + 0.5,
          fontPx: parseFloat(cs.fontSize), lineH: parseFloat(cs.lineHeight) || 0, bodyH: Math.round(kids.length === 0 ? 0 : Math.max(...kids.map((k) => k.bottom)) - cr.top),
          overlapPanel: hit(cr, panel), overlapBar: hit(cr, bar),
          withinBand: cr.top >= band - 0.5 && cr.bottom <= window.innerHeight - band + 0.5, cardBottom: Math.round(cr.bottom), barTop: bar === null || bar.hidden ? -1 : Math.round(bar.getBoundingClientRect().top),
        };
      }, { band });
      rows.push({ size: `${vp.width}x${vp.height}`, set, state, ...r });
    }
  });
}

test.afterAll(() => {
  const head = 'size | texts | state | mode | cardH | scrollH/clientH | scrolls | font px | line px | overlap panel | overlap bar | inside bands';
  const lines = rows.map((r) => `${r.size} | ${r.set} | ${r.state} | ${r.mode} | ${r.cardH} | ${r.scrollH}/${r.clientH} | ${r.scrolls} | ${r.fontPx} | ${r.lineH} | ${r.overlapPanel} | ${r.overlapBar} | ${r.withinBand}`);
  const table = [head, ...lines].join('\n');
  console.log(table);
  const outPath = process.env['MONTAGE_MEASURE_OUT'];
  if (outPath !== undefined) writeFileSync(outPath, table);
});

test('test_montage_card_never_overlaps_panel_or_bar_and_scrolls_only_at_960', () => {
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) {
    expect.soft(r.overlapPanel, `${r.size} ${r.set} ${r.state} : carte/panneau`).toBe(false);
    expect.soft(r.overlapBar, `${r.size} ${r.set} ${r.state} : carte/barre Continuer`).toBe(false);
    if (r.size !== '960x540') expect.soft(r.scrolls, `${r.size} ${r.set} ${r.state} : barre de défilement (R-COND.2)`).toBe(false);
  }
});
