import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { build } from 'esbuild';
import { usefulCrop } from '../../src/engine/view/caps';
import { LETTERBOX_ASPECT } from '../../src/street/render/pipeline';

/**
 * Zones d'écran de la rue [design/ui/2026-11-02-zones-ecran-ux.md, critères Z-1 à Z-9 sauf Z-3 et Z-7 (réplique : plan T8)].
 * Le VRAI `mountUi` et ses vraies feuilles, assemblés par esbuild, pilotés par son API publique (jamais d'injection DOM), en fr, vraies polices,
 * bandes 2,39:1 posées par `setLetterboxBand` avec la MÊME fonction que le runtime (`usefulCrop`), contenus les plus longs de fr.json.
 * `ZONES_SHOTS=<dossier>` écrit des captures de preuve.
 */
const MARGIN_REM = (JSON.parse(readFileSync('src/data/ui/zones.json', 'utf8')) as { marginRem: { v: number } }).marginRem.v;
const FR = JSON.parse(readFileSync('src/data/strings/fr.json', 'utf8')) as Record<string, string>;
const longest = (prefix: string, n = 1): string[] => Object.keys(FR).filter((k) => k.startsWith(prefix)).sort((a, b) => FR[b]!.length - FR[a]!.length || a.localeCompare(b)).slice(0, n);
const RIGHTS = Object.keys(FR).filter((k) => k.startsWith('w10.right.')).map((k) => k.slice('w10.right.'.length));
const LONGEST_RIGHT = longest('w10.right.')[0]!;
const LONGEST_CARD = longest('w10.card.')[0]!.slice('w10.card.'.length);
const NARRATION = longest('w10.street.')[0]!;
const DAY = Number(longest('w10.day.').find((k) => k.endsWith('.date'))!.split('.')[2]);
const OPTION_KEYS = longest('w10.price.', 18);
const GROUP_KEYS = longest('w10.choice.', 6);
const PRICE_KEY = longest('w10.price.inv.')[0]!;
/** Les éléments que Z-1 nomme ; la couche `fx` du bracelet couvre l'écran par construction et n'en fait pas partie. */
const NAMED = ['day-date', 'bracelet', 'narration', 'card', 'carnet', 'right-line', 'bubble', 'choices', 'controls', 'refusal'] as const;   // refusal : compté seul quand il vit hors du panneau (petit, Z-centre)
const NPC_LINE = longest('w10.npc.')[0]!;
const SIZES = [{ width: 1920, height: 1080, mode: 'large' }, { width: 1280, height: 720, mode: 'medium' }, { width: 960, height: 540, mode: 'small' }] as const;

interface Box { x: number; y: number; w: number; h: number }
let bundle: { js: string; css: string } | null = null;
async function assets(): Promise<{ js: string; css: string }> {
  if (bundle !== null) return bundle;
  const out = await build({
    stdin: {
      contents: "import { mountUi } from './src/street/ui'; import { createI18n } from './src/i18n/i18n'; import fr from './src/data/strings/fr.json'; import en from './src/data/strings/en.json'; import meta from './src/data/strings/meta.json'; (window as any).Z = { mountUi, i18n: () => createI18n({ fr, en } as any, meta as any, 'fr', { mode: 'dev', report: () => undefined }) };",
      resolveDir: '.', loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'],
  });
  bundle = { js: out.outputFiles.find((f) => f.path.endsWith('.js'))!.text, css: out.outputFiles.find((f) => f.path.endsWith('.css'))!.text };
  return bundle;
}

/** Monte l'interface et la remplit au pire cas : six groupes, une option désignée (prix, Confirmer), refus, tous les droits, fiche, ligne de droit, rappel. */
async function mountWorst(page: Page, vp: { width: number; height: number }, opts: { reduced?: boolean; narration?: boolean; rights?: number } = {}): Promise<number> {
  const { js, css } = await assets();
  await page.route('http://z.test/**', (r) => {
    const u = new URL(r.request().url()).pathname;
    if (u.startsWith('/fonts/')) return r.fulfill({ body: readFileSync(`public${u}`), contentType: 'font/woff2' });
    return r.fulfill({ body: '<!doctype html><html><body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body></html>', contentType: 'text/html' });
  });
  await page.setViewportSize(vp);
  await page.goto('http://z.test/');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  const band = usefulCrop(vp.width, vp.height, LETTERBOX_ASPECT).y;
  await page.evaluate((d) => {
    const Z = (window as unknown as { Z: { mountUi: (h: HTMLElement, i: unknown, o: unknown) => Record<string, (...a: unknown[]) => void>; i18n: () => unknown } }).Z;
    const ui = Z.mountUi(document.getElementById('host')!, Z.i18n(), { reducedMotion: d.reduced });
    (window as unknown as { ui: unknown }).ui = ui;
    ui['setLetterboxBand']!(d.band);
    ui['showDayDate']!(d.day); ui['setBracelet']!(60); if (d.narration !== null) ui['setNarration']!(d.narration);
    ui['showCarnet']!(d.rights);
    ui['showChoices']!(d.groups.map((g, i) => ({ id: `c${i}`, labelKey: g, blocksExit: false, options: d.options.slice(i * 3, i * 3 + 3).map((k, o) => ({ id: `o${o}`, labelKey: k, isRefusal: false, words: 0 })) })));
    ui['showControls']!(true);
    ui['showRightLine']!(d.line);
  }, { band, day: DAY, narration: opts.narration === false ? null : NARRATION, rights: RIGHTS.slice(0, opts.rights ?? RIGHTS.length), groups: GROUP_KEYS, options: OPTION_KEYS, line: { first: FR[LONGEST_RIGHT]!.slice(0, FR[LONGEST_RIGHT]!.indexOf('En 2026')).trim(), second: FR[LONGEST_RIGHT]!.slice(FR[LONGEST_RIGHT]!.indexOf('En 2026')).trim() }, reduced: opts.reduced ?? false });
  await page.locator('[data-choice="c0"] [data-option="o0"], [data-choice="c0"] .c-street-option').first().click();   // désigne : la ligne de prix et Confirmer apparaissent
  await page.evaluate((k) => {
    const ui = (window as unknown as { ui: Record<string, (...a: unknown[]) => void> }).ui;
    ui['showPrice']!({ choiceId: 'c0', optionId: 'o0', textKey: k, isRefusal: false, inventoryParams: {} });
  }, PRICE_KEY);
  await settle(page);
  return band;
}
const settle = async (page: Page): Promise<void> => { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const call = async (page: Page, name: string, ...args: unknown[]): Promise<void> => {
  await page.evaluate(([n, a]) => { (window as unknown as { ui: Record<string, (...x: unknown[]) => void> }).ui[n as string]!(...(a as unknown[])); }, [name, args] as const);
  await settle(page);
};

/** Boîtes des éléments nommés VISIBLES (affichés, non masqués, d'aire non nulle). */
async function visibleBoxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate((names) => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const n of names) {
      const e = document.querySelector<HTMLElement>(`[data-ui="root"] [data-ui="${n}"]`);
      if (e === null || e.closest('[hidden]') !== null) continue;
      if (n === 'refusal' && e.closest('[data-ui="choices"]') !== null) continue;   // dans le panneau, il est mesuré avec lui
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.checkVisibility?.() === false) continue;
      const r = e.getBoundingClientRect();
      if (r.width * r.height === 0) continue;
      out[n] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    return out;
  }, NAMED as readonly string[]);
}

