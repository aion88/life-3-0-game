import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
const frJson = JSON.parse(readFileSync(new URL('../../src/data/strings/fr.json', import.meta.url), 'utf8')) as Record<string, string>;

/**
 * Panneau de choix de la rue : tous les boutons restent atteignables à 1280x720 et 1920x1080 [plan 02a T13-fix].
 * Mesure en navigateur (jsdom n'a pas de mise en page) : le VRAI `mountUi` et le VRAI `ui.css`, assemblés par esbuild, six choix de trois
 * options (la forme mesurée par T13 : 1 233 px de haut). Un bouton « atteignable » est un bouton qui, une fois le focus clavier posé dessus
 * (le navigateur le fait défiler dans le panneau), a sa boîte entière dans le viewport ET dans la boîte du panneau.
 */
// la ligne de prix la plus longue du jeu (fr.json) et le refus le plus long : les e2e de mise en page ne se contentent pas d'une ligne fictive
const PRICE = Object.entries(frJson).filter(([k]) => k.startsWith('w10.price.')).map(([, v]) => v).sort((a, b) => b.length - a.length)[0]!;
const LONG = 'Une phrase de libellé assez longue pour passer à la ligne dans un panneau de vingt-quatre rem de large.';

test.describe('rue : panneau de choix', () => {
  for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 960, height: 540 }]) {
    test(`test_choice_panel_every_button_inside_viewport_at_${vp.width}x${vp.height}`, async ({ page }) => {
      const out = await build({
        entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'],   // les polices viennent de /fonts/ au runtime [UI-C T2]
      });
      const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
      const css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
      await page.setViewportSize(vp);
      await page.setContent('<!doctype html><body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body>');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: js });
      await page.evaluate((long) => {
        const i18n = { t: (k: string) => (k.startsWith('choice') ? k : `${k} ${long}`), has: () => false, onChange: () => () => undefined, lang: () => 'fr', setLang: () => undefined, tPlural: (k: string) => `${k} ${long}` };
        const choices = Array.from({ length: 6 }, (_, c) => ({
          id: `c${c}`, labelKey: `choice${c}`, blocksExit: false,
          options: Array.from({ length: 3 }, (_, o) => ({ id: `o${o}`, labelKey: `option${c}${o}`, isRefusal: false, words: 0 })),
        }));
        const ui = (window as unknown as { Ui: { mountUi: (h: HTMLElement, i: unknown) => { showChoices: (c: unknown) => void } } }).Ui;
        ui.mountUi(document.getElementById('host')!, i18n).showChoices(choices);
      }, LONG);

      const panel = page.locator('[data-ui="choices"]');
      const pb = (await panel.boundingBox())!;
      expect(pb.y, 'le panneau ne déborde pas par le haut').toBeGreaterThanOrEqual(0);
      expect(pb.y + pb.height, 'ni par le bas').toBeLessThanOrEqual(vp.height);

      // Option C : six groupes, un seul déplié. En-têtes complets : six en-têtes plus trois options. Condensé (rangée « + N », AR-12) : l'en-tête déplié, « + N » et trois options.
      // Chacun des six groupes, déplié à son tour (par la liste en mode condensé), offre ses boutons dans l'écran et le panneau.
      const condensed = (await panel.getAttribute('data-condensed')) !== null;
      const expected = condensed ? 5 : 9;
      expect(await page.locator('[data-ui="choices"] button:visible').count()).toBe(expected);
      for (let g = 0; g < 6; g++) {
        if (condensed) await page.locator('[data-ui="more-groups"]').click();
        await page.locator(`[data-choice="c${g}"] [data-ui="choice-name"]`).click();
        const buttons = page.locator('[data-ui="choices"] button:visible');
        const n = await buttons.count();
        expect(n, `groupe ${g} : en-têtes et trois options`).toBe(expected);
        for (let i = 0; i < n; i++) {
          await buttons.nth(i).focus();
          const bx = (await buttons.nth(i).boundingBox())!;
          const p = (await panel.boundingBox())!;
          const where = `groupe ${g}, bouton ${i}`;
          expect(bx.y, `${where} : haut dans le viewport`).toBeGreaterThanOrEqual(0);
          expect(bx.y + bx.height, `${where} : bas dans le viewport`).toBeLessThanOrEqual(vp.height);
          expect(bx.y, `${where} : haut dans le panneau`).toBeGreaterThanOrEqual(p.y);
          expect(bx.y + bx.height, `${where} : bas dans le panneau`).toBeLessThanOrEqual(p.y + p.height);
          await buttons.nth(i).click({ trial: true, timeout: 2000 });   // cliquable à la souris : rien ne le recouvre, il est dans l'écran
        }
      }
    });
  }

  // Revue T6 : au checkpoint (sept options) le panneau ne couvre pas le bracelet et le refus système reste entièrement visible ; Confirmer se clique depuis l'état désigné.
  const CHECKPOINT = ['comply', 'buy.permission', 'buy.bons', 'buy.component', 'bypass', 'courtesy', 'refuse'];
  for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 960, height: 540 }]) {
    test(`test_checkpoint_panel_clears_bracelet_and_refusal_is_fully_visible_at_${vp.width}x${vp.height}`, async ({ page }) => {
      await openUi(page, vp);
      await page.evaluate((opts) => {
        const w = window as unknown as { ui: { setBracelet(n: number): void; showChoices(c: unknown): void; showRefusal(r: unknown): void } };
        w.ui.setBracelet(41);
        w.ui.showChoices([{ id: 'checkpoint.j1', labelKey: 'x', blocksExit: false, options: opts.map((o) => ({ id: o, labelKey: o, isRefusal: o === 'refuse', words: o === 'comply' ? 14 : 0 })) }]);
        w.ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'checkpoint.j1', minute: 450 }, reason: 'exitBlocked' });
      }, CHECKPOINT);
      const panel = (await page.locator('[data-ui="choices"]').boundingBox())!;
      const bracelet = (await page.locator('[data-ui="bracelet"]').boundingBox())!;
      const disjoint = panel.x + panel.width <= bracelet.x || bracelet.x + bracelet.width <= panel.x || panel.y + panel.height <= bracelet.y || bracelet.y + bracelet.height <= panel.y;
      expect(disjoint, `panneau ${JSON.stringify(panel)} contre bracelet ${JSON.stringify(bracelet)}`).toBe(true);
      const r = (await page.locator('[data-ui="refusal"]').boundingBox())!;
      expect(r.y, 'refus : haut visible').toBeGreaterThanOrEqual(panel.y);
      expect(r.y + r.height, 'refus : bas dans le viewport').toBeLessThanOrEqual(vp.height);
      expect(r.x + r.width, 'refus : droite dans le viewport').toBeLessThanOrEqual(vp.width);
      expect(r.y + r.height, 'refus : bas dans le panneau').toBeLessThanOrEqual(panel.y + panel.height + 1);
      // la cible du refus reçoit bien le point : rien ne le recouvre
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-ui="refusal"]') !== null, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
      expect(hit, 'le refus est au premier plan').toBe(true);
    });

    test(`test_confirm_clickable_from_the_designated_state_at_${vp.width}x${vp.height}`, async ({ page }) => {
      await openUi(page, vp);
      await page.evaluate((opts) => {
        const w = window as unknown as { gestures: string[]; ui: { onGesture(cb: (e: { gesture: string; optionId: string | null }) => void): void; showChoices(c: unknown): void; showPrice(p: unknown): void } };
        w.gestures = [];
        w.ui.onGesture((e) => { w.gestures.push(`${e.gesture}:${e.optionId}`); });
        w.ui.showChoices([{ id: 'checkpoint.j1', labelKey: 'x', blocksExit: false, options: opts.map((o) => ({ id: o, labelKey: o, isRefusal: o === 'refuse', words: 0 })) }]);
      }, CHECKPOINT);
      await page.locator('[data-option="bypass"]').click();
      await page.evaluate(() => (window as unknown as { ui: { showPrice(p: unknown): void } }).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: 'bypass', textKey: 'price', isRefusal: false, inventoryParams: {} }));
      const confirm = page.locator('[data-ui="confirm"]');
      await confirm.click({ timeout: 2000 });                        // clic réel : rien ne le recouvre, il défile dans le panneau au besoin
      const got = await page.evaluate(() => (window as unknown as { gestures: string[] }).gestures);
      expect(got).toEqual(['designate:bypass', 'confirm:bypass']);
      const b = (await confirm.boundingBox())!;
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    });
  }

  // A-9 [spec choix simultanés §3.5] : sept groupes (pire cas mesuré, A-1), bandes 2,39:1 posées comme au runtime ; 960x540 vaut 200 % de zoom sur 1920x1080.
  const WORST = ['checkpoint.j1', 'j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'permit.j1'];
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }]) {
    test(`test_seven_groups_stay_in_the_useful_frame_with_confirm_visible_at_${vp.width}x${vp.height}`, async ({ page }) => {
      await openUi(page, vp);
      const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);   // `usefulCrop(w, h, 2.39).y`
      await page.evaluate(({ ids, band }) => {
        const w = window as unknown as { ui: { setBracelet(n: number): void; setLetterboxBand(px: number): void; showChoices(c: unknown): void; showPrice(p: unknown): void } };
        w.ui.setBracelet(41); w.ui.setLetterboxBand(band);
        w.ui.showChoices(ids.map((id, c) => ({ id, labelKey: `Choix ${c}`, blocksExit: false, options: Array.from({ length: c === 0 ? 7 : 3 }, (_, o) => ({ id: `o${o}`, labelKey: `Une option ${c}.${o}`, isRefusal: false, words: 1 + o })) })));
      }, { ids: WORST, band });
      await page.locator('[data-choice="checkpoint.j1"] [data-option="o6"]').click();
      await page.evaluate(() => (window as unknown as { ui: { showPrice(p: unknown): void } }).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: 'o6', textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} }));
      const panel = (await page.locator('[data-ui="choices"]').boundingBox())!;
      expect(panel.y, 'le panneau reste hors de la bande haute').toBeGreaterThanOrEqual(band - 1);
      expect(panel.y + panel.height, 'le panneau reste hors de la bande basse').toBeLessThanOrEqual(vp.height - band + 1);
      const bracelet = (await page.locator('[data-ui="bracelet"]').boundingBox())!;
      expect(panel.y >= bracelet.y + bracelet.height || panel.x >= bracelet.x + bracelet.width, 'panneau et bracelet disjoints').toBe(true);
      // à 960 x 540 le panneau mesure 210 px : l'option désignée et son pied ne tiennent pas ensemble ; la ligne de prix et Confirmer l'emportent (limite mesurée)
      for (const sel of ['[data-choice="checkpoint.j1"] [data-option="o6"]', '[data-ui="price"]', '[data-ui="confirm"]'].filter((x) => vp.height > 760 || !x.includes('data-option'))) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(b.y, `${sel} : dans le panneau (haut)`).toBeGreaterThanOrEqual(panel.y - 1);
        // à 960 le prix défile sous l'option collée [AR-1] : son bas peut sortir de la zone, son haut non
        if (vp.height > 540 || sel !== '[data-ui="price"]') expect(b.y + b.height, `${sel} : dans le panneau (bas), sans défiler le panneau`).toBeLessThanOrEqual(panel.y + panel.height + 1);
      }
      // sept en-têtes complets, ou (AR-12) la rangée condensée : l'en-tête déplié et « + 6 » ; toutes les cibles font 44 px au moins
      const heads = page.locator('[data-ui="choice-name"]:visible, [data-ui="more-groups"]:visible');
      const condensed = (await page.locator('[data-ui="choices"]').getAttribute('data-condensed')) !== null;
      expect(await heads.count(), condensed ? 'un en-tête et « + N »' : 'sept en-têtes').toBe(condensed ? 2 : 7);
      for (let i = 0; i < (await heads.count()); i++) { const h = (await heads.nth(i).boundingBox())!; expect(h.height, `en-tête ${i} : cible d'au moins 44 px`).toBeGreaterThanOrEqual(44); }
      const sizes = await page.locator('[data-ui="choices"] button:visible').evaluateAll((bs) => bs.map((b) => parseFloat(getComputedStyle(b).fontSize)));
      expect(Math.min(...sizes), 'texte d\'au moins 18 px').toBeGreaterThanOrEqual(18);
    });
  }

  // Intérieur du panneau [zones d'écran Z-1] : six groupes, option désignée + ligne de prix + Confirmer + refus, tout ce qui est visible est disjoint deux à deux
  // (8 px de tolérance : l'option désignée est tournée) et contenu dans le panneau, aux trois tailles.
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }]) {
    test(`test_panel_inner_boxes_are_disjoint_and_inside_the_panel_at_${vp.width}x${vp.height}`, async ({ page }) => {
      await openUi(page, vp);
      const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);
      await page.evaluate(({ band }) => {
        const w = window as unknown as { ui: { setLetterboxBand(px: number): void; showChoices(c: unknown): void; showPrice(p: unknown): void; showRefusal(r: unknown): void } };
        w.ui.setLetterboxBand(band);
        w.ui.showChoices(Array.from({ length: 6 }, (_, c) => ({ id: `c${c}`, labelKey: `Choix ${c}`, blocksExit: false, options: Array.from({ length: c === 0 ? 7 : 3 }, (_, o) => ({ id: `o${o}`, labelKey: `Une option ${c}.${o}`, isRefusal: false, words: 1 + o })) })));
      }, { band });
      await page.locator('[data-choice="c0"] [data-option="o3"]').click();
      await page.evaluate(() => {
        const w = window as unknown as { ui: { showPrice(p: unknown): void; showRefusal(r: unknown): void } };
        w.ui.showPrice({ choiceId: 'c0', optionId: 'o3', textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} });
        w.ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'exitBlocked' });
      });
      const panel = (await page.locator('[data-ui="choices"]').boundingBox())!;
      const boxes = await page.evaluate(() => {
        const p = document.querySelector('[data-ui="choices"]')!.getBoundingClientRect();
        // ce que le défilement laisse voir : la boîte, rognée par chaque ancêtre qui défile ou masque, doit garder au moins la moitié de sa hauteur
        const seen = (e: Element): { top: number; bottom: number } | null => {
          const r = e.getBoundingClientRect(); if (r.height === 0 || e.closest('[hidden]') !== null) return null;
          let top = Math.max(r.top, p.top), bottom = Math.min(r.bottom, p.bottom);
          for (let a = e.parentElement; a !== null && a !== document.body; a = a.parentElement) {
            if (getComputedStyle(a).overflowY === 'visible') continue;
            const c = a.getBoundingClientRect(); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom);
          }
          return bottom - top >= r.height / 2 ? { top, bottom } : null;   // la boîte rognée : ce qui dépasse d'un ancêtre qui défile n'est pas à l'écran
        };
        const out: { n: string; x: number; y: number; w: number; h: number }[] = [];
        for (const [n, sel] of [['en-tête', '[data-ui="choice-name"]'], ['option désignée', '[aria-pressed="true"]'], ['ligne de prix', '[data-ui="price"]'], ['Confirmer', '[data-ui="confirm"]'], ['refus', '[data-ui="refusal"]']] as const)
          document.querySelectorAll(sel).forEach((e, i) => { const v = seen(e); if (v !== null) { const r = e.getBoundingClientRect(); out.push({ n: `${n} ${i}`, x: r.x, y: v.top, w: r.width, h: v.bottom - v.top }); } });
        return out;
      });
      const names = boxes.map((b) => b.n);
      expect(names.some((n) => n.startsWith('refus')), 'le refus est visible').toBe(true);
      expect(names.some((n) => n.startsWith('Confirmer')), 'Confirmer est visible').toBe(true);
      const T = 8;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const ov = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        expect(ov > T && ox > 0, `${a.n} chevauche ${b.n} de ${Math.round(ov)} px`).toBe(false);
      }
      for (const b of boxes.filter((x) => x.n.startsWith('refus') || x.n.startsWith('Confirmer'))) {
        expect(b.y, `${b.n} : haut dans le panneau`).toBeGreaterThanOrEqual(panel.y - 1);
        expect(b.y + b.h, `${b.n} : bas dans le panneau`).toBeLessThanOrEqual(panel.y + panel.height + 1);
      }
    });
  }

  // Constat 30 : les en-têtes ne défilent jamais, seul le corps du groupe déplié défile. Boîtes mesurées : chaque en-tête est entièrement dans le panneau, aux trois tailles.
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }]) {
    test(`test_every_header_box_is_inside_the_panel_and_only_the_group_body_scrolls_at_${vp.width}x${vp.height}`, async ({ page }) => {
      await openUi(page, vp);
      const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);
      await page.evaluate(({ band }) => {
        const w = window as unknown as { ui: { setLetterboxBand(px: number): void; showChoices(c: unknown): void } };
        w.ui.setLetterboxBand(band);
        w.ui.showChoices(Array.from({ length: 6 }, (_, c) => ({ id: `c${c}`, labelKey: `Choix ${c}`, blocksExit: false, options: Array.from({ length: c === 0 ? 7 : 3 }, (_, o) => ({ id: `o${o}`, labelKey: `Une option ${c}.${o}`, isRefusal: false, words: 1 + o })) })));
      }, { band });
      await page.locator('[data-choice="c0"] [data-option="o6"]').evaluate((e) => { (e as HTMLElement).click(); });   // le corps du groupe peut être de hauteur nulle à 960 : clic programmatique
      const r = await page.evaluate(() => {
        const p = document.querySelector('[data-ui="choices"]')!.getBoundingClientRect();
        const heads = [...document.querySelectorAll('[data-ui="choice-name"], [data-ui="more-groups"]')].filter((h) => h.getBoundingClientRect().height > 0).map((h) => { const b = h.getBoundingClientRect(); return { top: b.top - p.top, bottom: p.bottom - b.bottom }; });
        const ul = document.querySelector('[data-ui="choices"] ul')!;
        return { heads, listScrolls: ul.scrollHeight > ul.clientHeight + 1 };
      });
      r.heads.forEach((h, i) => { expect(h.top, `en-tête ${i} : haut dans le panneau`).toBeGreaterThanOrEqual(-1); expect(h.bottom, `en-tête ${i} : bas dans le panneau`).toBeGreaterThanOrEqual(-1); });
      expect(r.listScrolls, 'la liste des en-têtes ne défile pas, seul le corps du groupe déplié défile').toBe(false);
    });
  }

  // AR-1 et AR-2 [choix simultanés §6.3] : 960 x 540 (mode petit, zones montées), sept groupes, le checkpoint désigné sur sa première, une option du milieu, sa dernière.
  for (const side of ['right', 'left'] as const) {
    test(`test_AR1_AR2_small_mode_the_option_never_scrolls_away_from_its_price_and_confirm_is_inside_${side}`, async ({ page }) => {
      const vp = { width: 960, height: 540 };
      await openUi(page, vp);
      const band = Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);
      await page.evaluate(({ band }) => {
        const w = window as unknown as { ui: { setLetterboxBand(px: number): void; showChoices(c: unknown): void } };
        w.ui.setLetterboxBand(band);
        w.ui.showChoices(['checkpoint.j1', 'j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'permit.j1'].map((id, c) => ({ id, labelKey: `Choix ${c}`, blocksExit: false, options: Array.from({ length: id === 'checkpoint.j1' ? 7 : 3 }, (_, o) => ({ id: `o${o}`, labelKey: `Parler du temps qu'il fait`, isRefusal: false, words: 1 + o })) })));
      }, { band });
      if (side === 'left') await page.evaluate(() => { document.querySelector<HTMLElement>('[data-ui="choices"]')!.dataset['side'] = 'left'; });
      await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.getAttribute('data-zone-mode') === 'small');
      expect(await page.locator('[data-ui="more-groups"]').textContent()).not.toBe('');
      for (const o of ['o0', 'o3', 'o6']) {
        await page.locator(`[data-choice="checkpoint.j1"] [data-option="${o}"]`).click();
        await page.evaluate(({ o }) => (window as unknown as { ui: { showPrice(p: unknown): void } }).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: o, textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} }), { o });
        const panel = (await page.locator('[data-ui="choices"]').boundingBox())!;
        // AR-2 : Confirmer et la rangée d'en-tête entièrement dans le panneau, sans défiler
        for (const sel of ['[data-ui="confirm"]', '[data-ui="choice-name"]:visible', '[data-ui="more-groups"]']) {
          const b = (await page.locator(sel).first().boundingBox())!;
          expect(b.y, `${o} ${sel} : haut dans le panneau`).toBeGreaterThanOrEqual(panel.y - 1);
          expect(b.y + b.height, `${o} ${sel} : bas dans le panneau`).toBeLessThanOrEqual(panel.y + panel.height + 1);
          expect(b.x, `${o} ${sel} : gauche dans le panneau`).toBeGreaterThanOrEqual(panel.x - 1);
          expect(b.x + b.width, `${o} ${sel} : droite dans le panneau`).toBeLessThanOrEqual(panel.x + panel.width + 1);
        }
        // AR-1 : à trois positions de défilement, si la ligne de prix est (en partie) visible, l'option l'est entièrement
        for (const at of ['top', 'middle', 'bottom'] as const) {
          const r = await page.evaluate(({ at }) => {
            const g = document.querySelector<HTMLElement>('.c-street-group:not([hidden])')!;
            g.scrollTop = at === 'top' ? 0 : at === 'middle' ? (g.scrollHeight - g.clientHeight) / 2 : g.scrollHeight;
            const gb = g.getBoundingClientRect(), p = document.querySelector('[data-ui="price"]')!.getBoundingClientRect(), opEl = document.querySelector<HTMLElement>('[aria-pressed="true"]')!, opr = opEl.getBoundingClientRect(), cy = opr.top + opr.height / 2, op = { top: cy - opEl.offsetHeight / 2, bottom: cy + opEl.offsetHeight / 2 };   // la boîte non tournée : la rotation de l'option désignée est décorative et gonfle la boîte englobante
            const cut = p.bottom > gb.top && p.top < gb.bottom;
            return { cut, optIn: op.top >= gb.top - 8 && op.bottom <= gb.bottom + 8, op: [op.top, op.bottom], gb: [gb.top, gb.bottom] };
          }, { at });
          if (r.cut) expect(r.optIn, `${o} défilement ${at} : le prix est lu avec son option ${JSON.stringify(r)}`).toBe(true);
        }
        await page.evaluate(() => { document.querySelector<HTMLElement>('.c-street-group:not([hidden])')!.scrollTop = 0; });
      }
    });
  }

  // --- Arbitrages 2026-11-03 [choix simultanés §6.3] : un e2e par critère, zones montées -------------------------------------------------------------------
  type W = { ui: { setLetterboxBand(px: number): void; setBracelet(n: number): void; showChoices(c: unknown): void; showPrice(p: unknown): void; showRefusal(r: unknown): void; clearRefusal?(): void } };
  const NAMES: Record<string, string> = { 'checkpoint.j1': 'Te présenter au contrôle', 'j1.phone': 'Décider du téléphone', 'j1.component': 'Décider du composant', 'm3.letter': 'Écouter Théodore', 'm4.list': 'Descendre voir Berenice', 'm5.yusuf': 'Passer chez Yusuf', 'permit.j1': 'Aller au guichet' };   // noms réels de groupes, des actions depuis le playtest du 2026-11-03 (le runtime les tire de fr.json)
  const mk = (ids: string[]) => ids.map((id) => ({ id, labelKey: NAMES[id] ?? id, blocksExit: false, options: Array.from({ length: id === 'checkpoint.j1' ? 7 : 3 }, (_, o) => ({ id: `o${o}`, labelKey: `Parler du temps qu'il fait`, isRefusal: false, words: 1 + o })) }));
  const SEVEN = ['checkpoint.j1', 'j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'permit.j1'];
  const bandOf = (vp: { width: number; height: number }): number => Math.floor((vp.height - Math.floor(vp.width / 2.39)) / 2);

  test('test_AR3_AR4_decision_block_only_in_small_mode_price_in_the_foot_elsewhere', async ({ page }) => {
    for (const vp of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await openUi(page, vp);
      await page.evaluate(({ band, list }) => {
        const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band);
        w.showChoices(list);
      }, { band: bandOf(vp), list: mk(['checkpoint.j1', 'j1.phone']) });
      await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.hasAttribute('data-zone-mode'));
      await page.locator('[data-choice="checkpoint.j1"] [data-option="o1"]').evaluate((e) => { (e as HTMLElement).click(); });
      await page.evaluate(() => (window as unknown as W).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: 'o1', textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} }));
      const r = await page.evaluate(() => {
        const price = document.querySelector('[data-ui="price"]')!, opt = document.querySelector('[aria-pressed="true"]')!;
        return { decision: document.querySelectorAll('[data-ui="decision"]').length, inDecision: price.closest('[data-ui="decision"]')?.contains(opt) ?? false, describedBy: opt.getAttribute('aria-describedby') === price.id && price.id !== '', priceInFoot: price.closest('[data-ui="foot"]') !== null };
      });
      if (vp.width === 960) expect(r, '960 : bloc de décision, prix hors du pied').toEqual({ decision: 1, inDecision: true, describedBy: true, priceInFoot: false });
      else expect(r, `${vp.width} : pas de bloc, prix dans le pied`).toEqual({ decision: 0, inDecision: false, describedBy: false, priceInFoot: true });
    }
  });

  test('test_AR5_small_mode_one_header_plus_n_list_escape_and_choosing_releases_the_designation', async ({ page }) => {
    const vp = { width: 960, height: 540 };
    await openUi(page, vp);
    await page.evaluate(({ band, list }) => { const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band); w.showChoices(list); }, { band: bandOf(vp), list: mk(SEVEN) });
    await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.getAttribute('data-zone-mode') === 'small');
    const visibleHeads = () => page.locator('[data-ui="choice-name"]').evaluateAll((hs) => hs.filter((h) => h.getBoundingClientRect().height > 0).length);
    expect(await visibleHeads(), 'exactement un en-tête visible').toBe(1);
    const more = page.locator('[data-ui="more-groups"]');
    expect(await more.textContent(), 'le texte dit « + 6 »').toContain('6');
    expect(await more.getAttribute('aria-expanded')).toBe('false');
    await more.click();
    expect(await more.getAttribute('aria-expanded')).toBe('true');
    expect(await visibleHeads(), 'sept en-têtes visibles, liste ouverte').toBe(7);
    await page.keyboard.press('Escape');
    expect(await more.getAttribute('aria-expanded')).toBe('false');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-ui')), 'le focus revient sur « + N »').toBe('more-groups');
    // désigner puis choisir un autre en-tête : la désignation est relâchée
    await page.locator('[data-choice="checkpoint.j1"] [data-option="o1"]').evaluate((e) => { (e as HTMLElement).click(); });
    expect(await page.locator('[aria-pressed="true"]').count()).toBe(1);
    await more.click();
    await page.locator('[data-choice="j1.phone"] [data-ui="choice-name"]').click();
    expect(await page.locator('[aria-pressed="true"]').count(), 'la désignation est relâchée').toBe(0);
    expect(await page.locator('[data-choice="j1.phone"] [data-ui="choice-name"]').getAttribute('aria-expanded')).toBe('true');
  });

  test('test_AR10_an_arriving_checkpoint_is_inserted_at_its_rank_and_headers_already_present_do_not_move', async ({ page }) => {
    const vp = { width: 1920, height: 1080 };
    await openUi(page, vp);
    await page.evaluate(({ band, list }) => { const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band); w.showChoices(list); }, { band: bandOf(vp), list: mk(['m3.letter', 'j1.phone']) });
    await page.locator('[data-choice="m3.letter"] [data-option="o1"]').click();
    const tops = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ui="choice-name"]')].map((h) => [h.closest('[data-choice]')!.getAttribute('data-choice')!, h.getBoundingClientRect().top])));
    await page.waitForTimeout(100);
    const before = await tops();
    await page.evaluate(({ list }) => (window as unknown as W).ui.showChoices(list), { list: mk(['checkpoint.j1', 'm3.letter', 'j1.phone']) });
    await page.waitForTimeout(100);
    const after = await tops();
    const order = await page.locator('[data-choice]').evaluateAll((l) => l.map((e) => e.getAttribute('data-choice')));
    expect(order, 'le checkpoint arrive à son rang, au-dessus').toEqual(['checkpoint.j1', 'm3.letter', 'j1.phone']);
    for (const id of ['m3.letter', 'j1.phone']) expect(Math.abs(after[id]! - before[id]!), `${id} : le haut de l'en-tête ne bouge pas ${JSON.stringify({ before, after })}`).toBeLessThanOrEqual(1);
  });

  test('test_AR11_no_text_under_18px_at_960x540_plus_n_row_included', async ({ page }) => {
    const vp = { width: 960, height: 540 };
    await openUi(page, vp);
    await page.evaluate(({ band, list }) => { const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band); w.showChoices(list); }, { band: bandOf(vp), list: mk(SEVEN) });
    await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.getAttribute('data-zone-mode') === 'small');
    await page.locator('[data-choice="checkpoint.j1"] [data-option="o1"]').evaluate((e) => { (e as HTMLElement).click(); });
    await page.evaluate(() => { const w = (window as unknown as W).ui; w.showPrice({ choiceId: 'checkpoint.j1', optionId: 'o1', textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} }); w.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'exitBlocked' }); });
    const sizes = await page.evaluate(() => [...document.querySelectorAll('[data-ui="choices"], [data-ui="choices"] *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '') && e.getBoundingClientRect().height > 0).map((e) => ({ n: e.getAttribute('data-ui') ?? e.tagName, px: parseFloat(getComputedStyle(e).fontSize) })));
    expect(sizes.some((x) => x.n === 'more-groups'), '« + N » présent').toBe(true);
    for (const x of sizes) expect(x.px, `${x.n} : texte d'au moins 18 px`).toBeGreaterThanOrEqual(18);
  });

  test('test_AR12_condensation_at_1280x720_seven_groups_with_refusal_everything_inside_the_panel_and_no_flip_flop', async ({ page }) => {
    const vp = { width: 1280, height: 720 };
    await openUi(page, vp);
    await page.evaluate(({ band, list }) => { const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band); w.showChoices(list); }, { band: bandOf(vp), list: mk(SEVEN) });
    await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.getAttribute('data-zone-mode') === 'medium');
    await page.locator('[data-choice="checkpoint.j1"] [data-option="o1"]').evaluate((e) => { (e as HTMLElement).click(); });
    await page.evaluate(() => (window as unknown as W).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: 'o1', textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} }));
    const refuse = () => page.evaluate(() => (window as unknown as W).ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'exitBlocked' }));
    await refuse();
    const panel = (await page.locator('[data-ui="choices"]').boundingBox())!;
    expect(await page.locator('[data-ui="more-groups"]').textContent(), '« + N » avec N = 6').toContain('6');
    for (const sel of ['[aria-pressed="true"]', '[data-ui="price"]', '[data-ui="confirm"]', '[data-ui="refusal"]']) {
      const b = (await page.locator(sel).boundingBox())!;
      const pad = sel === '[aria-pressed="true"]' ? 8 : 1;   // l'option désignée est tournée : sa boîte englobante dépasse de quelques pixels
      expect(b.y, `${sel} : haut dans le panneau`).toBeGreaterThanOrEqual(panel.y - pad);
      expect(b.y + b.height, `${sel} : bas dans le panneau`).toBeLessThanOrEqual(panel.y + panel.height + pad);
    }
    // l'option désignée et Confirmer reçoivent le clic (sonde au centre de leur boîte, rognée par le panneau)
    for (const sel of ['[aria-pressed="true"]', '[data-ui="confirm"]']) {
      const hit = await page.locator(sel).evaluate((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t !== null && (e === t || e.contains(t)); });
      expect(hit, `${sel} : reçoit le clic en son centre`).toBe(true);
    }
    // le refus affiché puis retiré dix fois : l'état condensé suit le refus et ne change pas d'une fois sur l'autre
    const state = async () => (await page.locator('[data-ui="choices"]').getAttribute('data-condensed')) !== null;
    const withRefusal: boolean[] = [], without: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      await page.evaluate(({ list }) => { const w = (window as unknown as W).ui; w.showChoices(list); }, { list: mk(SEVEN) });
      await page.waitForTimeout(40); without.push(await state());
      await refuse(); await page.waitForTimeout(40); withRefusal.push(await state());
    }
    expect(new Set(withRefusal).size, 'avec le refus : toujours le même état').toBe(1);
    expect(new Set(without).size, 'sans le refus : toujours le même état').toBe(1);
  });

  // Pire cas, trois tailles : 7 groupes, option désignée, prix le plus long, refus le plus long. Captures de preuve avec T6_SHOTS.
  for (const vp of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    test(`test_worst_case_capture_${vp.width}x${vp.height}`, async ({ page }) => {
      await openUi(page, vp);
      await page.evaluate(({ band, list }) => { const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band); w.showChoices(list); }, { band: bandOf(vp), list: mk(SEVEN) });
      await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.hasAttribute('data-zone-mode'));
      await page.locator('[data-choice="checkpoint.j1"] [data-option="o1"]').evaluate((e) => { (e as HTMLElement).click(); });
      await page.evaluate(() => (window as unknown as W).ui.showPrice({ choiceId: 'checkpoint.j1', optionId: 'o1', textKey: (window as unknown as { PRICE: string }).PRICE, isRefusal: false, inventoryParams: {} }));
      await page.waitForTimeout(300);
      if (process.env['T6_SHOTS']) await page.screenshot({ path: `${process.env['T6_SHOTS']}/pire-cas-${vp.width}-sans-refus.png` });
      await page.evaluate(() => { const w = (window as unknown as W).ui; w.showRefusal({ act: { day: 1, kind: 'choice', id: 'c0', minute: 450 }, reason: 'exitBlocked' }); });
      await page.waitForTimeout(300);
      const panel = (await page.locator('[data-ui="choices"]').boundingBox())!;
      const c = (await page.locator('[data-ui="confirm"]').boundingBox())!;
      expect(c.y + c.height, 'Confirmer dans le panneau').toBeLessThanOrEqual(panel.y + panel.height + 1);
      if (process.env['T6_SHOTS']) await page.screenshot({ path: `${process.env['T6_SHOTS']}/pire-cas-${vp.width}.png` });
    });
  }

  test('test_AR12_two_groups_at_1920x1080_without_refusal_keep_the_full_headers', async ({ page }) => {
    const vp = { width: 1920, height: 1080 };
    await openUi(page, vp);
    await page.evaluate(({ band, list }) => { const w = (window as unknown as W).ui; w.setBracelet(41); w.setLetterboxBand(band); w.showChoices(list); }, { band: bandOf(vp), list: mk(['checkpoint.j1', 'm3.letter']) });
    await page.waitForFunction(() => document.querySelector('[data-ui="root"]')?.getAttribute('data-zone-mode') === 'large');
    expect(await page.locator('[data-ui="more-groups"]').count(), 'pas de « + N »').toBe(0);
    expect(await page.locator('[data-ui="choice-name"]:visible').count(), 'deux en-têtes complets').toBe(2);
  });
});

