/**
 * Réplique d'une personne : UNE bulle blanche ancrée à elle, sans historique [plan UI-C T8 ; spec C §3.2 ; I-3, I-8].
 * La bulle se place hors du rectangle projeté de la personne (`placement.ts`) ; si rien ne tient elle passe en taille réduite, puis,
 * en dernier recours, elle se pose en haut de l'écran plutôt que de taire la ligne. Aucun mot du monde n'est écrit ici : tout texte vient d'une clé.
 */
import type { I18n } from '../../i18n/i18n';
import { loadUi } from '../../data/ui/load';
import type { MotionId } from '../../data/schema/ui';
import { motionFor } from '../../ui/motion';
import type { Animator } from '../../ui/motion';
import type { UiEvents } from '../../ui/events';
import { make, onLang } from './dom';
import './bubble.css';
import type { Part } from './dom';
import { placeBubble, scaledMargin } from './placement';
import type { Bounds, BubbleSide, ScreenRect, Size } from './placement';

export interface LineOptions {
  /** Clé du nom de la personne ; absente tant que sa fiche n'a pas été lue (pas de puce vide) [P-9]. */
  readonly nameKey?: string | undefined;
}
export interface BubbleDeps { readonly events: UiEvents; readonly animator: Animator; readonly reduced: boolean }
export interface Bubble extends Part {
  showLine(key: string, o?: LineOptions): void;
  /** Retire la bulle (mouvement de sortie, événement `ui.bubble.out`). Sans bulle ouverte : rien. */
  clearLine(): void;
  /** Le rectangle écran de la personne qui parle ; `null` : elle n'est plus à l'écran. Replace la bulle. */
  setPersonRect(r: ScreenRect | null): void;
  /**
   * Où la bulle doit tenir, posé par les zones : d'abord `zone` (Z-centre), sinon `frame` (le cadre utile moins ses marges, hors des bandes) ;
   * jamais dans une bande ni collée au bord. `null` : la fenêtre entière. Replace la bulle.
   */
  setBounds(zone: ScreenRect | null, frame?: ScreenRect): void;
  readonly isOpen: boolean;
}

const same = (a: ScreenRect | null, b: ScreenRect | null): boolean =>
  a === b || (a !== null && b !== null && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);

export function bubbleSize(el: HTMLElement): Size {
  return { w: el.offsetWidth, h: el.offsetHeight };   // taille de mise en page : le rectangle écran suivrait la transformation de l'entrée (échelle 0,9) et fausserait le placement
}