/** Z-1 et Z-2 : boîtes deux à deux disjointes, chacune dans U moins m. */
async function checkZ1Z2(page: Page, vp: { width: number; height: number }, band: number, state: string): Promise<Record<string, Box>> {
  const boxes = await visibleBoxes(page);
  const m = MARGIN_REM * await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));   // m de l'UX §1, lu dans le jeton
  const eps = 0.5;
  const small = await page.locator('[data-ui="root"]').getAttribute('data-zone-mode') === 'small';
  for (const [n, b] of Object.entries(boxes)) {
    expect(b.x, `${state} : ${n} à m du bord gauche`).toBeGreaterThanOrEqual(m - eps);
    expect(b.x + b.w, `${state} : ${n} à m du bord droit`).toBeLessThanOrEqual(vp.width - m + eps);
    expect(b.y, `${state} : ${n} sous la bande haute, à m`).toBeGreaterThanOrEqual(band + m - eps);
    const floor = n === 'choices' && small ? 0 : m;   // petit : le panneau descend jusqu'au bas du cadre utile, jamais dans la bande [§7.3, tranché team-lead 2026-11-03]
    expect(b.y + b.h, `${state} : ${n} au-dessus de la bande basse, à ${floor} px`).toBeLessThanOrEqual(vp.height - band - floor + eps);
  }
  const names = Object.keys(boxes);
  for (let a = 0; a < names.length; a++) for (let c = a + 1; c < names.length; c++) {
    const p = boxes[names[a]!]!, q = boxes[names[c]!]!;
    const apart = p.x + p.w <= q.x + eps || q.x + q.w <= p.x + eps || p.y + p.h <= q.y + eps || q.y + q.h <= p.y + eps;
    expect(apart, `${state} : ${names[a]} et ${names[c]} ne se recouvrent pas`).toBe(true);
  }
  await checkLeftPriorities(page, state);
  await checkNoCutText(page, state);
  // prix, Confirmer et refus vivent DANS le panneau d'options (Z-droite)
  const inner = await page.evaluate(() => ['price', 'confirm', 'refusal'].map((n) => { const e = document.querySelector(`[data-ui="choices"] [data-ui="${n}"]`); return e === null ? null : e.getBoundingClientRect().toJSON() as DOMRect; }));
  if (boxes['choices']) for (const r of inner) if (r !== null && r.width > 0) { expect(r.x).toBeGreaterThanOrEqual(boxes['choices'].x - eps); expect(r.x + r.width).toBeLessThanOrEqual(boxes['choices'].x + boxes['choices'].w + eps); }
  return boxes;
}

/**
 * Aucune ligne de texte tranchée par un cadre qui défile ou masque (revue T9 4, I-1 et I-2) : chaque ligne est vue entière ou pas du tout.
 * L'intérieur du panneau d'options est mesuré aussi (impl-uic-6, 43e2ff0 : fenêtre du groupe en lignes entières).
 * Sous une rotation (la fiche), les boîtes écran sont gonflées : on y vérifie que la hauteur visible est un nombre entier d'interlignes.
 */
