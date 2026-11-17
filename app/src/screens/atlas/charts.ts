/**
 * Graphiques à la main en SVG, sans librairie : barres de stade par levier (compte des textes contrôlés, un segment par stade,
 * forme et hachures doublant la couleur) et frise des lois dans le temps (une forme par stade, une voie par juridiction).
 * Chaque barre a un libellé texte ; la frise a sa liste par date. Les segments d'un même levier ne s'additionnent pas d'un monde à l'autre.
 */
import type { Labels } from '../../atlas/labels';
import { OUT_OF_LAW_GROUPS, OUT_OF_LAW_WORLDS } from '../../atlas/config';
import { buildTimeline, counts, formatDate, STADE_KEY } from '../../atlas/model';
import { STADES, type AtlasData, type Loi, type MondeId, type Stade } from '../../atlas/schema';
import { el, link, pill, stadeGlyph, stadeShape, stamp, svg, token } from './dom';
import { figureTile } from './figures';

const barLabel = (c: Readonly<Record<Stade, number>>, L: Labels): string =>
  STADES.filter((s) => c[s] > 0).map((s) => `${c[s]} ${L.stadeLegend[s] ?? s}`).join(', ') || L.barNone;

/** Un jeton par texte contrôlé du levier, dans l'ordre des stades : « 2 textes déposés » se voit comme deux jetons, sans échelle relative. */
function tokens(c: Readonly<Record<Stade, number>>, L: Labels): HTMLElement {
  const row = el('span', 'at-tokens');
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', barLabel(c, L));
  for (const s of STADES) for (let k = 0; k < c[s]; k += 1) row.append(token(s));
  return row;
}

/** Légende des stades : la forme du jeton et le mot. */
function stadeLegend(L: Labels): HTMLElement {
  const row = el('div', 'at-lg-row');
  for (const s of STADES) {
    const it = el('span', 'at-lg');
    it.append(token(s), document.createTextNode(L.stadeLegend[s] ?? s));
    row.append(it);
  }
  return row;
}

/**
 * Bloc pleine largeur des mesures du futur hors droit : quatre colonnes en large (climat, biodiversité, nucléaire, limites planétaires),
 * une colonne sur téléphone. Une barre seulement quand la mesure a une jauge ; le détail s'ouvre au toucher dans la fiche papier.
 */
function outOfLawBlock(data: AtlasData, L: Labels, openFigure: (id: string) => void): HTMLElement {
  const block = el('section', 'at-outblock');
  block.id = 'at-horsdroit';
  block.append(el('h3', undefined, L.outOfLawMeasures));
  const byId = new Map(data.horsdroit.map((c) => [c.id, c]));
  const listed = new Set(OUT_OF_LAW_GROUPS.flatMap((g) => g.ids));
  const groups = [
    ...OUT_OF_LAW_GROUPS.map((g) => ({ key: g.key, items: g.ids.map((id) => byId.get(id)).filter((c) => c !== undefined) })),
    { key: 'other', items: data.horsdroit.filter((c) => !listed.has(c.id)) },
  ].filter((g) => g.items.length > 0);
  const cols = el('div', 'at-ogrid');
  for (const g of groups) {
    const col = el('div', 'at-og');
    col.dataset['group'] = g.key;
    col.append(el('h4', undefined, L.outOfLawGroups[g.key] ?? g.key));
    const list = el('div', 'at-ogl');
    for (const c of g.items) list.append(figureTile(c, L, openFigure));
    col.append(list);
    cols.append(col);
  }
  block.append(cols, el('p', 'at-small at-fixedline', L.outOfLawFixedLine));
  const urls = new Map<string, string>();
  for (const c of data.horsdroit) for (const s of c.jauge?.seuils ?? []) if (s.source_url && !urls.has(s.source_url)) urls.set(s.source_url, data.reperes.find((r) => r.url === s.source_url)?.titre ?? s.libelle);
  for (const [url, label] of urls) {
    const p = el('p', 'at-small at-thresholds');
    p.append(document.createTextNode(L.thresholdsLine), link(label, url));
    block.append(p);
  }
  return block;
}