export function mountBubble(root: HTMLElement, i18n: I18n, deps: BubbleDeps): Bubble {
  const doc = root.ownerDocument;
  const { theme, timing } = loadUi();
  const { events, animator, reduced } = deps;
  let el: HTMLElement | null = null;
  let current: { key: string; nameKey: string | undefined } | null = null;
  let person: ScreenRect | null = null;
  let bounds: { zone: ScreenRect; frame: ScreenRect } | null = null;   // Z-centre d'abord, le cadre utile ensuite : jamais dans les bandes ni au bord [zones UX §2, Z-1 ; revue T8 I-1, I-2]
  let leaving: HTMLElement | null = null;      // la bulle qui sort : retirée dès qu'une autre arrive, jamais deux à l'écran
  const play = (target: Element, id: MotionId): Promise<void> => {
    const spec = motionFor(id, reduced, timing);
    return spec === null ? Promise.resolve() : animator.play(target, spec).catch(() => undefined);
  };
  const viewport = (): Size => ({ w: root.clientWidth || (doc.defaultView?.innerWidth ?? 1280), h: root.clientHeight || (doc.defaultView?.innerHeight ?? 720) });

  const render = (): void => {
    if (el === null || current === null) return;
    el.replaceChildren();
    if (current.nameKey !== undefined) el.appendChild(make(doc, 'span', { 'data-ui': 'name-chip', class: 'c-name-chip' }, i18n.t(current.nameKey)));
    el.appendChild(make(doc, 'p', { class: 'c-bubble__text' }, i18n.t(current.key)));
    el.appendChild(make(doc, 'span', { 'data-ui': 'bubble-tail', class: 'c-bubble__tail', 'aria-hidden': 'true' }));
    place();
  };

  /** Pose la bulle : taille pleine, puis réduite, puis repli en haut. Sans rectangle de personne, elle reste où le CSS la met. */
  function place(): void {
    if (el === null) return;
    const full = viewport();
    const cap = (v: Bounds | null): void => { el!.style.maxWidth = v === null ? '' : `${Math.floor(v.w)}px`; };   // plafonnée au cadre essayé, jamais plus large
    const margin = scaledMargin(theme.street.personMarginPx.v, full.w, theme.street.referenceWidthPx.v);
    el.style.setProperty('--s-bubble-margin-px', `${margin}px`);   // la queue se dimensionne sur la marge mise à l'échelle : sa pointe ne touche jamais la personne
    el.dataset['side'] = 'right';
    if (person === null) {                                      // sans personne : en bas de sa zone, centrée ; sans zone, où le CSS la met
      el.classList.remove('c-bubble--reduced');
      if (bounds === null) { cap(null); el.style.left = ''; el.style.top = ''; return; }
      const z = bounds.zone; cap(z);
      const s = bubbleSize(el);
      el.style.left = `${Math.round(z.x + (z.w - s.w) / 2)}px`; el.style.top = `${Math.round(z.y + z.h - s.h)}px`;
      tail(null);
      return;
    }
    el.classList.remove('c-bubble--reduced'); el.style.left = '0px'; el.style.top = '0px';
    const head = theme.street.headShare.v;
    // la personne peut être hors de Z-centre (en Z-gauche, en Z-droite) : la bulle reste ancrée à elle, dans le cadre utile, plutôt que forcée
    const tries: Bounds[] = bounds === null ? [full] : [bounds.zone, bounds.frame];
    let p: ReturnType<typeof placeBubble> = null; let view: Bounds = tries[0]!;
    // largeurs essayées : le cadre entier, puis la place libre à gauche, puis à droite de la personne ; jamais plus étroite que Z-centre
    const widths = (v: Bounds): (number | null)[] => {
      if (bounds === null) return [null];
      const x0 = v.x ?? 0, floor = bounds.zone.w;
      return [v.w, person!.x - margin - x0, x0 + v.w - (person!.x + person!.w + margin)].filter((w, i, all) => w >= floor && all.indexOf(w) === i);
    };
    search: for (const v of tries) {
      view = v;
      for (const w of widths(v)) {
        el.style.maxWidth = w === null ? '' : `${Math.floor(w)}px`; el.classList.remove('c-bubble--reduced');
        p = placeBubble(person, bubbleSize(el), v, margin, head);
        if (p === null) { el.classList.add('c-bubble--reduced'); p = placeBubble(person, bubbleSize(el), v, margin, head); }
        if (p !== null) break search;
      }
    }
    if (p === null) cap(bounds === null ? null : view);
    if (p === null) {                                           // aucun côté ne tient : la ligne reste lisible, en haut, du côté éloigné de la personne
      const s = bubbleSize(el);
      const inset = bounds === null ? margin : 0, bx = view.x ?? 0;          // le cadre porte déjà sa marge au bord
      const x = person.x + person.w / 2 > bx + view.w / 2 ? bx + inset : Math.max(bx + inset, bx + view.w - inset - s.w);
      el.dataset['side'] = 'forced'; el.dataset['placed'] = 'forced';
      el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(bounds === null ? margin : view.y ?? 0)}px`;
      tail(null);
      return;
    }
    el.dataset['placed'] = 'ok'; el.dataset['side'] = p.side;
    el.style.left = `${Math.round(p.rect.x)}px`; el.style.top = `${Math.round(p.rect.y)}px`;
    tail(p.side, p.tail.x - p.rect.x, p.tail.y - p.rect.y);
    el.style.transformOrigin = `${Math.round(p.tail.x - p.rect.x)}px ${Math.round(p.tail.y - p.rect.y)}px`;   // l'entrée part de la queue [spec §5]
  }
  function tail(side: BubbleSide | null, dx = 0, dy = 0): void {
    const t = el?.querySelector<HTMLElement>('[data-ui="bubble-tail"]');
    if (t === null || t === undefined) return;
    if (side === null) { t.hidden = true; return; }
    t.hidden = false; t.dataset['side'] = side;
    if (side === 'above') { t.style.left = `${Math.round(dx)}px`; t.style.top = '100%'; }
    else { t.style.top = `${Math.round(dy)}px`; t.style.left = side === 'right' ? '0px' : '100%'; }
  }

  const close = (): Promise<void> => {
    const gone = el; el = null; current = null;   // l'ancre reste : elle appartient à l'interface (cache sameRect), pas à la ligne
    if (gone === null) return Promise.resolve();
    leaving?.remove(); leaving = gone;
    events.emit('ui.bubble.out');
    return play(gone, 'bubbleOut').then(() => { gone.remove(); if (leaving === gone) leaving = null; });
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key !== 'Escape' || el === null || e.defaultPrevented) return; e.preventDefault(); void close(); };   // un Échap, une couche : la réplique avant le panneau
  doc.addEventListener('keydown', onKey);
  const off = onLang(i18n, render);

  return {
    get isOpen() { return el !== null; },
    showLine(key, o) {
      current = { key, nameKey: o?.nameKey };
      if (el === null) {
        leaving?.remove(); leaving = null;
        el = make(doc, 'div', { 'data-ui': 'bubble', 'aria-live': 'polite', class: 'c-bubble' });
        root.appendChild(el);
      }
      render();
      events.emit('ui.bubble.in');
      void play(el, 'bubbleIn');
    },
    clearLine() { void close(); },
    setBounds(zone, frame) {
      const next = zone === null ? null : { zone, frame: frame ?? zone };
      if (same(bounds?.zone ?? null, next?.zone ?? null) && same(bounds?.frame ?? null, next?.frame ?? null)) return;
      bounds = next;
      place();
    },
    setPersonRect(r) {
      if (same(person, r)) return;
      person = r;
      place();
    },
    dispose() { doc.removeEventListener('keydown', onKey); off(); el?.remove(); leaving?.remove(); el = null; },
  };
}