async function checkNoCutText(page: Page, state: string): Promise<void> {
  const cut = await page.evaluate(() => {
    const out: string[] = [];
    const turned = (e: Element): boolean => { for (let a: Element | null = e; a !== null; a = a.parentElement) if (getComputedStyle(a).transform !== 'none') return true; return false; };
    const walk = document.createTreeWalker(document.querySelector('[data-ui="root"]')!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
      const host = n.parentElement!; if ((n.textContent ?? '').trim() === '' || host.closest('.c-visually-hidden') !== null || !host.checkVisibility({ visibilityProperty: true }) || turned(host)) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        let top = r.top, bottom = r.bottom;
        for (let a = host as Element | null; a !== null && a !== document.body; a = a.parentElement) {
          if (getComputedStyle(a).overflowY === 'visible') continue;
          const c = a.getBoundingClientRect(); const ct = c.top + a.clientTop; top = Math.max(top, ct); bottom = Math.min(bottom, ct + a.clientHeight);
        }
        const seen = bottom - top;
        if (seen > 0.5 && seen < r.height - 1) out.push(`${host.closest('[data-ui]')?.getAttribute('data-ui')} « ${(n.textContent ?? '').trim().slice(0, 30)} » vu ${Math.round(seen)} / ${Math.round(r.height)} px`);
      }
    }
    // Z-14 : aucune ellipse, aucune narration réduite à une ligne
    if (document.querySelector('[data-zone-narration="line"]') !== null) out.push('narration réduite à une ligne');
    for (const e of document.querySelectorAll<HTMLElement>('[data-ui="root"] *')) if (getComputedStyle(e).textOverflow === 'ellipsis') out.push(`ellipse sur ${e.dataset['ui'] ?? e.className}`);
    // Z-11 : une fenêtre de texte uniforme qui défile a une hauteur multiple de l'interligne, à 1 px près
    for (const w of document.querySelectorAll<HTMLElement>('[data-ui="narration"] > .c-window')) {
      const lh = parseFloat(getComputedStyle(w).lineHeight);
      if (!Number.isFinite(lh)) { out.push(`narration : interligne non numérique`); continue; }
      const k = w.clientHeight / lh;
      if (w.scrollHeight > w.clientHeight + 0.5 && Math.abs(k - Math.round(k)) * lh > 1) out.push(`narration : fenêtre de ${w.clientHeight} px pour un interligne de ${lh} px`);
    }
    // Z-12 : le texte reste à au moins le remplissage du bord de sa carte (moitié de la ligne de droit, narration, carnet ; fiche par sa fenêtre)
    const frames = '[data-half], [data-ui="narration"], [data-ui="carnet"]';
    const walk2 = document.createTreeWalker(document.querySelector('[data-ui="root"]')!, NodeFilter.SHOW_TEXT);
    for (let n = walk2.nextNode(); n !== null; n = walk2.nextNode()) {
      const host = n.parentElement!; const f = host.closest<HTMLElement>(frames);
      if (f === null || (n.textContent ?? '').trim() === '' || !host.checkVisibility({ visibilityProperty: true }) || host.closest('[data-ui="choices"], button') !== null) continue;
      const cs = getComputedStyle(f), fr = f.getBoundingClientRect();
      const box = { l: fr.left + f.clientLeft + parseFloat(cs.paddingLeft), r: fr.left + f.clientLeft + f.clientWidth - parseFloat(cs.paddingRight) };
      // en hauteur : la carte de la ligne de droit est son cadre, qui porte le remplissage hors défilement
      const v = (host.closest<HTMLElement>('[data-ui="right-line"]') ?? f); const vs = getComputedStyle(v), vr = v.getBoundingClientRect();
      const top = vr.top + v.clientTop + parseFloat(vs.paddingTop), bottom = vr.top + v.clientTop + v.clientHeight - parseFloat(vs.paddingBottom);
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        let ct = r.top, cb = r.bottom;
        for (let a = host as Element | null; a !== null && a !== document.body; a = a.parentElement) { if (getComputedStyle(a).overflowY === 'visible') continue; const c = a.getBoundingClientRect(); ct = Math.max(ct, c.top + a.clientTop); cb = Math.min(cb, c.top + a.clientTop + a.clientHeight); }
        if (cb - ct <= 0.5) continue;   // ligne hors de la fenêtre
        if (r.left < box.l - 1 || r.right > box.r + 1 || r.top < top - 1 || r.bottom > bottom + 1) out.push(`${f.dataset['ui'] ?? 'moitié'} « ${(n.textContent ?? '').trim().slice(0, 24)} » collé au bord`);
      }
    }
    for (const c of document.querySelectorAll<HTMLElement>('[data-ui="card"]')) {
      const p = c.querySelector<HTMLElement>(':scope > p'); if (p === null) continue; const cs = getComputedStyle(c);
      if (p.offsetTop < parseFloat(cs.paddingTop) - 1 || p.offsetTop + p.offsetHeight > c.clientHeight - parseFloat(cs.paddingBottom) + 1) out.push('fiche : la fenêtre de texte touche le bord');
    }
    for (const p of document.querySelectorAll<HTMLElement>('[data-ui="card"] > p')) {
      const lh = parseFloat(getComputedStyle(p).lineHeight);
      if (!Number.isFinite(lh)) { out.push(`fiche : interligne non numérique (${getComputedStyle(p).lineHeight})`); continue; }
      if (p.scrollHeight > p.clientHeight + 0.5 && Math.abs(p.clientHeight / lh - Math.round(p.clientHeight / lh)) > 0.05) out.push(`fiche : ${p.clientHeight} px visibles pour un interligne de ${lh} px`);
    }
    return out;
  });
  expect(cut, `${state} : aucune ligne de texte tranchée`).toEqual([]);
}

/** §3 : dans Z-gauche, un élément plus bas ne reste jamais affiché pendant qu'un plus haut est réduit (rappel 9 < carnet 8 < narration 6 < fiche 4). */
async function checkLeftPriorities(page: Page, state: string): Promise<void> {
  const r = await page.evaluate(() => {
    const vis = (e: Element | null): boolean => e instanceof HTMLElement && e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().height > 0;
    const card = document.querySelector('[data-zone="left"] > [data-ui="card"]'); const p = card?.querySelector('p') ?? null;
    const carnet = document.querySelector<HTMLElement>('[data-zone="left"] > [data-ui="carnet"]');
    const more = carnet?.querySelector<HTMLElement>('[data-ui="carnet-more"]') ?? null;
    return {
      controls: vis(document.querySelector('[data-zone="left"] > [data-ui="controls"]')),
      narration: vis(document.querySelector('[data-zone="left"] > [data-ui="narration"]')),
      cardSqueezed: p !== null && vis(card) && p.scrollHeight > p.clientHeight + 0.5,
      carnetReduced: carnet !== null && carnet.dataset['state'] === 'full' && (carnet.dataset['room'] === 'none' || (more !== null && !more.hidden)),
    };
  });
  if (r.controls) { expect(r.carnetReduced, `${state} : le rappel (9) cède avant que le carnet (8) ne soit réduit`).toBe(false); expect(r.cardSqueezed, `${state} : le rappel cède avant la fiche`).toBe(false); }
  if (r.narration) expect(r.cardSqueezed, `${state} : la narration (6) cède avant que la fiche (4) ne soit réduite`).toBe(false);
}

