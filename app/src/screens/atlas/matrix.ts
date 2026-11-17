/**
 * La matrice : lois en lignes groupées par thème, mondes en colonnes. Rond plein = lien direct, rond creux = indirect, barre = frein,
 * petit point = même levier seulement. Le stade est un mot dans une pastille. Sur téléphone elle se retourne : on touche un monde,
 * on voit ses textes. Les filtres agissent sur les deux présentations.
 */
import { OUT_OF_LAW_WORLDS } from '../../atlas/config';
import type { Labels } from '../../atlas/labels';
import { buildCells, cellOf, counts, filterLois, formatDate, loisOfWorld, type CellKind } from '../../atlas/model';
import { STADES, type AtlasData, type Loi, type MondeId } from '../../atlas/schema';
import { el, pill, stamp, symbol } from './dom';

export interface MatrixHooks { open(id: string): void }
export interface MatrixView { readonly root: HTMLElement; destroy(): void }

const kindTint = (ks: readonly CellKind[]): string => {
  const sides = new Set(ks.map((k) => (k === 'frein' ? 'frein' : k === 'dot' ? 'same' : 'vers')));
  return sides.size > 1 ? 'both' : [...sides][0] ?? 'same';
};

const option = (text: string, value: string): HTMLOptionElement => { const o = el('option', undefined, text); o.value = value; return o; };

function legend(L: Labels): HTMLElement {
  const box = el('div', 'at-legend');
  const items: readonly (readonly [CellKind, string])[] = [
    ['direct', L.mxLegendDirect], ['indirect', L.mxLegendIndirect], ['frein', L.mxLegendFrein], ['dot', L.mxLegendDot],
  ];
  for (const [k, t] of items) {
    const it = el('span', `at-lg-item lv-${k === 'frein' ? 'frein' : k === 'dot' ? 'same' : 'vers'}`);
    it.append(symbol(k, 18), el('span', undefined, t));
    box.append(it);
  }
  box.append(el('span', 'at-lg-item', L.mxLegendEmpty));
  const ext = el('span', 'at-lg-item');
  ext.append(stamp(L.extinction, 'ext at-ext'), el('span', undefined, L.mxLegendExt));
  box.append(ext);
  return box;
}

function titleBlock(l: Loi, L: Labels): HTMLElement {
  const wrap = el('span', 'at-title-block');
  wrap.append(el('span', 'at-title', l.titre_court));
  const meta = el('span', 'at-meta');
  const note = l.stade_note ? ` · ${l.stade_note}` : '';
  meta.append(el('span', `at-jur j-${l.juridiction}`, l.juridiction), pill(l.stade, l.stade_label), el('span', 'at-dt', `${formatDate(l.date_stade, L)}${note}`));
  wrap.append(meta);
  return wrap;
}