/** Les leviers du droit actuel, monde par monde (phrases des mondes dans la section « Les futurs »). */
export function buildLevers(data: AtlasData, lit: MondeId | null, L: Labels, openFigure: (id: string) => void = () => undefined): HTMLElement {
  const c = counts(data);
  const total = (id: string): number => Object.values(c.parLevier[id] ?? {}).reduce((a, b) => a + b, 0);
  const nom = new Map(data.leviers.map((l) => [l.id, l.nom]));
  const root = el('div', 'at-levers');
  root.append(stadeLegend(L));
  const grid = el('div', 'at-wgrid');
  const leverBlock = (id: string, pole: string | null): HTMLElement => {
    const lv = el('div', 'at-lv');
    const h = el('div', 'at-lvh');
    h.append(document.createTextNode(nom.get(id) ?? ''));
    if (pole) h.append(el('span', 'at-pole', L.poleLabel(L.pole(pole))));
    lv.append(h);
    const only = data.lois.filter((l) => l.levier?.id === id);
    if (id === 'L3' && only.length === 1 && only[0]?.id === 'ue-09') {
      const r = el('p', 'at-reserve');
      r.append(el('strong', undefined, L.reserveLabel), document.createTextNode(L.reserveText));
      lv.append(r);
    }
    const n = total(id);
    const counts1 = c.parLevier[id];
    if (n > 0 && counts1) lv.append(tokens(counts1, L), el('div', 'at-lvn', `${L.nTextes(n)} : ${barLabel(counts1, L)}`));
    else lv.append(el('div', 'at-lvn', L.leverNoText));
    return lv;
  };
  for (const m of data.mondes) {
    const outOfLaw = OUT_OF_LAW_WORLDS.includes(m.id);
    const card = el('article', `at-wcard${m.extinction ? ' ext' : ''}${m.id === lit ? ' lit' : ''}${m.leviers.length === 0 && !outOfLaw ? ' nolever' : ''}`);
    card.dataset['world'] = m.id;
    const h = el('h3');
    h.append(el('span', 'at-wname', m.nom));
    if (m.extinction) h.append(stamp(L.extinction, 'ext at-ext'));
    if (m.id === lit) h.append(el('span', 'at-yours', L.yours));
    if (L.lang === 'en') {
      // En anglais, c'est le texte d'origine du résumé qu'on affiche, jamais une retraduction de la traduction française.
      const original = el('p', 'at-fr', m.futur.citation_en);
      original.lang = 'en';
      card.append(h, original);
      if (m.futur.glose) card.append(el('p', 'at-small at-glose', m.futur.glose));
    } else {
      const fr = el('p', 'at-fr', m.futur.traduction_fr);
      const orig = el('details', 'at-orig');
      const en = el('p', 'at-en', m.futur.citation_en);
      en.lang = 'en';
      orig.append(el('summary', undefined, L.origDetails), en);
      card.append(h, fr);
      if (m.futur.glose) card.append(el('p', 'at-small at-glose', m.futur.glose));
      card.append(orig);
    }
    if (outOfLaw) {
      // Encart d'une autre nature : ce futur ne passe pas par une loi sur l'IA ; les mesures des sources, ou la mention de contrôle en cours.
      card.classList.add('out');
      const out = el('div', 'at-lv at-outlaw');
      out.append(stamp(L.outOfLawTag, 'hors at-oltag'), el('p', undefined, L.outOfLawText));
      if (data.horsdroit.length > 0) {
        const a = el('a', 'at-oltolink', L.outOfLawSeeBlock);
        a.href = '#at-horsdroit';
        out.append(a);
      } else out.append(el('p', 'at-small at-pending', L.outOfLawPending));
      card.append(out);
    } else if (m.leviers.length === 0) {
      const none = el('div', 'at-lv at-none');
      none.append(stamp(L.noLeverStamp));
      const cn = c.parMonde[m.id];
      const note = (m.note_aucun ?? '').replace(/^aucun levier du droit actuel dans le registre\.\s*/i, '').replace(/^aucun levier du droit actuel\.\s*/i, '');
      const linked = cn ? cn.liens + cn.points : 0;
      const tail = /aucun des \d+ textes n'en traite/.test(note) ? L.matrixLinks(linked, data.lois.length) : note;
      none.append(el('p', 'at-small', tail));
      card.append(none);
    }
    for (const lv of m.leviers) card.append(leverBlock(lv.id, lv.pole));
    grid.append(card);
  }
  for (const lv of data.leviers) {
    if (data.mondes.some((m) => m.leviers.some((x) => x.id === lv.id))) continue;
    const card = el('article', 'at-wcard free');
    const h = el('h3');
    h.append(document.createTextNode(lv.nom));
    const n = total(lv.id);
    const cc = c.parLevier[lv.id];
    card.append(h, el('p', 'at-small', L.freeLeverNote));
    if (cc) card.append(tokens(cc, L), el('div', 'at-lvn', `${L.nTextes(n)} : ${barLabel(cc, L)}`));
    grid.append(card);
  }
  root.append(grid);
  if (data.horsdroit.length > 0) root.append(outOfLawBlock(data, L, openFigure));
  return root;
}