/** Z-5 : chaque ligne visible du carnet est entière ; « + N » dit le nombre exact de droits non affichés. */
async function checkWholeLines(page: Page, state: string): Promise<{ visible: number; total: number; n: number | null }> {
  const r = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('[data-ui="carnet"]')!;
    const ul = c.querySelector('ul')!;
    const ub = ul.getBoundingClientRect(), cb = c.getBoundingClientRect();
    const padBottom = parseFloat(getComputedStyle(c).paddingBottom);
    const lis = [...ul.querySelectorAll('li')];
    const shown = lis.filter((li) => !li.hidden && li.getBoundingClientRect().height > 0);
    const more = c.querySelector<HTMLElement>('[data-ui="carnet-more"]')!;
    return {
      total: lis.length, visible: shown.length,
      cut: shown.filter((li) => li.getBoundingClientRect().bottom > ub.bottom + 0.5 || li.getBoundingClientRect().bottom > cb.bottom - padBottom + 0.5).length,
      more: more.hidden ? null : more.textContent,
    };
  });
  expect(r.cut, `${state} : aucune ligne du carnet coupée`).toBe(0);
  const n = r.more === null ? null : Number((r.more.match(/\d+/) ?? ['NaN'])[0]);
  if (r.visible < r.total) expect(n, `${state} : « + N » = total moins visibles`).toBe(r.total - r.visible);
  else expect(n, `${state} : tout tient, pas de « + N »`).toBeNull();
  return { visible: r.visible, total: r.total, n };
}

async function shot(page: Page, name: string): Promise<void> {
  if (process.env['ZONES_SHOTS']) await page.screenshot({ path: `${process.env['ZONES_SHOTS']}/${name}.png` });
}

