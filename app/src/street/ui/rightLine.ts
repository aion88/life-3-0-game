/**
 * Ligne de droit : deux moitiés, déjà traduites par l'appelant (`lineHalves`) [R-L2]. `null` l'efface.
 * Une seule lecture au centre [design/ui/2026-11-02-zones-ecran-ux.md §3, Z-3 ; décision game-designer] : tant qu'une réplique est ouverte,
 * la ligne est EN FILE, jamais en même temps ; elle s'affiche dès que la réplique se ferme, et n'est jamais perdue : une ligne demandée
 * mais pas encore vue reste due même si l'appelant l'efface entre-temps. `whenShown` sert l'ordre « ligne de droit, puis ligne de prix ».
 */
import { make } from './dom';
import type { Part } from './dom';
import type { RightParts } from '../../engine/moments/rights';

export type Halves = { readonly first: string; readonly second: string };
export interface RightLineView extends Part {
  showRightLine(h: Halves | null): void;
  /** Trois lignes (phrase du monde, source nommée, citation) au lieu des deux moitiés ; mêmes règles de file que `showRightLine`. */
  showRightParts(p: RightParts | null): void;
  /** Vrai : une réplique occupe le centre, la ligne attend. Faux : elle s'affiche si elle est demandée ou due. */
  hold(on: boolean): void;
  /** Une ligne est due (demandée, jamais affichée). */
  readonly owed: boolean;
  /** Appelle `cb` dès qu'aucune ligne n'est due (tout de suite s'il n'y en a pas). */
  whenShown(cb: () => void): void;
}

export function mountRightLine(root: HTMLElement): RightLineView {
  const doc = root.ownerDocument; let el: HTMLElement | null = null;
  let line: Halves | RightParts | null = null; let seen = false; let held = false;
  let waiters: (() => void)[] = [];
  const clear = (): void => { el?.remove(); el = null; };
  const render = (): void => {
    clear();
    if (held || line === null) return;
    el = make(doc, 'p', { 'data-ui': 'right-line', class: 'c-right-line c-sober' });   // deux moitiés : encre/crème puis crème/encre [spec C §3.2]
    const win = el.appendChild(make(doc, 'span', { class: 'c-window' }));   // la fenêtre qui défile ; le cadre garde son remplissage hors défilement [zones UX §7.1.3]
    if ('here' in line) {   // rue guidée : phrase du monde sur encre, puis source et citation sur crème [spec §7]
      win.appendChild(make(doc, 'span', { 'data-ui': 'right-here', class: 'c-half c-half--ink' }, line.here));
      win.appendChild(make(doc, 'span', { 'data-ui': 'right-source', class: 'c-half c-half--creme c-right-source' }, line.source));
      win.appendChild(make(doc, 'span', { 'data-ui': 'right-quote', class: 'c-half c-half--creme c-right-quote' }, line.quote));
    } else {
      win.appendChild(make(doc, 'span', { 'data-half': '1', class: 'c-half c-half--ink' }, line.first));
      if (line.second !== '') win.appendChild(make(doc, 'span', { 'data-half': '2', class: 'c-half c-half--creme' }, line.second));
    }
    root.appendChild(el);
    seen = true;
    const w = waiters; waiters = [];
    for (const cb of w) cb();
  };
  const owed = (): boolean => line !== null && !seen;
  const setLine = (l: Halves | RightParts | null): void => {
    if (l === null) { if (!owed()) line = null; }                       // une ligne due reste due : elle passera après la réplique
    else { line = l; seen = false; }
    render();
  };
  return {
    showRightLine(h) { setLine(h); },
    showRightParts(p) { setLine(p); },
    hold(on) { if (on === held) return; held = on; render(); },
    get owed() { return owed(); },
    whenShown(cb) { if (owed()) waiters.push(cb); else cb(); },
    dispose() { clear(); waiters = []; },
  };
}