export function buildMatrix(data: AtlasData, hooks: MatrixHooks, lit: MondeId | null, L: Labels): MatrixView {
  const kindsLabel = (ks: readonly CellKind[]): string => ks.map((k) => L.cellWord[k]).join(L.and);
  const cells = buildCells(data);
  const byId = new Map(data.lois.map((l) => [l.id, l]));
  const root = el('div', 'at-matrix');
  const parMonde = counts(data).parMonde;
  const dense = data.mondes.reduce((best, m) => ((parMonde[m.id]?.liens ?? 0) > (parMonde[best]?.liens ?? 0) ? m.id : best), data.mondes[0]?.id ?? '');
  const state = { jur: '', stade: '', avecLien: true, mondeMobile: lit as MondeId | 'none' | null };

  // --- filtres
  const filters = el('div', 'at-filters');
  const selJur = el('select');
  selJur.id = 'at-f-jur';
  for (const [v, t] of [['', L.jurisdictionAll], ['FR', L.jurisdictionFR], ['UE', L.jurisdictionUE], ['INT', L.jurisdictionINT]] as const) selJur.append(option(t, v));
  const selSt = el('select');
  selSt.id = 'at-f-stade';
  selSt.append(option(L.stadeAll, ''));
  for (const s of STADES) selSt.append(option(L.stadeLegend[s] ?? s, s));
  const chk = el('input');
  chk.type = 'checkbox';
  chk.id = 'at-f-link';
  chk.checked = true;
  const count = el('span', 'at-count');
  count.setAttribute('aria-live', 'polite');
  const lab = (text: string, ctl: HTMLElement, cls?: string): HTMLLabelElement => { const l = el('label', cls); l.append(el('span', undefined, text), ctl); return l; };
  filters.append(lab(L.filterJurisdiction, selJur), lab(L.filterStade, selSt), lab(L.filterLinked, chk, 'at-cb'), count);

  // --- grille de bureau
  const grid = el('div', 'at-mx');
  grid.setAttribute('role', 'table');
  grid.setAttribute('aria-label', L.mxAria(data.mondes.length));
  grid.style.setProperty('--n', String(data.mondes.length));
  const head = el('div', 'at-row at-head');
  head.setAttribute('role', 'row');
  head.append(el('div', 'at-corner', L.mxCorner));
  for (const m of data.mondes) {
    const h = el('div', `at-wh${m.extinction ? ' ext' : ''}${m.id === lit ? ' lit' : ''}${m.id === dense ? ' dense' : ''}`);
    h.dataset['world'] = m.id;
    h.setAttribute('role', 'columnheader');
    h.append(el('span', 'at-wn', m.nom));
    if (m.extinction) h.append(stamp(L.extinction, 'ext at-ext at-wx'));
    if (OUT_OF_LAW_WORLDS.includes(m.id)) h.append(el('span', 'at-ol at-wx', L.outOfLawColumn));
    head.append(h);
  }
  grid.append(head);
  const rows: HTMLElement[] = [];
  const themeEls = new Map<string, HTMLElement>();
  for (const t of data.themes) {
    const th = el('div', 'at-theme');
    th.dataset['theme'] = t.id;
    th.append(document.createTextNode(`${t.titre} `), el('span', 'at-tn', `(${L.nTextes(t.lois.length)})`));
    themeEls.set(t.id, th);
    grid.append(th);
    for (const id of t.lois) {
      const l = byId.get(id);
      if (!l) continue;
      const row = el('div', 'at-row at-data');
      row.setAttribute('role', 'row');
      row.dataset['id'] = id;
      row.dataset['theme'] = t.id;
      const head1 = el('div', 'at-t');
      head1.setAttribute('role', 'rowheader');
      const btn = el('button', 'at-btn');
      btn.type = 'button';
      btn.dataset['open'] = id;
      btn.append(titleBlock(l, L));
      head1.append(btn);
      row.append(head1);
      for (const m of data.mondes) {
        const ks = cellOf(cells, id, m.id);
        const c = el('div', `at-c${m.extinction ? ' ext' : ''}${m.id === lit ? ' lit' : ''}${m.id === dense ? ' dense' : ''}${ks.length ? ` t-${kindTint(ks)}` : ''}`);
        c.setAttribute('role', 'cell');
        if (ks.length) {
          const label = `${m.nom} : ${kindsLabel(ks)}`;
          c.setAttribute('aria-label', label);
          c.title = label;
          for (const k of ks) c.append(symbol(k, 22));
        }
        row.append(c);
      }
      rows.push(row);
      grid.append(row);
    }
  }
  // Le mot « hors droit de l'IA » ne s'empile plus dans l'en-tête de colonne : une ligne de légende sous la matrice le porte.
  const outNames = data.mondes.filter((m) => OUT_OF_LAW_WORLDS.includes(m.id)).map((m) => m.nom);
  if (outNames.length > 0) grid.append(el('p', 'at-small at-ol-note', `${outNames.join(', ')} : ${L.outOfLawColumn}`));

  // --- présentation téléphone
  const mob = el('div', 'at-mob');
  const pick = el('div', 'at-pick');
  pick.setAttribute('role', 'group');
  pick.setAttribute('aria-label', L.pickWorld);
  const hint = el('p', 'at-hint', L.pickHint);
  const lists = new Map<string, HTMLUListElement>();
  const pickBtns = new Map<string, HTMLButtonElement>();
  const mkPick = (id: string, label: HTMLElement[], cls = ''): HTMLButtonElement => {
    const b = el('button', `at-wbtn${cls}`);
    b.type = 'button';
    b.dataset['world'] = id;
    b.setAttribute('aria-pressed', 'false');
    b.append(...label);
    pickBtns.set(id, b);
    return b;
  };
  for (const m of data.mondes) {
    const lbl = [el('span', 'at-wn', m.nom)];
    if (m.extinction) lbl.push(stamp(L.extinction, 'ext at-ext'));
    pick.append(mkPick(m.id, lbl));
  }
  const none = mkPick('none', [el('span', undefined, L.pickNone)], ' wide');
  const mkList = (w: MondeId | 'none'): HTMLUListElement => {
    const ul = el('ul', 'at-mob-list');
    ul.dataset['list'] = w;
    ul.hidden = true;
    const ls = loisOfWorld(data, w);
    if (ls.length === 0) ul.append(el('li', 'at-empty', w === 'none' ? L.emptyNone : L.emptyWorld));
    for (const l of ls) {
      const li = el('li');
      li.dataset['id'] = l.id;
      const b = el('button', 'at-item');
      b.type = 'button';
      b.dataset['open'] = l.id;
      if (w !== 'none') {
        const ks = cellOf(cells, l.id, w);
        const s = el('span', 'at-item-sym');
        for (const k of ks) s.append(symbol(k, 22));
        s.append(el('span', 'at-sw', kindsLabel(ks)));
        b.append(s);
      }
      b.append(titleBlock(l, L));
      li.append(b);
      ul.append(li);
    }
    lists.set(w, ul);
    return ul;
  };
  mob.append(pick, none, hint);
  for (const m of data.mondes) mob.append(mkList(m.id));
  mob.append(mkList('none'));

  const chosen = (w: string | null): void => {
    state.mondeMobile = w as MondeId | 'none' | null;
    for (const [id, b] of pickBtns) b.setAttribute('aria-pressed', id === w ? 'true' : 'false');
    for (const [id, ul] of lists) ul.hidden = id !== w;
    hint.hidden = w !== null;
  };
  chosen(state.mondeMobile);

  // --- filtres appliqués aux deux présentations
  const apply = (): void => {
    const keep = new Set(filterLois(data, { ...(state.jur ? { juridiction: state.jur } : {}), ...(state.stade ? { stade: state.stade } : {}), avecLien: state.avecLien }).map((l) => l.id));
    const keepMob = new Set(filterLois(data, { ...(state.jur ? { juridiction: state.jur } : {}), ...(state.stade ? { stade: state.stade } : {}) }).map((l) => l.id));
    let shown = 0;
    for (const r of rows) { const ok = keep.has(r.dataset['id'] ?? ''); r.hidden = !ok; if (ok) shown += 1; }
    for (const [tid, th] of themeEls) th.hidden = !rows.some((r) => r.dataset['theme'] === tid && !r.hidden);
    for (const li of mob.querySelectorAll<HTMLLIElement>('li[data-id]')) li.hidden = !keepMob.has(li.dataset['id'] ?? '');
    count.textContent = L.shown(shown);
  };
  const onChange = (): void => { state.jur = selJur.value; state.stade = selSt.value; state.avecLien = chk.checked; apply(); };
  for (const c of [selJur, selSt, chk]) c.addEventListener('change', onChange);
  const onClick = (e: Event): void => {
    const t = e.target as HTMLElement;
    const wb = t.closest<HTMLElement>('.at-wbtn');
    if (wb) { chosen(wb.dataset['world'] ?? null); return; }
    const row = t.closest<HTMLElement>('[data-open], .at-data[data-id]');
    const id = row?.dataset['open'] ?? row?.dataset['id'];
    if (id) hooks.open(id);
  };
  root.addEventListener('click', onClick);
  apply();

  root.append(legend(L), filters, grid, mob);
  return { root, destroy: () => root.removeEventListener('click', onClick) };
}