for (const vp of SIZES) {
  const tag = `${vp.width}x${vp.height}`;
  test(`test_zones_worst_case_no_overlap_inside_useful_frame_${tag}`, async ({ page }) => {   // Z-1, Z-2, Z-4
    const band = await mountWorst(page, vp);
    expect(band, 'bandes posées').toBeGreaterThan(0);
    expect(await page.locator('[data-ui="root"]').getAttribute('data-zone-mode')).toBe(vp.mode);
    // A : fiche ouverte (le carnet se replie en une ligne), ligne de droit, six groupes, prix, Confirmer
    await call(page, 'showCard', LONGEST_CARD);
    await call(page, 'showRefusal', { act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'choiceClosed' });
    const a = await checkZ1Z2(page, vp, band, 'fiche ouverte');
    for (const n of ['day-date', 'bracelet', 'card', 'choices'] as const) expect(a[n], `fiche ouverte : ${n} visible`).toBeDefined();
    if (vp.mode === 'small') expect(a['right-line'], 'petit, fiche ouverte : la ligne de droit attend (Z-10)').toBeUndefined(); else expect(a['right-line'], 'fiche ouverte : right-line visible').toBeDefined();
    // la ligne repliée du carnet (8) n'est retirée que si la fiche (4) a pris toute la colonne
    if (vp.mode !== 'small') expect(a['carnet'], 'grand et moyen : la ligne repliée tient sous la fiche').toBeDefined();
    else if (a['carnet'] === undefined) expect(await page.locator('[data-ui="carnet"]').getAttribute('data-room'), 'petit : carnet absent faute de place seulement').toBe('none');
    const folded = await page.evaluate(() => { const c = document.querySelector<HTMLElement>('[data-ui="carnet"]')!; return { state: c.dataset['state'], list: c.querySelector('ul')!.hidden, fold: c.querySelector<HTMLElement>('[data-ui="carnet-fold"]')!.hidden, text: c.querySelector('[data-ui="carnet-fold"]')!.textContent }; });
    expect(folded, 'Z-4 : fiche ouverte, carnet en une ligne « Droits (N) »').toEqual({ state: 'folded', list: true, fold: false, text: expect.stringContaining(String(RIGHTS.length)) as unknown as string });
    await shot(page, `zones-${vp.width}-fiche`);
    // B : la fiche se ferme par Échap, qui ne ferme que la couche du dessus : le panneau d'options reste, le carnet revient
    await page.keyboard.press('Escape'); await settle(page);
    expect(await page.locator('[data-ui="card"]').count()).toBe(0);
    const b = await checkZ1Z2(page, vp, band, 'fiche fermée');
    expect(b['choices'], 'fiche fermée par Échap : le panneau d\'options reste').toBeDefined();
    expect(b['right-line'], 'fiche fermée : la ligne de droit reste').toBeDefined();
    if (vp.mode === 'large') { expect(b['carnet'], 'Z-4 : le carnet revient').toBeDefined(); expect(await page.locator('[data-ui="carnet"]').getAttribute('data-state')).toBe('full'); await checkWholeLines(page, 'fiche fermée'); }
    else expect(await page.locator('[data-ui="carnet"]').getAttribute('data-state'), 'moyen (§7.2.1, la narration passe avant) et petit : le carnet reste en une ligne').toBe('folded');
    await shot(page, `zones-${vp.width}-carnet`);
    // D : une réplique, la personne au milieu de Z-centre : la ligne de droit attend (Z-3), la bulle tient dans le centre (Z-1)
    const person = await page.evaluate(() => { const c = document.querySelector('[data-zone="centre"]')!.getBoundingClientRect(); return { x: c.x + c.width / 2 - c.width / 8, y: c.y + c.height / 3, w: c.width / 4, h: c.height / 2 }; });
    await page.evaluate(([k, r]) => {
      const ui = (window as unknown as { ui: Record<string, ((...a: unknown[]) => void) | undefined> }).ui;
      (ui['setSpeakerRect'] ?? ui['setPersonRect'])!(r);
      ui['showLine']!(k);
    }, [NPC_LINE, person] as const);
    await settle(page);
    const d = await checkZ1Z2(page, vp, band, 'réplique');
    expect(d['bubble'], 'réplique : la bulle est visible').toBeDefined();
    expect(d['right-line'], 'réplique : la ligne de droit attend (Z-3)').toBeUndefined();
    await shot(page, `zones-${vp.width}-replique`);
    await call(page, 'clearLine');
    await page.waitForFunction(() => document.querySelector('[data-ui="bubble"]') === null);
    expect((await visibleBoxes(page))['right-line'], 'réplique fermée : la ligne de droit revient').toBeDefined();
    // C : sans options
    await call(page, 'showChoices', []);
    await checkZ1Z2(page, vp, band, 'sans options');
    await shot(page, `zones-${vp.width}-sans-options`);
  });

  test(`test_zones_carnet_whole_lines_and_more_button_${tag}`, async ({ page }) => {   // Z-5, Z-6
    const band = await mountWorst(page, vp, vp.mode === 'medium' ? { narration: false } : {});   // en moyen, la narration replie le carnet (§7.2.1) : le « + N » se voit sans elle
    if (vp.mode === 'small') {
      // pire cas : la narration la plus longue (priorité 6) ne laisse pas la place de la ligne repliée ENTIÈRE, remplissage compris (priorité 8) : le carnet n'est pas affiché, il n'est pas coupé [§3]
      expect(await page.locator('[data-ui="carnet"]').getAttribute('data-room')).toBe('none');
      expect(await page.locator('[data-ui="carnet"]').evaluate((c) => c.checkVisibility({ visibilityProperty: true })), 'écarté = invisible, jamais coupé').toBe(false);
      return;
    }
    const r = await checkWholeLines(page, 'carnet plein');
    expect(r.n, 'pire cas : tous les droits ne tiennent pas, « + N » est montré').not.toBeNull();
    const more = page.locator('[data-ui="carnet-more"]');
    await more.click(); await settle(page);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator('[data-ui="carnet"] li:not([hidden])').count(), 'Z-6 : la liste complète dans l\'arbre').toBe(RIGHTS.length);
    await checkZ1Z2(page, vp, band, 'carnet déplié');                                  // déplié : il ne recouvre rien d'autre
    await shot(page, `zones-${vp.width}-carnet-deplie`);
    await page.keyboard.press('Escape'); await settle(page);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-ui')), 'focus rendu au bouton').toBe('carnet-more');
    await checkWholeLines(page, 'replié après Échap');
    // un seul droit : tout tient, pas de « + N »
    await call(page, 'showCarnet', [RIGHTS[0]]);
    await checkWholeLines(page, 'un droit');
  });

  test(`test_zones_carnet_reachable_without_narration_${tag}`, async ({ page }) => {   // Z-5, Z-6, sans narration : la place de la ligne repliée existe
    const band = await mountWorst(page, vp, { narration: false });
    if (vp.mode === 'small') {
      // petit : toujours replié ; le bouton le déplie en recouvrant Z-gauche seule, Échap referme et rend le focus
      const fold = page.locator('[data-ui="carnet-fold"]');
      await expect(fold).toBeVisible(); await fold.click(); await settle(page);
      await expect(fold).toHaveAttribute('aria-expanded', 'true');
      expect(await page.locator('[data-ui="carnet"] li:not([hidden])').count(), 'Z-6 : la liste complète dans l\'arbre').toBe(RIGHTS.length);
      const z = await page.evaluate(() => [document.querySelector('[data-zone="left"]')!.getBoundingClientRect().toJSON(), document.querySelector('[data-ui="carnet"]')!.getBoundingClientRect().toJSON()] as DOMRect[]);
      expect(z[1]!.x).toBeGreaterThanOrEqual(z[0]!.x - 0.5); expect(z[1]!.y).toBeGreaterThanOrEqual(z[0]!.y - 0.5);
      expect(z[1]!.x + z[1]!.width).toBeLessThanOrEqual(z[0]!.x + z[0]!.width + 0.5); expect(z[1]!.y + z[1]!.height).toBeLessThanOrEqual(z[0]!.y + z[0]!.height + 0.5);
      await shot(page, `zones-${vp.width}-carnet-deplie`);
      await page.keyboard.press('Escape'); await settle(page);
      await expect(fold).toHaveAttribute('aria-expanded', 'false');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-ui'))).toBe('carnet-fold');
      await checkZ1Z2(page, vp, band, 'replié après Échap');
      return;
    }
    await checkWholeLines(page, 'sans narration');
  });

  test(`test_zones_panel_never_covers_interlocutor_plus_margin_${tag}`, async ({ page }) => {   // Z-7 : I-3 rejoué aux trois tailles
    const band = await mountWorst(page, vp);
    const ui = JSON.parse(readFileSync('src/data/ui/theme.json', 'utf8')) as { street: { personMarginPx: { v: number }; referenceWidthPx: { v: number } } };
    const margin = (ui.street.personMarginPx.v * vp.width) / ui.street.referenceWidthPx.v;
    // la personne parlée là où le panneau irait : au milieu de la colonne de droite
    const person = await page.evaluate(() => { const c = document.querySelector<HTMLElement>('[data-ui="choices"]')!.getBoundingClientRect(); return { x: c.x + c.width / 3, y: c.y + c.height / 4, w: c.width / 3, h: c.height / 2 }; });
    await call(page, 'setInterlocutorRect', person); await settle(page);
    const b = await checkZ1Z2(page, vp, band, 'interlocuteur à droite');
    const panel = b['choices']!;
    expect(await page.locator('[data-ui="choices"]').getAttribute('data-side'), 'le panneau passe à gauche, les colonnes s\'échangent').toBe('left');
    const zone = { x: person.x - margin, y: person.y - margin, w: person.w + 2 * margin, h: person.h + 2 * margin };
    const hit = panel.x < zone.x + zone.w && zone.x < panel.x + panel.w && panel.y < zone.y + zone.h && zone.y < panel.y + panel.h;
    expect(hit, `panneau ${JSON.stringify(panel)} hors de la personne ${JSON.stringify(person)} + ${margin} px`).toBe(false);
    await shot(page, `zones-${vp.width}-interlocuteur`);
  });

  test(`test_zones_scrolled_windows_keep_whole_lines_and_margins_at_the_end_${tag}`, async ({ page }) => {   // Z-11, Z-12 au bas du défilement
    const band = await mountWorst(page, vp);
    await call(page, 'showCard', LONGEST_CARD);
    await page.evaluate(() => { for (const w of document.querySelectorAll<HTMLElement>('[data-ui="root"] .c-window, [data-ui="card"] > p')) w.scrollTop = w.scrollHeight; });
    await settle(page);
    await checkNoCutText(page, 'au bas du défilement');
    expect(band).toBeGreaterThan(0);
  });

  test(`test_zones_more_indicator_and_keyboard_scroll_${tag}`, async ({ page }) => {   // Z-13
    await mountWorst(page, vp);
    await call(page, 'showCard', LONGEST_CARD);
    const frames = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-ui="root"] .c-window, [data-ui="card"] > p')].map((w) => ({ more: w.scrollHeight > w.clientHeight + 0.5, flag: w.parentElement!.hasAttribute('data-more'), tab: w.tabIndex, ui: w.parentElement!.dataset['ui'] ?? '' })));
    for (const f of frames) { expect(f.flag, `${f.ui} : indicateur de suite si et seulement si la fenêtre ne montre pas tout`).toBe(f.more); if (f.more) expect(f.tab, `${f.ui} : fenêtre focalisable`).toBe(0); }
    const found = page.locator('[data-ui="root"] [data-more] > .c-window, [data-ui="card"][data-more] > p').first();
    if (await found.count() === 0) return;   // tout tient à cette taille : rien à faire défiler
    const scroller = (await found.elementHandle())!;   // tenue par l'élément : `data-more` tombe au bas du défilement
    await scroller.focus(); await page.keyboard.press('ArrowDown'); await settle(page);
    expect(await scroller.evaluate((w) => w.scrollTop), 'flèche bas : la fenêtre défile').toBeGreaterThan(0);
    await scroller.evaluate((w) => { w.scrollTop = w.scrollHeight; }); await settle(page);
    expect(await scroller.evaluate((w) => w.parentElement!.hasAttribute('data-more')), 'au bas du défilement, l\'indicateur disparaît').toBe(false);
  });

  test(`test_zones_text_at_least_18px_and_no_slow_fold_${tag}`, async ({ page }) => {   // Z-8
    await mountWorst(page, vp, { reduced: true });
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const e of document.querySelectorAll<HTMLElement>('[data-ui="root"] *')) {
        if (e.closest('[hidden], [aria-hidden="true"], .c-visually-hidden') !== null || e.checkVisibility?.() === false) continue;
        if (![...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')) continue;
        if (parseFloat(getComputedStyle(e).fontSize) < 18) out.push(`${e.dataset['ui'] ?? e.className} ${getComputedStyle(e).fontSize}`);
      }
      return out;
    });
    expect(small, 'aucun texte lu sous 18 px').toEqual([]);
    const ms = JSON.parse(readFileSync('src/data/ui/zones.json', 'utf8')).foldMaxMs.v as number;
    const slow = await page.evaluate((max) => [...document.querySelectorAll<HTMLElement>('[data-zone] *, [data-zone]')].filter((e) => getComputedStyle(e).transitionDuration.split(',').some((d) => parseFloat(d) * 1000 > max)).map((e) => e.dataset['ui'] ?? e.tagName), ms);
    expect(slow, `repli et dépli en ${ms} ms au plus`).toEqual([]);
  });
}