/** La frise : chaque texte à la date de son stade, forme du stade, voie de sa juridiction ; liste par date dessous. */
export function buildTimelineView(data: AtlasData, open: (id: string) => void, L: Labels): HTMLElement {
  const t = buildTimeline(data);
  const byId = new Map(data.lois.map((l) => [l.id, l]));
  const root = el('div', 'at-timeline');
  const lg = el('div', 'at-lg-row');
  for (const s of STADES) { const w = el('span', 'at-lg'); w.append(pill(s, L.stadeLegend[s] ?? s)); lg.append(w); }
  const wrap = el('div', 'at-tl-wrap');
  const s = svg('svg', { class: 'at-tl', viewBox: `0 0 ${t.width} ${t.height}`, role: 'img', 'aria-label': L.timelineAria });
  for (const y of t.years) {
    s.append(svg('line', { x1: y.x.toFixed(1), y1: 8, x2: y.x.toFixed(1), y2: t.height - 24, class: 'at-tick' }));
    if (y.label) { const tx = svg('text', { x: (y.x + 3).toFixed(1), y: t.height - 8, class: 'at-tt' }); tx.textContent = String(y.year); s.append(tx); }
  }
  s.append(svg('line', { x1: t.todayX.toFixed(1), y1: 8, x2: t.todayX.toFixed(1), y2: t.height - 24, class: 'at-today' }));
  const today = svg('text', { x: (t.todayX - 4).toFixed(1), y: t.height - 8, 'text-anchor': 'end', class: 'at-tt' });
  today.textContent = formatDate(data.as_of, L);
  s.append(today);
  for (const lane of t.lanes) {
    s.append(svg('rect', { x: 62, y: lane.y - 10, width: t.width - 70 - 20 + 8, height: lane.rows * 20 + 14, class: 'at-lane' }));
    const lt = svg('text', { x: 6, y: lane.y + 6, class: 'at-lt' });
    lt.textContent = lane.jur;
    s.append(lt);
  }
  for (const m of t.marks) {
    const l = byId.get(m.id);
    if (!l) continue;
    const g = svg('g', { class: `at-mk st-${STADE_KEY[l.stade]}`, tabindex: 0, role: 'button', transform: `translate(${m.x.toFixed(1)} ${m.y})`,
      'aria-label': `${l.titre_court}, ${l.stade}, ${formatDate(l.date_stade, L)}`, 'data-open': l.id });
    const title = svg('title');
    title.textContent = `${l.titre_court} (${l.stade}, ${formatDate(l.date_stade, L)})`;
    g.append(title, svg('rect', { x: -13, y: -13, width: 26, height: 26, class: 'at-hit' }), svg('g', { transform: 'translate(-8 -8) scale(1.1429)' }, ...stadeShape(l.stade)));
    g.addEventListener('click', () => open(l.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(l.id); } });
    s.append(g);
  }
  wrap.append(s);
  // Téléphone : la frise se lit à la verticale, une ligne par année, les jetons de stade passent à la ligne (aucun défilement horizontal).
  const years = new Map<string, Loi[]>();
  for (const l of t.dated) years.set(l.date_stade.slice(0, 4), [...(years.get(l.date_stade.slice(0, 4)) ?? []), l]);
  const vertical = el('ol', 'at-tl-v');
  for (const [y, ls] of years) {
    const li = el('li');
    li.setAttribute('aria-label', L.timelineYear(y, ls.length));
    const tks = el('span', 'at-tks');
    for (const l of ls) {
      const b = el('button', `at-tkb sk-${STADE_KEY[l.stade]}`);
      b.type = 'button';
      b.dataset['open'] = l.id;
      b.title = `${l.titre_court} (${l.stade}, ${formatDate(l.date_stade, L)})`;
      b.setAttribute('aria-label', `${l.titre_court}, ${l.stade}, ${formatDate(l.date_stade, L)}`);
      b.append(stadeGlyph(l.stade, 20));
      b.addEventListener('click', () => open(l.id));
      tks.append(b);
    }
    li.append(el('b', undefined, y), tks);
    vertical.append(li);
  }
  const item = (l: (typeof data.lois)[number], useRaw: boolean): HTMLLIElement => {
    const li = el('li');
    const b = el('button', 'at-linkbtn', l.titre_court);
    b.type = 'button';
    b.addEventListener('click', () => open(l.id));
    li.append(b, document.createTextNode(' '), pill(l.stade, l.stade_label), el('span', 'at-dt', ` ${useRaw ? l.date_stade : formatDate(l.date_stade, L)}`));
    return li;
  };
  const det = el('details', 'at-tl-list');
  det.append(el('summary', undefined, L.timelineList(t.dated.length)));
  const ul = el('ul', 'at-nd-list');
  for (const l of t.dated) ul.append(item(l, false));
  det.append(ul);
  root.append(lg, wrap, vertical, det);
  if (t.undated.length) {
    const ul2 = el('ul', 'at-nd-list');
    for (const l of t.undated) ul2.append(item(l, true));
    root.append(el('h3', 'at-nd-h', L.undatedTitle), el('p', 'at-small', L.undatedNote), ul2);
  }
  queueMicrotask(() => { wrap.scrollLeft = wrap.scrollWidth; });
  return root;
}
