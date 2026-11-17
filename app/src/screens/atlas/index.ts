/**
 * Écran « Atlas des futurs » : les futurs, les leviers par monde, la matrice des textes de loi, la frise et les chiffres.
 * Il reçoit ses données en paramètre (`data.json` validé par zod), ne dépend ni de `AppContext` ni de `three`, et ne fait aucune requête
 * réseau au montage. `arrival` allume le monde où le joueur vient d'arriver (matrice, fiche du futur, carte des leviers).
 * Les libellés vivent dans `atlas/labels.ts` (un dictionnaire par langue), le contenu dans les données ; pas dans `fr.json` (volet éducatif isolé).
 */
import type { Screen } from '../../app/shell';
import { labelsFor, type Labels, type Lang } from '../../atlas/labels';
import { counts, displayed, lawReach, litWorld, localize, plate, type CellKind } from '../../atlas/model';
import type { AtlasData } from '../../atlas/schema';
import '../../ui/font';
import '../../ui/tokens.css';
import '../../ui/worlds.css';
import './atlas.css';
import { buildLevers, buildTimelineView } from './charts';
import { el, link, symbol } from './dom';
import { figureTicket } from './figures';
import { buildMatrix, type MatrixView } from './matrix';
import { createSheet, type Sheet } from './sheet';

export interface AtlasOptions {
  /** Monde où la fin du jeu a posé le joueur : sa colonne, sa fiche et sa carte sont allumées. */
  readonly arrival?: string;
  /** Si fourni, un bouton « Retour » apparaît en tête. */
  readonly onBack?: () => void;
  /** Langue de l'interface (défaut `fr`). Sans traduction pour une langue, l'écran affiche le français. */
  readonly lang?: Lang;
}

const FLI_URL = 'https://futureoflife.org/ai/ai-aftermath-scenarios/';

function section(id: string, kick: string, title: string, lead?: string): HTMLElement {
  const s = el('section', 'at-section');
  s.id = `at-${id}`;
  s.append(el('p', 'at-kick', kick), el('h2', undefined, title));
  if (lead) s.append(el('p', 'at-lead', lead));
  return s;
}

/** Attribution des phrases des mondes : résumé du Future of Life Institute, jamais les mots de Tegmark. */
function attribution(data: AtlasData, L: Labels): HTMLElement {
  const attr = el('p', 'at-attrib');
  attr.append(el('span', 'at-tag fact', L.sourced),
    document.createTextNode(L.attribBefore),
    link('futureoflife.org', FLI_URL),
    document.createTextNode(L.attribAfter.trim()));
  return attr;
}

/** Le constat : un nombre héros, la planche des textes (une case par texte contrôlé), deux lignes de comptes, puis les textes par monde. */
function constat(data: AtlasData, L: Labels): HTMLElement {
  const c = counts(data);
  const reach = lawReach(data);
  const pl = plate(data);
  const monde = data.mondes.find((m) => m.id === 'w10')?.nom ?? 'w10';
  const s = section('constat', L.kick['constat'] ?? '', L.constatTitle, L.constatLead);
  const cons = el('div', 'at-cons');
  const left = el('div', 'at-cons-l');
  left.append(el('div', 'at-cons-num', String(c.touchent10)), el('p', 'at-cons-t', `${L.consTouch(c.textes, monde)}`), el('p', 'at-cons-t2', L.consBrakes(c.freins10)));
  const right = el('div', 'at-cons-r');
  const board = el('div', 'at-plate');
  board.setAttribute('role', 'img');
  board.setAttribute('aria-label', L.plateAria(c.touchent10, c.textes, monde, c.freins10));
  for (const k of pl.cases) {
    const cell = el('span', 'at-pc');
    if (k === 'direct' || k === 'indirect' || k === 'frein') cell.append(symbol(k, 20));
    else if (k === 'both') cell.append(symbol('indirect', 12), symbol('frein', 12));
    board.append(cell);
  }
  const key = el('div', 'at-plate-lg');
  const item = (kinds: readonly CellKind[], text: string): void => {
    const it = el('span', `at-it lv-${kinds.includes('frein') && kinds.length === 1 ? 'frein' : 'vers'}`);
    for (const k of kinds) it.append(symbol(k, 16));
    it.append(el('span', undefined, text));
    key.append(it);
  };
  item(['direct'], `${L.plateDirect} ${pl.nombre.direct}`);
  item(['indirect'], `${L.plateIndirect} ${pl.nombre.indirect}`);
  item(['frein'], `${L.plateFrein} ${pl.nombre.frein}`);
  item(['indirect', 'frein'], `${L.plateBoth} ${pl.nombre.both}`);
  key.append(el('span', 'at-it', L.plateEmpty(pl.vides)));
  right.append(board, key);
  cons.append(left, right);
  s.append(cons);

  const line = el('p', 'at-cons-line');
  const part = (n: number, text: string): HTMLElement => { const sp = el('span'); sp.append(el('b', undefined, String(n)), document.createTextNode(text)); return sp; };
  line.append(part(reach.sansLevier.length, ` ${L.consNoLever(reach.sansLevier.length, reach.atteignables)}`));
  if (reach.horsDroit.length > 0) line.append(part(reach.horsDroit.length, ` ${L.consOutOfLaw(reach.horsDroit.length, reach.horsDroit.map((id) => data.mondes.find((m) => m.id === id)?.nom ?? '').join(', '))}`));
  s.append(line);

  const wrap = el('div', 'at-pw-wrap');
  wrap.append(el('h3', undefined, L.perWorldTitle));
  const peak = Math.max(1, ...data.mondes.map((m) => (c.parMonde[m.id]?.liens ?? 0) + (c.parMonde[m.id]?.points ?? 0)));
  for (const m of data.mondes) {
    const n = c.parMonde[m.id] ?? { liens: 0, points: 0 };
    const row = el('div', 'at-pw');
    row.dataset['world'] = m.id;
    const name = el('span', 'at-pn');
    name.append(document.createTextNode(m.nom));
    const bar = el('span', 'at-pb');
    if (n.liens > 0) { const i = el('i', 'at-b-link'); i.style.width = `${(n.liens / peak) * 100}%`; bar.append(i); }
    if (n.points > 0) { const i = el('i', 'at-b-dot'); i.style.width = `${(n.points / peak) * 100}%`; bar.append(i); }
    row.append(name, bar, el('span', 'at-pv', n.liens + n.points === 0 ? '0' : `${n.liens} + ${n.points}`));
    wrap.append(row);
  }
  const lg = el('p', 'at-legend-line');
  lg.append(el('span', 'at-k link'), document.createTextNode(L.perWorldKeyLink), el('span', 'at-k dot'), document.createTextNode(L.perWorldKeySame));
  s.append(wrap, lg, el('p', 'at-small at-pw-note', L.perWorldNote));
  return s;
}