test.describe('Z-9 : 200 % de zoom (1920 x 1080 vu à 960 x 540, facteur 2)', () => {
  test.use({ deviceScaleFactor: 2 });
  test('test_zones_worst_case_no_overlap_at_zoom_200', async ({ page }) => {
    const vp = { width: 960, height: 540 };
    const band = await mountWorst(page, vp);
    expect(await page.locator('[data-ui="root"]').getAttribute('data-zone-mode')).toBe('small');
    await call(page, 'showCard', LONGEST_CARD);
    await checkZ1Z2(page, vp, band, 'zoom 200 %, fiche');
    await page.locator('[data-ui="card"]').click(); await settle(page);
    await checkZ1Z2(page, vp, band, 'zoom 200 %, sans fiche');
    await shot(page, 'zones-zoom200');
  });
});

test('test_zones_small_right_line_waits_for_the_card_then_returns_whole', async ({ page }) => {   // Z-10
  await mountWorst(page, { width: 960, height: 540 });
  const text = await page.locator('[data-ui="right-line"]').innerText();
  await call(page, 'showCard', LONGEST_CARD);
  expect(await page.locator('[data-ui="right-line"]').count(), 'fiche ouverte en petit : la ligne de droit attend').toBe(0);
  await page.locator('[data-ui="card"]').click(); await settle(page);
  expect(await page.locator('[data-ui="right-line"]').innerText(), 'fiche fermée : la même ligne revient').toBe(text);
});