async function openUi(page: import('@playwright/test').Page, vp: { width: number; height: number }): Promise<void> {
  const out = await build({ entryPoints: ['src/street/ui/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'Ui', outdir: 'out', loader: { '.css': 'css' }, external: ['/fonts/*'] });
  const js = out.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  const css = out.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
  await page.setViewportSize(vp);
  await page.setContent('<!doctype html><body style="margin:0"><div id="host" style="position:fixed;inset:0"></div></body>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  // vraies chaînes `street.ui.*` (« 3 mots », « + 6 ») : l'identité des clés gonflerait la pastille de prix et fausserait les hauteurs mesurées ; les libellés d'options restent leur propre texte
  const real = Object.fromEntries(Object.entries(frJson as Record<string, string>).filter(([k]) => k.startsWith('street.ui.')));
  await page.evaluate(({ real, price }) => {
    (window as unknown as { PRICE: string }).PRICE = price;
    const t = (k: string, p?: Record<string, unknown>): string => (real[k] ?? k).replace(/\{(\w+)\}/g, (_m, n: string) => String(p?.[n] ?? ''));
    const i18n = { t, has: (k: string) => k in real, onChange: () => () => undefined, lang: () => 'fr', setLang: () => undefined, tPlural: (k: string, c: number, p?: Record<string, unknown>) => t(`${k}.${c === 1 ? 'one' : 'other'}`, p) };
    const ui = (window as unknown as { Ui: { mountUi: (h: HTMLElement, i: unknown, o: unknown) => unknown } }).Ui;
    (window as unknown as { ui: unknown }).ui = ui.mountUi(document.getElementById('host')!, i18n, { reducedMotion: true });
  }, { real, price: PRICE });
}