export function createAtlasScreen(full: AtlasData, options: AtlasOptions = {}): Screen {
  const L = labelsFor(options.lang);
  const data = displayed(localize(full, options.lang ?? 'fr'));
  let root: HTMLElement | null = null;
  let sheet: Sheet | null = null;
  let matrix: MatrixView | null = null;
  return {
    mount(host) {
      const lit = litWorld(data, options.arrival);
      const page = el('div', 'atlas');
      page.lang = L.lang;
      page.dataset['ui'] = 'atlas';
      if (lit) page.dataset['lit'] = lit;
      const wrap = el('div', 'at-wrap');
      const hd = el('header', 'at-hd');
      if (options.onBack) {
        const b = el('button', 'at-back', L.back);
        b.type = 'button';
        b.dataset['testid'] = 'atlas-back';
        b.addEventListener('click', () => options.onBack?.());
        hd.append(b);
      }
      hd.append(el('h1', undefined, L.title), el('p', 'at-lead', L.intro(data.mondes.length, data.lois.length)));
      if (lit) {
        const m = data.mondes.find((x) => x.id === lit);
        hd.append(el('p', 'at-arrival', L.arrival(m?.nom ?? '')));
      }
      wrap.append(hd, constat(data, L));
      sheet = createSheet(page, data, L);
      const open = (id: string): void => sheet?.open(id);
      const openFigure = (id: string): void => sheet?.openFigure(id);

      const nb = data.mondes.length;
      const ext = data.mondes.filter((m) => m.extinction).length;
      const sl = section('leviers', L.kick['mondes'] ?? '', L.leversTitle, L.futuresLead(nb - ext, ext));
      sl.append(attribution(data, L), el('p', 'at-lead', L.leversLead), buildLevers(data, lit, L, openFigure));
      wrap.append(sl);

      const sm = section('matrice', L.kick['matrice'] ?? '', L.matrixTitle, L.matrixLead);
      matrix = buildMatrix(data, { open }, lit, L);
      sm.append(matrix.root);
      wrap.append(sm);

      const sf = section('frise', L.kick['frise'] ?? '', L.timelineTitle, L.timelineLead);
      sf.append(buildTimelineView(data, open, L));
      wrap.append(sf);

      const sc = section('chiffres', L.kick['chiffres'] ?? '', L.figuresTitle, L.figuresLead);
      const grid = el('div', 'at-tgrid');
      for (const c of data.chiffres) grid.append(figureTicket(c, L, openFigure));
      sc.append(grid);
      wrap.append(sc);

      page.append(wrap);
      host.append(page);
      root = page;
      if (lit) page.querySelector('.at-wcard.lit')?.setAttribute('aria-current', 'true');
    },
    unmount() {
      matrix?.destroy();
      sheet?.destroy();
      root?.remove();
      root = null; sheet = null; matrix = null;
    },
  };
}