test('test_zones_small_price_closes_the_card_so_the_right_line_passes_first', async ({ page }) => {   // Z-10 et décision game-designer
  await mountWorst(page, { width: 960, height: 540 });
  await call(page, 'showCard', LONGEST_CARD);
  const k = longest('w10.right.', 2)[1]!;
  await call(page, 'showRightLine', { first: FR[k]!.split('En 2026')[0]!.trim(), second: `En 2026${FR[k]!.split('En 2026')[1] ?? ''}`.trim() });
  expect(await page.locator('[data-ui="right-line"]').count()).toBe(0);
  await call(page, 'showPrice', { choiceId: 'c0', optionId: 'o0', textKey: PRICE_KEY, isRefusal: false, inventoryParams: {} });
  await settle(page);
  expect(await page.locator('[data-ui="card"]').count(), 'le prix (priorité 1) ferme la fiche (4)').toBe(0);
  await expect(page.locator('[data-ui="right-line"]')).toContainText(FR[k]!.split('En 2026')[0]!.trim().slice(0, 20));
  await expect(page.locator('[data-ui="price"]')).toBeVisible();
});

test('test_zones_medium_narration_whole_carnet_folded_help_hidden', async ({ page }) => {   // Z-15
  await mountWorst(page, { width: 1280, height: 720 }, { rights: 4 });
  await shot(page, 'zones-1280-narration');
  const n = page.locator('[data-ui="narration"]');
  await expect(n).toBeVisible();
  expect(await n.evaluate((e) => { const w = e.querySelector<HTMLElement>('.c-window') ?? e; return w.scrollHeight <= w.clientHeight + 0.5; }), 'narration entière').toBe(true);
  expect(await page.locator('[data-ui="carnet"]').getAttribute('data-state'), 'carnet en ligne « Droits (N) »').toBe('folded');
  await expect(page.locator('[data-ui="controls"]')).toBeHidden();
  await checkNoCutText(page, 'Z-15');
});

test('test_zones_medium_narration_waits_for_the_card_then_returns_whole', async ({ page }) => {   // Z-16
  await mountWorst(page, { width: 1280, height: 720 });
  await call(page, 'showCard', LONGEST_CARD);
  await shot(page, 'zones-1280-fiche-narration');
  expect(await page.locator('[data-ui="root"]').getAttribute('data-zone-narration'), 'fiche ouverte, la narration ne tient pas : elle attend').toBe('wait');
  await page.locator('[data-ui="card"]').click(); await settle(page);
  expect(await page.locator('[data-ui="root"]').getAttribute('data-zone-narration')).toBe('full');
  await expect(page.locator('[data-ui="narration"]')).toBeVisible();
  await checkNoCutText(page, 'Z-16, fiche fermée');
});

test('test_zones_one_escape_closes_only_the_top_layer', async ({ page }) => {   // re-relecture 4, mineur : un Échap, une couche
  await mountWorst(page, { width: 1920, height: 1080 }, { narration: false });   // en grand, la ligne « Droits (N) » tient sous la fiche
  await call(page, 'showCard', LONGEST_CARD);
  // carnet déplié par-dessus la fiche : Échap referme le carnet seul
  await page.locator('[data-ui="carnet-fold"]').click(); await settle(page);
  await expect(page.locator('[data-ui="carnet-fold"]')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape'); await settle(page);
  await expect(page.locator('[data-ui="carnet-fold"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-ui="card"]'), 'la fiche reste après le premier Échap').toHaveCount(1);
  // fiche au-dessus du panneau : Échap ferme la fiche seule
  await page.keyboard.press('Escape'); await settle(page);
  await expect(page.locator('[data-ui="card"]')).toHaveCount(0);
  await expect(page.locator('[data-ui="choices"]'), 'le panneau d\'options reste après le deuxième Échap').toBeVisible();
  // réplique au-dessus du panneau : Échap ferme la réplique seule
  await call(page, 'showLine', NPC_LINE);
  await expect(page.locator('[data-ui="bubble"]')).toHaveCount(1);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelector('[data-ui="bubble"]') === null);
  await expect(page.locator('[data-ui="choices"]'), 'le panneau reste après la réplique').toBeVisible();
  // dernier Échap : le panneau se ferme
  await page.keyboard.press('Escape'); await settle(page);
  await expect(page.locator('[data-ui="choices"] [data-option]')).toHaveCount(0);
});

test('test_zones_medium_full_carnet_with_open_options', async ({ page }) => {   // re-relecture 4 : carnet plein ET options ouvertes en 1280
  const vp = { width: 1280, height: 720 };
  const band = await mountWorst(page, vp, { narration: false });
  expect(await page.locator('[data-ui="carnet"]').getAttribute('data-state'), 'sans narration, le carnet est plein').toBe('full');
  const boxes = await checkZ1Z2(page, vp, band, 'carnet plein, options ouvertes');
  for (const n of ['carnet', 'choices', 'right-line'] as const) expect(boxes[n], `${n} visible`).toBeDefined();
  await expect(page.locator('[data-ui="price"]')).toBeVisible();
  await checkWholeLines(page, 'carnet plein, options ouvertes');
  await shot(page, 'zones-1280-carnet-plein-options');
});

test('test_zones_small_card_closed_by_the_price_reopens_in_one_click', async ({ page }) => {   // décision team-lead 2026-11-03 : le prix ferme la fiche, elle se rouvre d'un geste
  await mountWorst(page, { width: 960, height: 540 });
  await call(page, 'showCard', LONGEST_CARD);
  const k = longest('w10.right.', 2)[1]!;
  await call(page, 'showRightLine', { first: FR[k]!.split('En 2026')[0]!.trim(), second: `En 2026${FR[k]!.split('En 2026')[1] ?? ''}`.trim() });   // une ligne de droit due : le prix ferme la fiche
  await call(page, 'showPrice', { choiceId: 'c0', optionId: 'o0', textKey: PRICE_KEY, isRefusal: false, inventoryParams: {} });
  await expect(page.locator('[data-ui="card"]')).toHaveCount(0);
  // le clic sur le porteur repasse par `resolveClick`, sans état : il rend la même fiche (test unitaire interactions) ; ici l'interface la rouvre
  await call(page, 'showCard', LONGEST_CARD);
  await expect(page.locator('[data-ui="card"]')).toHaveCount(1);
  await expect(page.locator('[data-ui="price"]'), 'le prix reste montré').toBeVisible();
  await checkNoCutText(page, 'fiche rouverte');
});

test('test_zones_small_refusal_lives_in_centre_without_overlap', async ({ page }) => {   // §7.3 point 2, tranché team-lead 2026-11-03
  const vp = { width: 960, height: 540 };
  const band = await mountWorst(page, vp);
  await call(page, 'showRefusal', { act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'choiceClosed' });
  const boxes = await checkZ1Z2(page, vp, band, 'refus en Z-centre');
  expect(boxes['refusal'], 'le refus est visible hors du panneau').toBeDefined();
  const c = await page.evaluate(() => document.querySelector('[data-zone="centre"]')!.getBoundingClientRect().toJSON() as DOMRect);
  const r = boxes['refusal']!;
  expect(r.x).toBeGreaterThanOrEqual(c.x - 0.5); expect(r.x + r.w).toBeLessThanOrEqual(c.x + c.width + 0.5);
  expect(r.y).toBeGreaterThanOrEqual(c.y - 0.5); expect(r.y + r.h).toBeLessThanOrEqual(c.y + c.height + 0.5);
  await shot(page, 'zones-960-refus-centre');
  // une réplique arrive : la bulle tient dans Z-centre sans recouvrir le refus
  const person = await page.evaluate(() => { const z = document.querySelector('[data-zone="centre"]')!.getBoundingClientRect(); return { x: z.x + z.width / 2 - z.width / 8, y: z.y + z.height / 3, w: z.width / 4, h: z.height / 2 }; });
  await page.evaluate(([k, p]) => { const ui = (window as unknown as { ui: Record<string, (...a: unknown[]) => void> }).ui; ui['setSpeakerRect']!(p); ui['showLine']!(k); }, [NPC_LINE, person] as const);
  await settle(page);
  const d = await checkZ1Z2(page, vp, band, 'refus et réplique');
  expect(d['refusal'], 'le refus (priorité 1) reste').toBeDefined();
  await shot(page, 'zones-960-refus-replique');
});

test('test_zones_small_panel_reaches_the_bottom_of_the_useful_frame', async ({ page }) => {   // §7.3 point 1, tranché team-lead 2026-11-03
  const vp = { width: 960, height: 540 };
  const band = await mountWorst(page, vp);
  const b = (await visibleBoxes(page))['choices']!;
  expect(Math.abs(b.y + b.h - (vp.height - band)), `bas du panneau ${b.y + b.h} contre bas du cadre utile ${vp.height - band}`).toBeLessThanOrEqual(1);
});

test('test_zones_small_carnet_hidden_when_the_narration_leaves_no_room_960x540', async ({ page }) => {   // le cas serré, construit : une narration quatre fois plus longue ne laisse pas la place de la ligne repliée
  const vp = { width: 960, height: 540 };
  await mountWorst(page, vp);
  await page.evaluate(() => {
    const ui = (window as unknown as { ui: Record<string, (...a: unknown[]) => void> }).ui;
    const long = document.querySelector<HTMLElement>('[data-ui="narration"] .c-window')!;
    long.textContent = `${long.textContent} `.repeat(4).trim();
    void ui;
  });
  await settle(page);
  const m = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('[data-ui="carnet"]')!;
    const more = c.querySelector<HTMLElement>('[data-ui="carnet-more"]');
    return { room: c.dataset['room'] ?? null, vis: c.checkVisibility({ visibilityProperty: true }), moreVisible: more !== null && more.checkVisibility({ visibilityProperty: true }) };
  });
  expect(m.room, 'pas de place : le carnet est écarté').toBe('none');
  expect(m.vis, 'écarté = invisible, jamais coupé').toBe(false);
  expect(m.moreVisible, '« + N » ne reste pas visible sur un carnet écarté').toBe(false);
});

test('test_zones_small_folded_carnet_is_one_whole_line_with_its_padding_960x540', async ({ page }) => {   // sans narration, la place existe : « Droits (N) › » tient sur UNE ligne entière, remplissage de 24 px compris
  await mountWorst(page, { width: 960, height: 540 }, { narration: false });
  expect(await page.locator('[data-ui="carnet"]').getAttribute('data-room'), 'sans narration, le carnet replié a de la place').toBeNull();
  const m = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('[data-ui="carnet"]')!, z = document.querySelector<HTMLElement>('[data-zone="left"]')!;
    const cs = getComputedStyle(c), cr = c.getBoundingClientRect(), zr = z.getBoundingClientRect();
    const b = c.querySelector<HTMLElement>('[data-ui="carnet-fold"]')!.getBoundingClientRect();
    return { text: c.textContent ?? '', vis: c.checkVisibility({ visibilityProperty: true }), lh: parseFloat(cs.lineHeight), bh: b.height, padTop: b.top - cr.top - c.clientTop, padBottom: cr.bottom - c.clientTop - b.bottom, inside: cr.top >= zr.top - 0.5 && cr.bottom <= zr.bottom + 0.5, pad: parseFloat(cs.paddingTop) };
  });
  expect(m.vis, 'le carnet replié est visible').toBe(true);
  expect(m.text, 'il donne le nombre de droits').toMatch(new RegExp(`\\(${RIGHTS.length}\\)`));
  expect(Math.abs(m.bh - m.lh), 'une seule ligne').toBeLessThan(1);
  expect(m.padTop, 'remplissage haut entier').toBeGreaterThanOrEqual(m.pad - 0.5);
  expect(m.padBottom, 'remplissage bas entier (la ligne n\'est pas serrée)').toBeGreaterThanOrEqual(m.pad - 0.5);
  expect(m.inside, 'le carnet tient dans Z-gauche').toBe(true);
});
